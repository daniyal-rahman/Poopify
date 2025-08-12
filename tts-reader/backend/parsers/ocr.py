import logging
from PIL import Image
from pathlib import Path
# Conditional import for PaddleOCR
try:
    from paddleocr import PaddleOCR
except ImportError:
    PaddleOCR = None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def ocr_page(image: Image.Image):
    """
    Performs OCR on a single page image using PaddleOCR.
    """
    if PaddleOCR is None:
        logger.warning("PaddleOCR is not installed. OCR functionality is disabled.")
        return []

    # Initialize PaddleOCR. Note: This can be slow on first run.
    # It's better to initialize it once in the application's lifecycle.
    ocr_engine = PaddleOCR(use_angle_cls=True, lang='en')
    
    # The result will be a list of [bbox, (text, confidence)]
    result = ocr_engine.ocr(image, cls=True)
    
    spans = []
    if result:
        for line in result[0]:
            box, (text, conf) = line
            # Convert bbox to [x0, y0, x1, y1]
            x0, y0 = box[0]
            x1, y1 = box[2]
            spans.append({
                "text": text,
                "bbox": [x0, y0, x1, y1],
                "confidence": conf,
                "source": "ocr"
            })
            
    logger.info(f"OCR processed page and found {len(spans)} text spans.")
    return spans

def rasterize_page_for_ocr(doc, page_num: int, dpi: int = 220):
    """
    Rasterizes a PDF page to an image for OCR.
    """
    page = doc.load_page(page_num)
    pix = page.get_pixmap(dpi=dpi)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    return img
