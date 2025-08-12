import asyncio
import logging
import base64
from fastapi import WebSocket

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_sentences_in_order(doc_data: dict, reading_order: list, start_index: int):
    """Generator to yield sentences in the specified reading order."""
    blocks_by_id = {block['id']: block for block in doc_data['blocks']}
    
    for block_id in reading_order[start_index:]:
        block = blocks_by_id.get(block_id)
        if block and block.get('policy') == 'read' and 'sentences' in block:
            for s_idx, sentence in enumerate(block['sentences']):
                yield {
                    "id": f"{block_id}_s{s_idx}",
                    "text": sentence['text']
                }

async def stream_sentences(ws: WebSocket, tts_engine, doc_data: dict, config: dict):
    """
    Streams synthesized audio for sentences over a WebSocket connection.
    """
    reading_order = config.get("reading_order", [])
    rate = config.get("rate", 1.0)
    start_index = config.get("start_index", 0)

    sentence_generator = get_sentences_in_order(doc_data, reading_order, start_index)

    for i, sentence in enumerate(sentence_generator):
        try:
            # Check for control messages from the client
            try:
                msg = await asyncio.wait_for(ws.receive_json(), timeout=0.01)
                if msg.get("type") == "control":
                    new_rate = msg.get("rate")
                    if new_rate:
                        rate = new_rate
                        logger.info(f"Updated TTS rate to: {rate}")
            except asyncio.TimeoutError:
                pass # No message from client, continue

            # Synthesize audio
            audio_data = tts_engine.synthesize(sentence["text"], rate=rate)
            
            if audio_data is not None and audio_data.any():
                # Encode PCM16 data as Base64
                pcm16_base64 = base64.b64encode(audio_data.tobytes()).decode('utf-8')
                
                # Send audio chunk
                await ws.send_json({
                    "type": "audio",
                    "seq": i,
                    "pcm16_base64": pcm16_base64,
                    "sentence_id": sentence["id"],
                    "t_start": 0.0, # Placeholder
                    "t_end": len(audio_data) / 22050.0 # Placeholder, assumes 22050Hz sample rate
                })
                
                # Send mark when done
                await ws.send_json({
                    "type": "mark",
                    "sentence_id": sentence["id"],
                    "status": "done"
                })
                
            await asyncio.sleep(0.1) # Small delay to prevent flooding

        except Exception as e:
            logger.error(f"Error during sentence streaming: {e}")
            break
            
    logger.info("Finished streaming sentences.")
