import logging
import numpy as np
from gtts import gTTS
from pydub import AudioSegment
import io

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TTS:
    def synthesize(self, text: str, rate: float = 1.0, voice: str = "default") -> np.ndarray:
        """
        Synthesizes text to a PCM16 audio waveform using gTTS and pydub.
        """
        try:
            # Synthesize with gTTS
            fp = io.BytesIO()
            tts = gTTS(text=text, lang='en', slow=False)
            tts.write_to_fp(fp)
            fp.seek(0)
            
            # Convert MP3 to PCM using pydub
            audio = AudioSegment.from_file(fp, format="mp3")
            
            # Set to mono and a sample rate the frontend can handle
            audio = audio.set_channels(1)
            audio = audio.set_frame_rate(22050)
            
            # Export as raw PCM data and convert to numpy array
            pcm_data = np.array(audio.get_array_of_samples(), dtype=np.int16)
            return pcm_data

        except Exception as e:
            logger.error(f"gTTS/pydub synthesis failed for text: '{text[:50]}...': {e}")

        return np.zeros(0, dtype=np.int16)
