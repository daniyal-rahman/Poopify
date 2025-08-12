import uuid
from pathlib import Path
from fastapi import FastAPI, UploadFile, File
from starlette.middleware.cors import CORSMiddleware

from api.routes_parse import router as parse_router
from api.routes_stream import router as stream_router
from core.config import UPLOAD_DIR

app = FastAPI(title="Layout-Aware TTS Reader")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173","http://127.0.0.1:5173"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

app.include_router(parse_router, prefix="/api")
app.include_router(stream_router, prefix="/api")

@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{file_id}.pdf"
    
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
        
    return {"file_id": file_id}