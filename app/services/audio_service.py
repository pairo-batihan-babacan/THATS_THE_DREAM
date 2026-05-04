import os
import tempfile
import ffmpeg
from app.core.config import settings


def _output_path(job_id: str, filename: str) -> str:
    os.makedirs(settings.OUTPUT_DIR, exist_ok=True)
    return os.path.join(settings.OUTPUT_DIR, filename)


def _ffmpeg_error(e: ffmpeg.Error, context: str) -> RuntimeError:
    stderr = e.stderr.decode(errors="replace").strip() if e.stderr else ""
    stdout = e.stdout.decode(errors="replace").strip() if e.stdout else ""
    detail = stderr or stdout or "No output from ffmpeg"
    return RuntimeError(f"{context}: {detail}")


# ── Constants ────────────────────────────────────────────────────────────────

_LOSSLESS = {"wav", "flac", "aiff"}
_CODEC_MAP = {
    "mp3":  "libmp3lame",
    "aac":  "aac",
    "ogg":  "libvorbis",
    "m4a":  "aac",
    "flac": "flac",
    "wav":  "pcm_s16le",
    "aiff": "pcm_s16le",
}
_QUALITY_BITRATE = {"high": "192k", "medium": "128k", "low": "96k"}
_AUDIO_FORMATS = set(_CODEC_MAP.keys())


# ── Existing tools (fixed) ───────────────────────────────────────────────────

def convert_audio(input_path: str, job_id: str, target_format: str, quality: str = "high") -> str:
    """Convert audio to target format with correct codec and quality settings.

    quality only applies to lossy output formats (mp3, aac, ogg, m4a).
    Lossless outputs (wav, flac, aiff) ignore quality and use the native codec.
    """
    target_format = target_format.lower()
    if target_format not in _AUDIO_FORMATS:
        raise ValueError(f"Unsupported target format: {target_format}")

    codec = _CODEC_MAP[target_format]
    output_filename = f"{job_id}_converted.{target_format}"
    output_path = _output_path(job_id, output_filename)

    out_kwargs: dict = {"acodec": codec}
    if target_format not in _LOSSLESS:
        out_kwargs["audio_bitrate"] = _QUALITY_BITRATE.get(quality, "192k")

    try:
        ffmpeg.input(input_path).output(output_path, **out_kwargs).run(
            overwrite_output=True, quiet=True
        )
    except ffmpeg.Error as e:
        raise _ffmpeg_error(e, f"Audio conversion to {target_format} failed")
    return output_filename


def compress_audio(input_path: str, job_id: str, bitrate: str = "128k") -> str:
    """Compress audio file.

    - Lossy formats (mp3, aac, ogg, m4a): re-encode at a lower bitrate.
    - WAV: transcode to MP3 at the chosen bitrate (WAV is uncompressed PCM;
      there is no such thing as a 'compressed WAV').
    - FLAC: re-encode at compression level 10 (maximum lossless compression).
      Bitrate has no meaning for FLAC; the output stays lossless.
    """
    ext = os.path.splitext(input_path)[1].lower().lstrip(".")

    if ext == "flac":
        output_filename = f"{job_id}_compressed.flac"
        output_path = _output_path(job_id, output_filename)
        try:
            ffmpeg.input(input_path).output(
                output_path, acodec="flac", compression_level=10
            ).run(overwrite_output=True, quiet=True)
        except ffmpeg.Error as e:
            raise _ffmpeg_error(e, "FLAC compression failed")
        return output_filename

    if ext in ("wav", "aiff"):
        # Lossless → transcode to MP3
        output_filename = f"{job_id}_compressed.mp3"
        output_path = _output_path(job_id, output_filename)
        try:
            ffmpeg.input(input_path).output(
                output_path, acodec="libmp3lame", audio_bitrate=bitrate
            ).run(overwrite_output=True, quiet=True)
        except ffmpeg.Error as e:
            raise _ffmpeg_error(e, f"WAV/AIFF → MP3 compression at {bitrate} failed")
        return output_filename

    # Lossy (mp3, aac, ogg, m4a): reduce bitrate
    output_filename = f"{job_id}_compressed.{ext}"
    output_path = _output_path(job_id, output_filename)
    try:
        ffmpeg.input(input_path).output(output_path, audio_bitrate=bitrate).run(
            overwrite_output=True, quiet=True
        )
    except ffmpeg.Error as e:
        raise _ffmpeg_error(e, f"Audio compression at {bitrate} failed")
    return output_filename


def extract_audio(input_path: str, job_id: str, fmt: str = "mp3", quality: str = "high") -> str:
    """Extract audio track from a video file."""
    if fmt not in _AUDIO_FORMATS:
        fmt = "mp3"
    output_filename = f"{job_id}_audio.{fmt}"
    output_path = _output_path(job_id, output_filename)

    out_kwargs: dict = {"vn": None}
    codec = _CODEC_MAP.get(fmt)
    if codec:
        out_kwargs["acodec"] = codec
    if fmt not in _LOSSLESS:
        out_kwargs["audio_bitrate"] = _QUALITY_BITRATE.get(quality, "192k")

    try:
        ffmpeg.input(input_path).output(output_path, **out_kwargs).run(
            overwrite_output=True, quiet=True
        )
    except ffmpeg.Error as e:
        raise _ffmpeg_error(e, "Audio extraction from video failed")
    return output_filename


def strip_audio_metadata(input_path: str, job_id: str) -> str:
    """Copy audio file and strip all ID3/metadata tags."""
    ext = os.path.splitext(input_path)[1].lower().lstrip(".")
    output_filename = f"{job_id}_clean.{ext}"
    output_path = _output_path(job_id, output_filename)
    try:
        ffmpeg.input(input_path).output(
            output_path, map_metadata=-1, acodec="copy"
        ).run(overwrite_output=True, quiet=True)
    except ffmpeg.Error as e:
        raise _ffmpeg_error(e, "Audio metadata removal failed")
    return output_filename


def inspect_audio_metadata(content: bytes, ext: str) -> dict:
    """Return a dict of ID3/metadata tags from audio bytes via ffprobe."""
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    try:
        probe = ffmpeg.probe(tmp_path)
        tags = {}
        for k, v in probe.get("format", {}).get("tags", {}).items():
            tags[k.title()] = str(v)
        for stream in probe.get("streams", []):
            for k, v in stream.get("tags", {}).items():
                if k.title() not in tags:
                    tags[k.title()] = str(v)
        return tags
    except ffmpeg.Error as e:
        raise _ffmpeg_error(e, "Audio metadata probe failed")
    finally:
        os.unlink(tmp_path)


# ── New tools ────────────────────────────────────────────────────────────────

def _parse_time(t: str) -> float:
    """Parse '1:30', '1:30.5', or '90' into seconds."""
    t = t.strip()
    if ":" in t:
        parts = t.split(":", 1)
        return int(parts[0]) * 60 + float(parts[1])
    return float(t)


def trim_audio(input_path: str, job_id: str, start: str, end: str) -> str:
    """Trim audio to [start, end].

    start / end accept 'MM:SS', 'HH:MM:SS', or plain seconds ('90').
    Uses stream copy (no re-encode) for speed; falls back to re-encode if
    the format does not support stream copy.
    """
    start_sec = _parse_time(start)
    end_sec   = _parse_time(end)
    if end_sec <= start_sec:
        raise ValueError(
            f"End time ({end}) must be after start time ({start}). "
            f"Parsed: start={start_sec:.2f}s end={end_sec:.2f}s"
        )
    duration = end_sec - start_sec

    ext = os.path.splitext(input_path)[1].lower().lstrip(".")
    output_filename = f"{job_id}_trimmed.{ext}"
    output_path = _output_path(job_id, output_filename)

    # Seek to start before the input (fast), then take 'duration' seconds
    try:
        ffmpeg.input(input_path, ss=start_sec).output(
            output_path, t=duration, acodec="copy"
        ).run(overwrite_output=True, quiet=True)
        return output_filename
    except ffmpeg.Error:
        pass  # fall through to re-encode

    try:
        ffmpeg.input(input_path, ss=start_sec).output(
            output_path, t=duration
        ).run(overwrite_output=True, quiet=True)
    except ffmpeg.Error as e:
        raise _ffmpeg_error(e, f"Audio trim ({start}–{end}) failed")
    return output_filename


def normalize_audio(input_path: str, job_id: str, target_loudness: float = -16.0) -> str:
    """Normalize audio loudness using EBU R128 loudnorm filter.

    target_loudness: target integrated loudness in LUFS (e.g. -14, -16, -23).
    Common targets:
      -14 LUFS — streaming platforms (Spotify, YouTube, Apple Music)
      -16 LUFS — general / podcasting
      -23 LUFS — broadcast (EBU R128 standard)
    """
    target_loudness = max(-50.0, min(-1.0, float(target_loudness)))
    ext = os.path.splitext(input_path)[1].lower().lstrip(".")
    output_filename = f"{job_id}_normalized.{ext}"
    output_path = _output_path(job_id, output_filename)

    try:
        (
            ffmpeg
            .input(input_path)
            .audio
            .filter("loudnorm", I=target_loudness, LRA=11, TP=-1.5)
            .output(output_path)
            .run(overwrite_output=True, quiet=True)
        )
    except ffmpeg.Error as e:
        raise _ffmpeg_error(e, f"Audio normalization to {target_loudness} LUFS failed")
    return output_filename


def change_speed_audio(input_path: str, job_id: str, speed: float) -> str:
    """Change audio playback speed without changing pitch (time-stretching).

    speed: 0.5–4.0 (1.0 = original). Uses atempo filter, chaining filters
    when speed is outside the single-filter range of [0.5, 2.0].
    """
    speed = float(speed)
    if not (0.25 <= speed <= 4.0):
        raise ValueError(f"Speed must be between 0.25 and 4.0, got {speed}")

    ext = os.path.splitext(input_path)[1].lower().lstrip(".")
    speed_str = f"{speed:.2f}".rstrip("0").rstrip(".")
    output_filename = f"{job_id}_x{speed_str}.{ext}"
    output_path = _output_path(job_id, output_filename)

    # Build atempo filter chain — each filter stage is limited to [0.5, 2.0]
    remaining = speed
    stages = []
    while remaining > 2.0:
        stages.append(2.0)
        remaining /= 2.0
    while remaining < 0.5:
        stages.append(0.5)
        remaining /= 0.5
    stages.append(remaining)

    try:
        stream = ffmpeg.input(input_path).audio
        for s in stages:
            stream = stream.filter("atempo", s)
        stream.output(output_path).run(overwrite_output=True, quiet=True)
    except ffmpeg.Error as e:
        raise _ffmpeg_error(e, f"Speed change to {speed}x failed")
    return output_filename
