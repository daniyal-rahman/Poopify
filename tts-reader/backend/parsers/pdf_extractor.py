import fitz  # PyMuPDF
from pdfminer.high_level import extract_pages as pdfminer_extract_pages
from pdfminer.layout import LTTextContainer, LTChar
import logging
from pathlib import Path
from core.config import UPLOAD_DIR

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def extract_pages(file_id: str):
    """
    Extracts text and layout information from a PDF file.
    Uses PyMuPDF as the primary extractor and pdfminer.six for reconciliation if needed.
    """
    file_path = UPLOAD_DIR / f"{file_id}.pdf"
    if not file_path.exists():
        logger.error(f"File not found: {file_path}")
        return []

    doc = fitz.open(file_path)
    pages = []
    for page_num, page in enumerate(doc):
        # Using "rawdict" to get detailed information including spans and characters
        raw_dict = page.get_text("rawdict")
        pages.append({
            "page_num": page_num,
            "width": raw_dict["width"],
            "height": raw_dict["height"],
            "blocks": raw_dict["blocks"],
            "rotation": page.rotation,
        })
    logger.info(f"Extracted {len(pages)} pages from {file_id} using PyMuPDF.")
    return pages

def _detect_scanned_pdf(page):
    """
    Heuristically detects if a PDF page is scanned.
    """
    # A simple heuristic: if the number of characters is very low but there are images,
    # it's likely a scanned page.
    text = page.get_text()
    images = page.get_images(full=True)
    if len(text.strip()) < 100 and len(images) > 0:
        # Further check image coverage
        total_image_area = sum(img[2] * img[3] for img in images)
        page_area = page.rect.width * page.rect.height
        if page_area > 0 and total_image_area / page_area > 0.6:
            return True
    return False

# Note: The full implementation of pdfminer reconciliation and other features
# from the brief will be added progressively.
