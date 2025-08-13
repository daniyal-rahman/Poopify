import io
import time
import random
import numpy as np
from gtts import gTTS
from pydub import AudioSegment

from .base import TTSProvider
from .exceptions import RateLimitedError

TARGET_SR = 48000
TARGET_CH = 1
TARGET_WIDTH = 2  # 16-bit

class GTTSProvider(TTSProvider):
    """
    gTTS + pydub normalizing to 48k mono Int16.
    Includes simple exponential backoff on transient failures / 429s.
    """

    def __init__(self, max_retries: int = 4):
        self.max_retries = max_retries

    def _synth_once(self, text: str) -> np.ndarray:
        fp = io.BytesIO()
        tts = gTTS(text=text, lang='en', slow=False)
        tts.write_to_fp(fp)
        fp.seek(0)

        audio = AudioSegment.from_file(fp, format="mp3")
        audio = (
            audio
            .set_channels(TARGET_CH)
            .set_frame_rate(TARGET_SR)
            .set_sample_width(TARGET_WIDTH)
        )
        pcm = np.frombuffer(audio.raw_data, dtype=np.int16)
        return pcm

    def synth(self, text: str, voice: str = "default") -> np.ndarray:
        last_err = None
        for attempt in range(self.max_retries):
            try:
                return self._synth_once(text)
            except Exception as e:
                msg = str(e).lower()
                last_err = e
                if "429" in msg or "too many requests" in msg:
                    sleep = (0.5 * (2 ** attempt)) + random.uniform(0.0, 0.25)
                    time.sleep(min(sleep, 8.0))
                    continue
                sleep = (0.3 * (2 ** attempt)) + random.uniform(0.0, 0.2)
                time.sleep(min(sleep, 4.0))
                continue
        raise RateLimitedError(str(last_err) if last_err else "TTS rate limited")
