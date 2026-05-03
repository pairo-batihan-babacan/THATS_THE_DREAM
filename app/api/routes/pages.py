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
