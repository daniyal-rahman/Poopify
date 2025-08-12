# api/routes_stream.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from tts.engine import TTS
from database import DOC_DATA
import asyncio, logging

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


def get_sentences_in_order(doc_data: dict, reading_order: list, start_index: int):
    blocks_by_id = {b['id']: b for b in doc_data.get('blocks', [])}
    for block_id in reading_order[start_index:]:
        block = blocks_by_id.get(block_id)
        if not block or block.get('policy') != 'read':
            continue
        for s_idx, s in enumerate(block.get('sentences', [])):
            yield {"id": f"{block_id}_s{s_idx}", "text": s['text']}


async def stream_sentences(ws: WebSocket, tts_engine, doc_data: dict, config: dict):
    reading_order = config.get("reading_order") or doc_data.get("reading_order") or [
        b["id"] for b in doc_data.get("blocks", []) if b.get("role") in ("title","heading","body","list_item","quote")
    ]
    rate = float(config.get("rate", 1.0))
    start_index = int(config.get("start_index", 0))

    loop = asyncio.get_running_loop()
    gen = get_sentences_in_order(doc_data, reading_order, start_index)
    seq = 0

    while True:
        try:
            sentence = next(gen)
        except StopIteration:
            break

        # non-blocking control channel
        try:
            msg = await asyncio.wait_for(ws.receive_json(), timeout=0.0)
            if msg.get("type") == "control" and "rate" in msg:
                rate = float(msg["rate"])
        except asyncio.TimeoutError:
            pass
        except Exception:
            pass

        # synth in threadpool; MUST return np.int16 mono at 22050 Hz
        audio_i16 = await loop.run_in_executor(None, tts_engine.synthesize, sentence["text"], rate)

        if getattr(audio_i16, "dtype", None) is None or audio_i16.dtype != "int16":
            # last line of defense if engine returns float32
            import numpy as np
            audio_i16 = (np.clip(audio_i16, -1.0, 1.0) * 32767).astype(np.int16)

        await ws.send_bytes(audio_i16.tobytes())
        await ws.send_json({"type":"mark","sentence_id":sentence["id"],"status":"done","seq":seq,"sample_rate":22050})
        seq += 1
        await asyncio.sleep(0)
