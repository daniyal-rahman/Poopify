import os
from pathlib import Path

# Base directory for the project
BASE_DIR = Path(__file__).resolve().parent.parent

# Path to the TTS model checkpoint
TTS_MODEL_PATH = os.environ.get("TTS_MODEL_PATH", "tts_models/en/ljspeech/vits")

# Path to the spaCy model
SPACY_MODEL = os.environ.get("SPACY_MODEL", "en_core_web_sm")

# Upload directory for files
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Constants for layout parsing
COLUMN_MIN_SPACING_RATIO = 0.15  # of page width
HEADER_FOOTER_HEIGHT_RATIO = 0.15  # of page height
HEADER_FOOTER_MIN_PAGES_RATIO = 0.6
CAPTION_PROXIMITY_X_RATIO = 0.2  # of figure width
CAPTION_PROXIMITY_Y_RATIO = 0.5  # of median line height

# Sentence chunking target duration (in milliseconds)
SENTENCE_CHUNK_TARGET_MS = 300

# Audio crossfade duration (in milliseconds)
AUDIO_CROSSFADE_MS = 15

# Playback speed limits
MIN_SYNTHESIS_RATE = 0.8
MAX_SYNTHESIS_RATE = 2.0
MIN_PLAYBACK_RATE = 0.8
MAX_PLAYBACK_RATE = 2.5
