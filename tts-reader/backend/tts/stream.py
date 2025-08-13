import asyncio
import json
import logging
from fastapi import WebSocket
import numpy as np

from .providers.exceptions import RateLimitedError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_sentences_in_order(doc_data: dict, reading_order: list, start_index: int):
    blocks_by_id = {b['id']: b for b in doc_data.get('blocks', [])}
    for block_id in reading_order[start_index:]:
        block = blocks_by_id.get(block_id)
        if not block:
            continue
        if block.get('policy') != 'read':
            continue
        for s_idx, s in enumerate(block.get('sentences', [])):
            yield {"id": f"{block_id}_s{s_idx}", "text": s['text']}

# Canonical server format
SR = 48000
FRAME_MS = 20
SAMPLES_PER_FRAME = SR * FRAME_MS // 1000  # 960

async def stream_sentences(ws: WebSocket, tts_engine, doc_data: dict, config: dict):
    """
    Stream audio as binary PCM16 (LE, mono, 48 kHz) in ~20 ms frames + small JSON marks.
    The route handler should have already called `await ws.accept()`.
    """
    reading_order = config.get("reading_order") or doc_data.get("reading_order") or [
        b["id"] for b in doc_data.get("blocks", []) if b.get("role") in ("title", "heading", "body", "list_item", "quote")
    ]
    rate = float(config.get("rate", 1.0))  # client handles tempo; kept for future API
    start_index = int(config.get("start_index", 0))

    gen = get_sentences_in_order(doc_data, reading_order, start_index)
    loop = asyncio.get_running_loop()
    seq = 0

    # One-time hello (client can log SR)
    try:
        await ws.send_text(json.dumps({"type": "hello", "sample_rate": SR}))
    except Exception:
        pass

    for sentence in gen:
        try:
            # Non-blocking control read (future use)
            try:
                msg = await asyncio.wait_for(ws.receive_json(), timeout=0.0)
                if msg.get("type") == "control" and "rate" in msg:
                    rate = float(msg["rate"])
                    logger.info(f"Updated (unused) server rate → {rate}")
            except asyncio.TimeoutError:
                pass
            except Exception:
                pass

            # Synthesize off-thread to keep WS loop snappy
            try:
                audio_data: np.ndarray = await loop.run_in_executor(
                    None, tts_engine.synthesize, sentence["text"], rate
                )
            except RateLimitedError:
                # Graceful fallback on 429: short silence + explicit mark
                silent = np.zeros(SAMPLES_PER_FRAME, dtype=np.int16)
                await ws.send_bytes(silent.tobytes())
                await ws.send_text(json.dumps({
                    "type": "mark",
                    "sentence_id": sentence["id"],
                    "status": "rate_limited",
                    "seq": seq,
                    "sample_rate": SR,
                    "num_samples": int(silent.size),
                }))
                seq += 1
                await asyncio.sleep(0)
                continue

            if audio_data is None or audio_data.size == 0:
                # Keep timing smooth with a minimal silent frame
                silent = np.zeros(SAMPLES_PER_FRAME, dtype=np.int16)
                await ws.send_bytes(silent.tobytes())
                await ws.send_text(json.dumps({
                    "type": "mark",
                    "sentence_id": sentence["id"],
                    "status": "empty",
                    "seq": seq,
                    "sample_rate": SR,
                    "num_samples": int(silent.size),
                }))
                seq += 1
                await asyncio.sleep(0)
                continue

            # Chunk into ~20 ms frames and stream
            total = int(audio_data.size)
            for i in range(0, total, SAMPLES_PER_FRAME):
                frame = audio_data[i:i + SAMPLES_PER_FRAME]
                await ws.send_bytes(frame.tobytes())
                # Optional: near-real-time pacing
                # await asyncio.sleep(FRAME_MS / 1000)

            await ws.send_text(json.dumps({
                "type": "mark",
                "sentence_id": sentence["id"],
                "status": "done",
                "seq": seq,
                "sample_rate": SR,
                "num_samples": total,
            }))
            seq += 1

            await asyncio.sleep(0)

        except Exception as e:
            logger.error(f"Error during sentence streaming: {e}")
            break

    logger.info("Finished streaming sentences.")
