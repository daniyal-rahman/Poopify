import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from parsers.pdf_extractor import extract_pages
from parsers.layout_model import detect_layout
from parsers.layout_heuristics import build_blocks_and_roles, build_reading_order
from parsers.normalize import normalize_blocks
from parsers.profiles import apply_profile
from database import DOC_DATA

router = APIRouter()

class ParseRequest(BaseModel):
    file_id: str
    profile: str = "academic"
    include_captions: bool = False

@router.post("/parse")
def parse(req: ParseRequest):
    try:
        pages = extract_pages(req.file_id)
        if not pages:
            raise HTTPException(status_code=404, detail="PDF file not found or failed to extract pages.")
            
        layout = detect_layout(pages)
        blocks = build_blocks_and_roles(pages, layout)
        blocks = normalize_blocks(blocks)
        blocks = apply_profile(
            blocks, 
            profile=req.profile,
            include_captions=req.include_captions
        )
        order = build_reading_order(blocks)
        
        doc_id = req.file_id
        doc_result = {
            "doc_id": doc_id,
            "blocks": blocks,
            "reading_order": order
        }
        
        DOC_DATA[doc_id] = doc_result
        
        return doc_result
    except Exception as e:
        logging.exception("An error occurred during the parsing process.")
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {e}")