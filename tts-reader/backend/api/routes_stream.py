from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from tts.engine import TTS
from tts.stream import stream_sentences
from database import DOC_DATA
import logging

router = APIRouter()
tts_engine = TTS()
log = logging.getLogger(__name__)

@router.websocket("/stream")
async def stream(ws: WebSocket):
    await ws.accept()
    try:
        cfg = dict(ws.query_params)
        if "doc_id" not in cfg:
            try:
                cfg = await ws.receive_json()
            except Exception:
                await ws.close(code=1008, reason="Missing initial config (doc_id)")
                return

        doc_id = cfg.get("doc_id")
        if not doc_id or doc_id not in DOC_DATA:
            await ws.close(code=1008, reason=f"Unknown doc_id: {doc_id}")
            return

        await ws.send_json({"type": "ready", "doc_id": doc_id})

        await stream_sentences(ws, tts_engine, DOC_DATA[doc_id], cfg)

        await ws.close(code=1000, reason="done")

    except WebSocketDisconnect:
        log.info("Client disconnected")
    except Exception as e:
        log.exception("WS stream error: %s", e)
        try:
            await ws.close(code=1011, reason="internal error")
        except Exception:
            pass
