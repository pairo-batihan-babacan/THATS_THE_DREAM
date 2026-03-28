from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

router = APIRouter()
templates = Jinja2Templates(directory="frontend/templates")


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
