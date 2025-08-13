import logging
import numpy as np
from sklearn.mixture import GaussianMixture
from core.config import (
    COLUMN_MIN_SPACING_RATIO,
    HEADER_FOOTER_HEIGHT_RATIO,
    HEADER_FOOTER_MIN_PAGES_RATIO,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _get_text_from_rawdict_block(block: dict) -> str:
    """Extracts and reconstructs text from a rawdict block from PyMuPDF."""
    if "lines" not in block:
        return ""
    
    line_texts = []
    for line in block["lines"]:
        span_texts = []
        for span in line["spans"]:
            span_texts.append("".join(c["c"] for c in span["chars"]))
        line_texts.append("".join(span_texts))
    return "\n".join(line_texts)


def build_blocks_and_roles(pages, layout_model_output=None):
    """
    Builds text blocks from low-level page data and assigns roles using heuristics.
    """
    if layout_model_output:
        # If a layout model is used, this function would integrate its output.
        logger.info("Integrating layout model output (not implemented)")
        pass

    all_blocks = []
    for page_data in pages:
        page_width = page_data["width"]
        page_height = page_data["height"]
        
        # Simple block building: treat each block from PyMuPDF as a preliminary block
        prelim_blocks = page_data.get("blocks", [])
        
        # Column detection
        columns = _detect_columns(prelim_blocks, page_width)
        
        # Header and footer detection (needs to be done across pages, so this is a simplification)
        # A more robust implementation would analyze blocks from all pages at once.
        
        for i, block in enumerate(prelim_blocks):
            if "lines" not in block: continue
            
            bbox = block["bbox"]
            col_idx = _assign_to_column(bbox, columns)
            
            # Role assignment (very basic heuristics for now)
            role = "body"
            if _is_header_or_footer(bbox, page_height):
                role = "footer" # Simplified
            
            all_blocks.append({
                "id": f"p{page_data['page_num']}_b{i}",
                "page": page_data["page_num"],
                "bbox": bbox,
                "column": col_idx,
                "role": role,
                "text": _get_text_from_rawdict_block(block),
                "confidence": 1.0, # Heuristic-based
                "policy": "read" # Default policy
            })
            
    logger.info(f"Built {len(all_blocks)} blocks using heuristics.")
    return all_blocks

def _detect_columns(blocks, page_width):
    """
    Detects columns on a page using a Gaussian Mixture Model on block centroids.
    """
    if not blocks:
        return []
        
    centroids = np.array([(b["bbox"][0] + b["bbox"][2]) / 2 for b in blocks if "bbox" in b]).reshape(-1, 1)
    if len(centroids) < 3: # Not enough blocks to determine columns
        return [page_width / 2] if len(centroids) > 0 else []

    # Use BIC to find the best number of columns (k=1, 2, 3)
    bics = []
    for k in range(1, 4):
        gmm = GaussianMixture(n_components=k, random_state=0).fit(centroids)
        bics.append(gmm.bic(centroids))
    
    best_k = np.argmin(bics) + 1
    
    if best_k > 1:
        gmm = GaussianMixture(n_components=best_k, random_state=0).fit(centroids)
        centers = sorted(gmm.means_.flatten().tolist())
        # Filter out columns that are too close
        final_centers = [centers[0]]
        for center in centers[1:]:
            if center - final_centers[-1] > COLUMN_MIN_SPACING_RATIO * page_width:
                final_centers.append(center)
        return final_centers
    
    return [np.mean(centroids)] if len(centroids) > 0 else []

def _assign_to_column(bbox, column_centers):
    if not column_centers:
        return 0
    block_center_x = (bbox[0] + bbox[2]) / 2
    # Find the closest column center and convert to a standard Python int
    return int(np.argmin([abs(block_center_x - center) for center in column_centers]))

def _is_header_or_footer(bbox, page_height):
    """
    Checks if a block is likely a header or footer based on its vertical position.
    """
    y0, y1 = bbox[1], bbox[3]
    is_header = y1 < HEADER_FOOTER_HEIGHT_RATIO * page_height
    is_footer = y0 > (1 - HEADER_FOOTER_HEIGHT_RATIO) * page_height
    return is_header or is_footer

def build_reading_order(blocks):
    """
    Determines the reading order of blocks based on columns, and y, x coordinates.
    """
    # Simple reading order: sort by page, then column, then y-coordinate, then x-coordinate
    sorted_blocks = sorted(blocks, key=lambda b: (b["page"], b["column"], b["bbox"][1], b["bbox"][0]))
    
    # Filter out skipped blocks
    reading_order = [b["id"] for b in sorted_blocks if b.get("policy") != "skip"]
    
    logger.info(f"Determined reading order for {len(reading_order)} blocks.")
    return reading_order
