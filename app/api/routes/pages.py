from datetime import date
from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates
from fastapi.responses import PlainTextResponse, Response

router = APIRouter()
templates = Jinja2Templates(directory="frontend/templates")

# ── Existing tool pages ──────────────────────────────────────────────────────

@router.get("/")
async def index(request: Request):
    return templates.TemplateResponse(request, "index.html")


@router.get("/pdf")
async def pdf_page(request: Request):
    return templates.TemplateResponse(request, "tool.html", {
        "category": "pdf",
        "title": "PDF Tools",
    })


@router.get("/image")
async def image_page(request: Request):
    return templates.TemplateResponse(request, "tool.html", {
        "category": "image",
        "title": "Image Tools",
    })


@router.get("/audio")
async def audio_page(request: Request):
    return templates.TemplateResponse(request, "tool.html", {
        "category": "audio",
        "title": "Audio Tools",
    })


@router.get("/video")
async def video_page(request: Request):
    return templates.TemplateResponse(request, "tool.html", {
        "category": "video",
        "title": "Video Tools",
    })


@router.get("/document")
async def document_page(request: Request):
    return templates.TemplateResponse(request, "tool.html", {
        "category": "document",
        "title": "Document Tools",
    })


# ── Essential info pages ─────────────────────────────────────────────────────

@router.get("/about")
async def about_page(request: Request):
    return templates.TemplateResponse(request, "about.html")


@router.get("/privacy")
async def privacy_page(request: Request):
    return templates.TemplateResponse(request, "privacy.html")


@router.get("/terms")
async def terms_page(request: Request):
    return templates.TemplateResponse(request, "terms.html")


@router.get("/contact")
async def contact_page(request: Request):
    return templates.TemplateResponse(request, "contact.html")


@router.get("/faq")
async def faq_page(request: Request):
    return templates.TemplateResponse(request, "faq.html")


# ── Blog ─────────────────────────────────────────────────────────────────────

BLOG_POSTS_META = [
    {
        "slug": "how-to-compress-pdf-files",
        "title": "How to Compress PDF Files Without Losing Quality",
        "description": "Learn the best methods to shrink PDF file size — from image downsampling to metadata removal — while keeping your content sharp.",
        "date": "2024-04-10",
        "reading_time": "6 min read",
    },
    {
        "slug": "pdf-to-word-guide",
        "title": "PDF to Word Conversion: The Complete Guide",
        "description": "Everything you need to know about converting PDF documents to editable Word files, including tips for scanned documents.",
        "date": "2024-04-08",
        "reading_time": "7 min read",
    },
    {
        "slug": "how-to-merge-pdf-files",
        "title": "How to Merge PDF Files: Step-by-Step Guide",
        "description": "Combine multiple PDF documents into one file easily. Learn how to reorder pages and organise multi-document workflows.",
        "date": "2024-04-05",
        "reading_time": "5 min read",
    },
    {
        "slug": "extract-images-from-pdf",
        "title": "How to Extract Images from PDF Files",
        "description": "Step-by-step guide to pulling images out of PDF documents while preserving quality. Includes tips on format and resolution.",
        "date": "2024-04-02",
        "reading_time": "5 min read",
    },
    {
        "slug": "pdf-security-encryption-guide",
        "title": "PDF Security and Encryption: A Complete Guide",
        "description": "Understand PDF password types, encryption standards, and how to protect or unlock PDF files — legally and ethically.",
        "date": "2024-03-30",
        "reading_time": "8 min read",
    },
    {
        "slug": "reduce-pdf-file-size",
        "title": "How to Reduce PDF File Size: 7 Proven Methods",
        "description": "Seven practical techniques to make your PDFs smaller without sacrificing readability — from compression to metadata removal.",
        "date": "2024-03-27",
        "reading_time": "6 min read",
    },
    {
        "slug": "pdf-vs-docx",
        "title": "PDF vs DOCX: Key Differences Explained",
        "description": "A deep dive into when to use PDF versus Word DOCX format, and why converting between the two is sometimes necessary.",
        "date": "2024-03-24",
        "reading_time": "6 min read",
    },
    {
        "slug": "best-free-pdf-tools",
        "title": "Best Free PDF Tools in 2024: Complete Comparison",
        "description": "An honest comparison of the top free PDF tools available online and on the desktop, including privacy and feature breakdowns.",
        "date": "2024-03-20",
        "reading_time": "9 min read",
    },
    {
        "slug": "pdf-accessibility-guide",
        "title": "PDF Accessibility Guide: Making Documents Inclusive",
        "description": "How to create accessible PDF documents that work with screen readers, meet WCAG 2.1 standards, and comply with ADA requirements.",
        "date": "2024-03-16",
        "reading_time": "7 min read",
    },
    {
        "slug": "create-fillable-pdf-forms",
        "title": "How to Create Fillable PDF Forms",
        "description": "Learn how to create interactive PDF forms with text fields, checkboxes, dropdowns, and signature fields from scratch.",
        "date": "2024-03-12",
        "reading_time": "8 min read",
    },
    {
        "slug": "mp3-vs-aac",
        "title": "MP3 vs AAC: Which Audio Format Should You Use?",
        "description": "A clear comparison of MP3 and AAC audio formats — sound quality, file size, compatibility, and when each format is the right choice.",
        "date": "2024-05-01",
        "reading_time": "6 min read",
    },
    {
        "slug": "what-is-audio-normalization",
        "title": "What Is Audio Normalization? LUFS, EBU R128 and Loudness Explained",
        "description": "Understand what audio normalization means, how LUFS and EBU R128 loudness targets work, and when you should normalize your audio.",
        "date": "2024-05-03",
        "reading_time": "7 min read",
    },
    {
        "slug": "how-to-extract-audio-from-video",
        "title": "How to Extract Audio from a Video File",
        "description": "Step-by-step guide to pulling the audio track out of any video file and saving it as MP3, WAV, FLAC, or any other format.",
        "date": "2024-05-05",
        "reading_time": "5 min read",
    },
    {
        "slug": "how-to-reduce-audio-file-size",
        "title": "How to Reduce Audio File Size Without Losing Quality",
        "description": "Practical techniques to compress audio files — bitrate reduction, format conversion, and when lossless compression makes sense.",
        "date": "2024-05-07",
        "reading_time": "6 min read",
    },
    {
        "slug": "flac-vs-mp3",
        "title": "FLAC vs MP3: Is Lossless Audio Worth It?",
        "description": "An honest comparison of FLAC and MP3 — sound quality differences, file sizes, compatibility, and which to choose for listening, archiving, and streaming.",
        "date": "2024-05-09",
        "reading_time": "6 min read",
    },
    {
        "slug": "how-to-reduce-video-file-size",
        "title": "How to Reduce Video File Size: A Complete Guide",
        "description": "Everything you need to know about making video files smaller — codecs, CRF, resolution, bitrate, and the right settings for every use case.",
        "date": "2024-05-11",
        "reading_time": "8 min read",
    },
    {
        "slug": "mp4-vs-mkv",
        "title": "MP4 vs MKV: Key Differences Explained",
        "description": "Compare MP4 and MKV video containers — compatibility, features, codec support, and which format to use for streaming, editing, and archiving.",
        "date": "2024-05-13",
        "reading_time": "6 min read",
    },
    {
        "slug": "jpeg-vs-png-vs-webp",
        "title": "JPEG vs PNG vs WebP: Which Image Format Should You Use?",
        "description": "A definitive guide to the three major web image formats — when to use each one, quality vs file size trade-offs, and browser compatibility.",
        "date": "2024-05-15",
        "reading_time": "7 min read",
    },
    {
        "slug": "how-to-remove-exif-data-from-photos",
        "title": "How to Remove EXIF Data from Photos",
        "description": "Step-by-step guide to removing GPS location, camera model, and all hidden EXIF metadata from photos before sharing them online.",
        "date": "2024-05-17",
        "reading_time": "5 min read",
    },
    {
        "slug": "how-to-extract-text-from-image-ocr",
        "title": "How to Extract Text from an Image Online — Free OCR Guide",
        "description": "How to use OCR to extract text from scanned documents, photos, and screenshots. Tips for getting the most accurate results.",
        "date": "2024-05-19",
        "reading_time": "6 min read",
    },
]


@router.get("/blog")
async def blog_index(request: Request):
    return templates.TemplateResponse(request, "blog_index.html", {
        "posts": BLOG_POSTS_META,
    })


@router.get("/blog/how-to-compress-pdf-files")
async def blog_compress_pdf(request: Request):
    return templates.TemplateResponse(request, "blog/compress-pdf.html")


@router.get("/blog/pdf-to-word-guide")
async def blog_pdf_to_word(request: Request):
    return templates.TemplateResponse(request, "blog/pdf-to-word.html")


@router.get("/blog/how-to-merge-pdf-files")
async def blog_merge_pdf(request: Request):
    return templates.TemplateResponse(request, "blog/merge-pdf.html")


@router.get("/blog/extract-images-from-pdf")
async def blog_extract_images(request: Request):
    return templates.TemplateResponse(request, "blog/extract-images.html")


@router.get("/blog/pdf-security-encryption-guide")
async def blog_pdf_security(request: Request):
    return templates.TemplateResponse(request, "blog/pdf-security.html")


@router.get("/blog/reduce-pdf-file-size")
async def blog_reduce_pdf_size(request: Request):
    return templates.TemplateResponse(request, "blog/reduce-pdf-size.html")


@router.get("/blog/pdf-vs-docx")
async def blog_pdf_vs_docx(request: Request):
    return templates.TemplateResponse(request, "blog/pdf-vs-docx.html")


@router.get("/blog/best-free-pdf-tools")
async def blog_best_pdf_tools(request: Request):
    return templates.TemplateResponse(request, "blog/best-free-pdf-tools.html")


@router.get("/blog/pdf-accessibility-guide")
async def blog_pdf_accessibility(request: Request):
    return templates.TemplateResponse(request, "blog/pdf-accessibility.html")


@router.get("/blog/create-fillable-pdf-forms")
async def blog_fillable_forms(request: Request):
    return templates.TemplateResponse(request, "blog/fillable-pdf-forms.html")


@router.get("/blog/mp3-vs-aac")
async def blog_mp3_vs_aac(request: Request):
    return templates.TemplateResponse(request, "blog/mp3-vs-aac.html")


@router.get("/blog/what-is-audio-normalization")
async def blog_audio_normalization(request: Request):
    return templates.TemplateResponse(request, "blog/what-is-audio-normalization.html")


@router.get("/blog/how-to-extract-audio-from-video")
async def blog_extract_audio(request: Request):
    return templates.TemplateResponse(request, "blog/how-to-extract-audio-from-video.html")


@router.get("/blog/how-to-reduce-audio-file-size")
async def blog_reduce_audio(request: Request):
    return templates.TemplateResponse(request, "blog/how-to-reduce-audio-file-size.html")


@router.get("/blog/flac-vs-mp3")
async def blog_flac_vs_mp3(request: Request):
    return templates.TemplateResponse(request, "blog/flac-vs-mp3.html")


@router.get("/blog/how-to-reduce-video-file-size")
async def blog_reduce_video(request: Request):
    return templates.TemplateResponse(request, "blog/how-to-reduce-video-file-size.html")


@router.get("/blog/mp4-vs-mkv")
async def blog_mp4_vs_mkv(request: Request):
    return templates.TemplateResponse(request, "blog/mp4-vs-mkv.html")


@router.get("/blog/jpeg-vs-png-vs-webp")
async def blog_jpeg_vs_png_vs_webp(request: Request):
    return templates.TemplateResponse(request, "blog/jpeg-vs-png-vs-webp.html")


@router.get("/blog/how-to-remove-exif-data-from-photos")
async def blog_remove_exif(request: Request):
    return templates.TemplateResponse(request, "blog/how-to-remove-exif-data-from-photos.html")


@router.get("/blog/how-to-extract-text-from-image-ocr")
async def blog_extract_text_ocr(request: Request):
    return templates.TemplateResponse(request, "blog/how-to-extract-text-from-image-ocr.html")


# ── Tool detail pages ─────────────────────────────────────────────────────────

@router.get("/tools/compress-pdf")
async def tool_compress_pdf(request: Request):
    return templates.TemplateResponse(request, "tools/compress-pdf.html")


@router.get("/tools/pdf-to-word")
async def tool_pdf_to_word(request: Request):
    return templates.TemplateResponse(request, "tools/pdf-to-word.html")


@router.get("/tools/word-to-pdf")
async def tool_word_to_pdf(request: Request):
    return templates.TemplateResponse(request, "tools/word-to-pdf.html")


@router.get("/tools/merge-pdf")
async def tool_merge_pdf(request: Request):
    return templates.TemplateResponse(request, "tools/merge-pdf.html")


@router.get("/tools/split-pdf")
async def tool_split_pdf(request: Request):
    return templates.TemplateResponse(request, "tools/split-pdf.html")


@router.get("/tools/strip-pdf-metadata")
async def tool_strip_metadata(request: Request):
    return templates.TemplateResponse(request, "tools/strip-metadata.html")


@router.get("/tools/unlock-pdf")
async def tool_unlock_pdf(request: Request):
    return templates.TemplateResponse(request, "tools/unlock-pdf.html")


@router.get("/tools/pdf-to-images")
async def tool_pdf_to_images(request: Request):
    return templates.TemplateResponse(request, "tools/pdf-to-images.html")


@router.get("/tools/rotate-pdf")
async def tool_rotate_pdf(request: Request):
    return templates.TemplateResponse(request, "tools/rotate-pdf.html")


@router.get("/tools/extract-audio")
async def tool_extract_audio(request: Request):
    return templates.TemplateResponse(request, "tools/extract-audio.html")


@router.get("/tools/protect-pdf")
async def tool_protect_pdf(request: Request):
    return templates.TemplateResponse(request, "tools/protect-pdf.html")


@router.get("/tools/flatten-pdf")
async def tool_flatten_pdf(request: Request):
    return templates.TemplateResponse(request, "tools/flatten-pdf.html")


# ── Image tool pages ──────────────────────────────────────────────────────────

@router.get("/tools/convert-image")
async def tool_convert_image(request: Request):
    return templates.TemplateResponse(request, "tools/convert-image.html")


@router.get("/tools/compress-image")
async def tool_compress_image(request: Request):
    return templates.TemplateResponse(request, "tools/compress-image.html")


@router.get("/tools/resize-image")
async def tool_resize_image(request: Request):
    return templates.TemplateResponse(request, "tools/resize-image.html")


@router.get("/tools/strip-exif")
async def tool_strip_exif(request: Request):
    return templates.TemplateResponse(request, "tools/strip-exif.html")


# ── Audio tool pages ──────────────────────────────────────────────────────────

@router.get("/tools/audio-converter")
async def tool_audio_converter(request: Request):
    return templates.TemplateResponse(request, "tools/audio-converter.html")


@router.get("/tools/compress-audio")
async def tool_compress_audio(request: Request):
    return templates.TemplateResponse(request, "tools/compress-audio.html")


@router.get("/tools/trim-audio")
async def tool_trim_audio(request: Request):
    return templates.TemplateResponse(request, "tools/trim-audio.html")


@router.get("/tools/normalize-audio")
async def tool_normalize_audio(request: Request):
    return templates.TemplateResponse(request, "tools/normalize-audio.html")


@router.get("/tools/change-speed-audio")
async def tool_change_speed_audio(request: Request):
    return templates.TemplateResponse(request, "tools/change-speed-audio.html")


# ── Video tool pages ──────────────────────────────────────────────────────────

@router.get("/tools/compress-video")
async def tool_compress_video(request: Request):
    return templates.TemplateResponse(request, "tools/compress-video.html")


@router.get("/tools/convert-video")
async def tool_convert_video(request: Request):
    return templates.TemplateResponse(request, "tools/convert-video.html")


# ── Document tool pages ───────────────────────────────────────────────────────

@router.get("/tools/ocr")
async def tool_ocr(request: Request):
    return templates.TemplateResponse(request, "tools/ocr.html")


# ── SEO files ─────────────────────────────────────────────────────────────────

SITEMAP_URLS = [
    ("/", "1.0", "daily"),
    ("/pdf", "0.9", "weekly"),
    ("/image", "0.8", "weekly"),
    ("/audio", "0.8", "weekly"),
    ("/video", "0.8", "weekly"),
    ("/document", "0.8", "weekly"),
    ("/about", "0.7", "monthly"),
    ("/contact", "0.6", "monthly"),
    ("/faq", "0.8", "monthly"),
    ("/privacy", "0.5", "yearly"),
    ("/terms", "0.5", "yearly"),
    ("/blog", "0.9", "weekly"),
    ("/blog/how-to-compress-pdf-files", "0.8", "monthly"),
    ("/blog/pdf-to-word-guide", "0.8", "monthly"),
    ("/blog/how-to-merge-pdf-files", "0.8", "monthly"),
    ("/blog/extract-images-from-pdf", "0.8", "monthly"),
    ("/blog/pdf-security-encryption-guide", "0.8", "monthly"),
    ("/blog/reduce-pdf-file-size", "0.8", "monthly"),
    ("/blog/pdf-vs-docx", "0.8", "monthly"),
    ("/blog/best-free-pdf-tools", "0.8", "monthly"),
    ("/blog/pdf-accessibility-guide", "0.8", "monthly"),
    ("/blog/create-fillable-pdf-forms", "0.8", "monthly"),
    ("/blog/mp3-vs-aac", "0.8", "monthly"),
    ("/blog/what-is-audio-normalization", "0.8", "monthly"),
    ("/blog/how-to-extract-audio-from-video", "0.8", "monthly"),
    ("/blog/how-to-reduce-audio-file-size", "0.8", "monthly"),
    ("/blog/flac-vs-mp3", "0.8", "monthly"),
    ("/blog/how-to-reduce-video-file-size", "0.8", "monthly"),
    ("/blog/mp4-vs-mkv", "0.8", "monthly"),
    ("/blog/jpeg-vs-png-vs-webp", "0.8", "monthly"),
    ("/blog/how-to-remove-exif-data-from-photos", "0.8", "monthly"),
    ("/blog/how-to-extract-text-from-image-ocr", "0.8", "monthly"),
    ("/tools/convert-image", "0.85", "monthly"),
    ("/tools/compress-image", "0.85", "monthly"),
    ("/tools/resize-image", "0.85", "monthly"),
    ("/tools/strip-exif", "0.85", "monthly"),
    ("/tools/audio-converter", "0.85", "monthly"),
    ("/tools/compress-audio", "0.85", "monthly"),
    ("/tools/trim-audio", "0.85", "monthly"),
    ("/tools/normalize-audio", "0.85", "monthly"),
    ("/tools/change-speed-audio", "0.85", "monthly"),
    ("/tools/compress-video", "0.85", "monthly"),
    ("/tools/convert-video", "0.85", "monthly"),
    ("/tools/ocr", "0.9", "monthly"),
    ("/tools/compress-pdf", "0.85", "monthly"),
    ("/tools/pdf-to-word", "0.85", "monthly"),
    ("/tools/word-to-pdf", "0.85", "monthly"),
    ("/tools/merge-pdf", "0.85", "monthly"),
    ("/tools/split-pdf", "0.85", "monthly"),
    ("/tools/strip-pdf-metadata", "0.8", "monthly"),
    ("/tools/unlock-pdf", "0.85", "monthly"),
    ("/tools/pdf-to-images", "0.8", "monthly"),
    ("/tools/rotate-pdf", "0.85", "monthly"),
    ("/tools/extract-audio", "0.85", "monthly"),
    ("/tools/protect-pdf", "0.85", "monthly"),
    ("/tools/flatten-pdf", "0.85", "monthly"),
]


@router.get("/sitemap.xml")
async def sitemap(request: Request):
    today = date.today().isoformat()
    items = "\n".join(
        f"  <url>\n"
        f"    <loc>https://pdfworks.io{path}</loc>\n"
        f"    <lastmod>{today}</lastmod>\n"
        f"    <changefreq>{freq}</changefreq>\n"
        f"    <priority>{prio}</priority>\n"
        f"  </url>"
        for path, prio, freq in SITEMAP_URLS
    )
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{items}
</urlset>"""
    return Response(content=xml, media_type="application/xml")


@router.get("/robots.txt")
async def robots_txt(request: Request):
    txt = (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /api/\n"
        "Disallow: /health\n"
        "\n"
        "Sitemap: https://pdfworks.io/sitemap.xml\n"
    )
    return PlainTextResponse(content=txt)
