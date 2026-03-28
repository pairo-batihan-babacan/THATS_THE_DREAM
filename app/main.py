import logging
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from app.api.routes import audio, auth, document, image, jobs, payments, pdf, video, pages, ai
from app.core.database import init_database
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
logger = logging.getLogger(__name__)



@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_database()
    yield


app = FastAPI(title="FileConvert", lifespan=lifespan)


# Updated logic for app/main.py
_ALLOWED_ORIGINS = []
raw_origins = settings.ALLOWED_ORIGINS

if isinstance(raw_origins, str):
    # Standard comma-separated string
    _ALLOWED_ORIGINS = [o.strip() for o in raw_origins.split(",") if o.strip()]
elif isinstance(raw_origins, list):
    # Ensure every item in the list is a string, skip anything weird (like a dict)
    _ALLOWED_ORIGINS = [str(o) for o in raw_origins if isinstance(o, (str, bytes))]

# If it's still empty, fallback to a safe default
if not _ALLOWED_ORIGINS:
    _ALLOWED_ORIGINS = ["https://pdfworks.io"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Return a JSON 500 with CORS headers so the browser can read the error."""
    logger.error("Unhandled exception: %s", traceback.format_exc())
    origin = request.headers.get("origin", "")
    headers = {"Access-Control-Allow-Origin": origin} if origin in _ALLOWED_ORIGINS else {}
    return JSONResponse(
        status_code=500,
        content={"detail": f"{type(exc).__name__}: {exc}"},
        headers=headers,
    )


# Static files (only mount if the directory exists — safe for both local and Render)
import os as _os
if _os.path.isdir("frontend/static"):
    app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

# API routes
app.include_router(pdf.router)
app.include_router(audio.router)
app.include_router(auth.router)
app.include_router(document.router)
app.include_router(image.router)
app.include_router(jobs.router)
app.include_router(payments.router)
app.include_router(video.router)
app.include_router(ai.router)

# Page routes (must be last — catches / and tool paths)
app.include_router(pages.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
