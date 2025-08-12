#!/bin/bash
# This script downloads the necessary models for the TTS and NLP components.

# 1. Download spaCy model
echo ">>> Downloading spaCy model (en_core_web_sm)..."
python -m spacy download en_core_web_sm

# 2. Download Coqui TTS model
# The TTS library will download the model on first use, but we can pre-cache it.
# We are using a VITS model as requested.
echo ">>> Caching Coqui TTS model (tts_models/en/ljspeech/vits)..."
# Create a dummy python script to trigger the download
cat <<EOF > /tmp/cache_tts.py
from TTS.api import TTS
try:
    print("Loading and caching TTS model...")
    tts = TTS("tts_models/en/ljspeech/vits", progress_bar=True)
    print("Model cached successfully.")
except Exception as e:
    print(f"An error occurred: {e}")
    print("Please check your internet connection and TTS library installation.")
EOF
python /tmp/cache_tts.py
rm /tmp/cache_tts.py

# 3. (Optional) Download Detectron2 layout model
# This is commented out as we are using the heuristics-based approach.
# To enable, you would need to install detectron2 and uncomment these lines.
# echo ">>> (Optional) Downloading Detectron2 model..."
# wget https://layout-parser.github.io/models/detectron2/publaynet_G_2000000.pth -P models/

echo ">>> Model download script finished."
