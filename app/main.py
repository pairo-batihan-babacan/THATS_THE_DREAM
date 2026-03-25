from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from app.api.routes import audio, auth, document, image, jobs, payments, pdf, video, pages, ai
from app.core.database import init_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_database()
    yield


app = FastAPI(title="FileConvert", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://pdfworks.io"],
    allow_credentials=False,
    allow_headers=["*"],
    allow_methods=["*"],
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
