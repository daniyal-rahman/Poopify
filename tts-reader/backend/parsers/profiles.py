import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def apply_profile(blocks, profile: str, include_captions: bool = False):
    """
    Applies a reading profile to a list of blocks, modifying their 'policy'.
    """
    logger.info(f"Applying profile: '{profile}', include_captions: {include_captions}")
    
    for block in blocks:
        # Default policy is to read
        block["policy"] = "read"
        
        # General rules
        if block["role"] in ["header", "footer", "pagenum"]:
            block["policy"] = "skip"
        
        if block["role"] == "caption" and not include_captions:
            block["policy"] = "skip"
            
        # Profile-specific rules
        if profile == "academic":
            _apply_academic_profile(block)
        elif profile == "news":
            _apply_news_profile(block)
        elif profile == "report":
            _apply_report_profile(block)
            
    return blocks

def _apply_academic_profile(block):
    """
    Rules for academic papers.
    This requires more semantic role labeling than we currently have.
    These are placeholder rules.
    """
    # Example: if we could identify affiliations or references sections
    # if "affiliation" in block["semantic_role"]:
    #     block["policy"] = "skip"
    pass

def _apply_news_profile(block):
    """
    Rules for news articles.
    """
    # Example: skip bylines if they are identified
    # if block["role"] == "byline":
    #     block["policy"] = "skip"
    pass

def _apply_report_profile(block):
    """
    Rules for generic reports.
    """
    # Example: skip legal boilerplate if identified
    # if "legal" in block["semantic_role"]:
    #     block["policy"] = "skip"
    pass
