# Gold Standard Set

This directory is for the evaluation of the document parsing pipeline.

## `docs/`

The `docs/` subdirectory should contain 20-50 sample PDF documents that represent a variety of layouts (e.g., single-column, two-column, academic papers, news articles, reports).

These documents are the input to the parsing pipeline.

## `annotations/` (to be created)

For a subset of the documents in `docs/`, we will create "gold standard" annotations. These annotations will be stored in JSON files, with one file per document. Each JSON file should contain:

-   **`reading_order`**: A list of block IDs in the correct reading order.
-   **`skipped_blocks`**: A list of block IDs that should be skipped (e.g., headers, footers, page numbers, irrelevant sidebars).
-   **`sentences`**: For a few key paragraphs, the exact sentence segmentation to evaluate sentence integrity.

This data needs to be created manually by a human annotator.
