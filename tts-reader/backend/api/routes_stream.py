from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from tts.engine import TTS
from tts.stream import stream_sentences
from database import DOC_DATA

router = APIRouter()
tts_engine = TTS()

@router.websocket("/stream")
async def stream(ws: WebSocket):
    await ws.accept()
    try:
        cfg = await ws.receive_json()
        doc_id = cfg.get("doc_id")
        
        if doc_id not in DOC_DATA:
            await ws.close(code=1011, reason=f"Document with id {doc_id} not found.")
            return
            
        doc_data = DOC_DATA[doc_id]
        
        await stream_sentences(ws, tts_engine, doc_data, cfg)
            
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"An error occurred in stream: {e}")
        await ws.close(code=1011, reason="An internal error occurred.")
