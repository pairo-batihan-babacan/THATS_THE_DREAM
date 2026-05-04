import logging
import os
import subprocess

from app.core.config import settings

logger = logging.getLogger(__name__)

# CRF values: lower = higher quality / larger file
_QUALITY_CRF = {"low": 32, "medium": 28, "high": 22}

def _output_path(job_id: str, filename: str) -> str:
    os.makedirs(settings.OUTPUT_DIR, exist_ok=True)
    return os.path.join(settings.OUTPUT_DIR, filename)


# ── Core standardization helper ───────────────────────────────────────────────

def _standardize_video_for_web(
    input_path: str,
    output_path: str,
    crf: int = 23,
) -> None:
    """
    Re-encode to H.264/AAC MP4 with settings that play everywhere.

    - yuv420p   : broadest player/OS compatibility (no 4:2:2 / 4:4:4 issues)
    - superfast : fast encode; acceptable quality for web delivery
    - faststart : moov atom at front — playback starts before full download
    - aac 128k  : safe audio baseline; source audio is replaced if non-AAC
    """
    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-vcodec", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "superfast",
        "-crf", str(crf),
        "-movflags", "+faststart",
        "-acodec", "aac",
        "-b:a", "128k",
        output_path,
    ]
    logger.info("ffmpeg standardize: %s → %s (crf=%d)", input_path, output_path, crf)
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode != 0:
        detail = result.stderr.decode(errors="replace").strip()
        logger.error("ffmpeg failed (rc=%d): %s", result.returncode, detail)
        raise RuntimeError(f"FFmpeg encoding failed: {detail}")
    logger.info("ffmpeg standardize done: %s", output_path)


# ── Public service functions ──────────────────────────────────────────────────

def convert_video(input_path: str, job_id: str, target_format: str) -> str:
    """Convert video to target_format. Always produces a web-safe H.264 MP4."""
    output_filename = f"{job_id}_converted.{target_format}"
    output_path = _output_path(job_id, output_filename)
    _standardize_video_for_web(input_path, output_path, crf=23)
    return output_filename


def compress_video(input_path: str, job_id: str, quality: str = "medium") -> str:
    """Compress video using H.264 with quality-mapped CRF."""
    crf = _QUALITY_CRF.get(quality, 28)
    output_filename = f"{job_id}_compressed.mp4"
    output_path = _output_path(job_id, output_filename)
    _standardize_video_for_web(input_path, output_path, crf=crf)
    return output_filename
