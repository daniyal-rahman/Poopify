import asyncio
import logging
from fastapi import WebSocket

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


async def stream_sentences(ws: WebSocket, tts_engine, doc_data: dict, config: dict):
    """
    Stream audio as **binary PCM16** frames (little-endian, mono, 22050 Hz) followed by small JSON marks.
    Client must set `ws.binaryType = 'arraybuffer'` and treat string frames as control/marks.
    """
    # 1) Defaults
    reading_order = config.get("reading_order") or doc_data.get("reading_order") or [
        b["id"] for b in doc_data.get("blocks", []) if b.get("role") in ("title", "heading", "body", "list_item", "quote")
    ]
    rate = float(config.get("rate", 1.0))
    start_index = int(config.get("start_index", 0))

    gen = get_sentences_in_order(doc_data, reading_order, start_index)

    loop = asyncio.get_running_loop()
    seq = 0

    for sentence in gen:
        try:
            # 2) Non-blocking control channel (don't stall the synth path)
            try:
                msg = await asyncio.wait_for(ws.receive_json(), timeout=0.0)
                if msg.get("type") == "control" and "rate" in msg:
                    rate = float(msg["rate"])
                    logger.info(f"Updated TTS rate → {rate}")
            except asyncio.TimeoutError:
                pass
            except Exception:
                # Ignore non-JSON (binary) messages from client
                pass

            # 3) Synthesize in a thread to avoid blocking WS loop
            audio_data = await loop.run_in_executor(
                None, tts_engine.synthesize, sentence["text"], rate
            )

            if audio_data is None or audio_data.size == 0:
                # Send ~20ms of silence so the client’s ring buffer advances cleanly
                import numpy as np
                silent = np.zeros(441, dtype=np.int16)  # 22050 Hz * 0.02s
                await ws.send_bytes(silent.tobytes())
                await ws.send_json({"type": "mark", "sentence_id": sentence["id"], "status": "done"})
                seq += 1
                continue

            # >>> Send raw PCM16 little-endian mono at 22050 Hz as a BINARY frame
            await ws.send_bytes(audio_data.tobytes())

            # Optional: timing/metadata as a small TEXT frame
            await ws.send_json({
                "type": "mark",
                "sentence_id": sentence["id"],
                "status": "done",
                "seq": seq,
                "sample_rate": 22050,
                "num_samples": int(audio_data.size),
            })
            seq += 1

            await asyncio.sleep(0)  # yield control, keep loop snappy

        except Exception as e:
            logger.error(f"Error during sentence streaming: {e}")
            break

    logger.info("Finished streaming sentences.")
