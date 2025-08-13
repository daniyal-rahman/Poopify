import logging
import numpy as np
from typing import Optional

from .providers.gtts_provider import GTTSProvider
from .providers.exceptions import RateLimitedError
from .cache import get as cache_get, put as cache_put

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TTS:
    """
    Thin orchestration layer:
      - First check cache.
      - Else call provider (returns PCM16 @ 48k mono).
      - On success, write to cache.
      - On provider RateLimitedError, bubble up (streamer will handle).
    """

    def __init__(self, provider: Optional[object] = None):
        self.provider = provider or GTTSProvider()

    def synthesize(self, text: str, rate: float = 1.0, voice: str = "default") -> np.ndarray:
        # We deliberately ignore `rate` here; tempo is client-side to preserve pitch.
        text_norm = text.strip()
        if not text_norm:
            return np.zeros(0, dtype=np.int16)

        # 1) Cache first
        cached = cache_get(text_norm, voice)
        if cached is not None:
            return cached

        # 2) Provider
        try:
            pcm = self.provider.synth(text_norm, voice=voice)
            if pcm is None or pcm.size == 0:
                return np.zeros(0, dtype=np.int16)
            # 3) Save cache
            cache_put(text_norm, pcm, voice)
            return pcm
        except RateLimitedError as e:
            # Surface for the stream loop to tag the mark as rate_limited
            logger.warning(f"TTS rate-limited for text: '{text_norm[:50]}...' : {e}")
            raise
        except Exception as e:
            logger.error(f"TTS synth failed for text: '{text_norm[:50]}...' : {e}")
            return np.zeros(0, dtype=np.int16)
