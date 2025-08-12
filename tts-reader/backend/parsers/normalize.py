import logging
import re
import spacy
from core.config import SPACY_MODEL

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    nlp = spacy.load(SPACY_MODEL)
except OSError:
    logger.warning(f"SpaCy model '{SPACY_MODEL}' not found. Downloading...")
    spacy.cli.download(SPACY_MODEL)
    nlp = spacy.load(SPACY_MODEL)

def normalize_blocks(blocks):
    """
    Normalizes text in each block and performs sentence segmentation.
    """
    for block in blocks:
        if "text" in block:
            # Basic text cleaning
            text = _clean_text(block["text"])
            
            # Sentence segmentation
            doc = nlp(text)
            sentences = []
            for sent in doc.sents:
                sentences.append({
                    "text": sent.text.strip(),
                    "start_char": sent.start_char,
                    "end_char": sent.end_char,
                })
            block["text"] = text
            block["sentences"] = sentences
            
    logger.info("Normalized and segmented sentences for all blocks.")
    return blocks

def _clean_text(text):
    """
    Applies various text cleaning rules.
    """
    # Replace common ligatures
    text = text.replace("ﬁ", "fi").replace("ﬂ", "fl")
    
    # Normalize smart quotes and dashes (simple version)
    text = text.replace("“", '"').replace("”", '"')
    text = text.replace("‘", "'").replace("’", "'")
    text = text.replace("—", "--").replace("–", "-")
    
    # De-hyphenation (simple regex-based, a dictionary approach is better)
    # This is a complex problem. A simple approach is to remove hyphenation
    # at the end of a line.
    text = re.sub(r"-\n", "", text)
    
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    
    return text

# More advanced de-hyphenation would require a dictionary (e.g., using wordfreq)
# and more context about the line breaks.
