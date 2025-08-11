# Poopify


---

# Build Brief: “Layout-Aware TTS Reader” (Speechify-style MVP)

## Context

We’re building an **open-source Speechify competitor** focused on two pillars:

1. **Document-aware parsing** (correct reading order, skip junk like captions/headers/footers, handle multi-column PDFs, academic papers, news layouts, and scanned docs).
2. **Low-latency TTS** using a **lightweight VITS variant (MB-iSTFT-VITS)** with streaming playback and user speed control.

Target platforms for MVP: **Web** (React) + **Python backend (FastAPI)**. Aim for first-audio ≤ **200 ms** and smooth streaming.

---

## Non-Negotiable Requirements (MVP)

* Upload **PDF** (native + scanned); stub endpoints for **EPUB/DOCX/HTML** (parse later).
* Correct **reading order** for single/2-column PDFs.
* Default: **skip** headers/footers/page numbers/captions; user can toggle “include captions.”
* Produce **sentence-level chunks** (≈200–400 ms audio) with timestamps for highlight-while-reading.
* **Streaming** audio to browser (WebSocket) + **WebAudio** playback; seamless chunk crossfade.
* **Speed control** at playback (time-stretch without pitch change) + synthesis-time rate parameter for next chunks.
* Local TTS: start with **Coqui TTS** and plug in **MB-iSTFT-VITS** model; expose a `rate` knob.
* Works on CPU; if GPU present, use it automatically.
* Test corpus + basic evaluation: order accuracy, skip precision/recall, sentence integrity.

---

## Tech Stack (pick these)

* **Backend**: Python 3.11, **FastAPI**, **uvicorn**, **pydantic**, **websockets**.
* **Parsing**: **PyMuPDF (fitz)** primary, **pdfminer.six** secondary reconciliation, optional **PaddleOCR** for scans.
* **Layout**: **layoutparser** + **Detectron2** (provide CPU fallback heuristics if model missing).
* **NLP**: **spaCy** (en\_core\_web\_sm), **wordfreq** (hyphen fix), regex for normalization.
* **TTS**: **coqui-ai/TTS** with **MB-iSTFT-VITS** checkpoint (configurable path).
* **Frontend**: React + Vite (or Next.js), WebSocket client, **WebAudio** (AudioWorklet) + **soundtouch.js** (or custom phase-vocoder) for time-stretch.

---

## Project Structure

```
tts-reader/
  backend/
    app.py
    core/config.py
    parsers/
      pdf_extractor.py
      ocr.py
      layout_model.py
      layout_heuristics.py
      order_graph.py
      normalize.py
      profiles.py
    tts/
      engine.py
      stream.py
    api/
      routes_parse.py
      routes_stream.py
    eval/
      metrics.py
      goldset/
        README.md
        docs/  # place 20-50 sample PDFs here
  frontend/
    src/
      App.tsx
      components/Upload.tsx
      components/Reader.tsx
      audio/Player.ts
      audio/TimeStretchWorkletProcessor.js
      api.ts
    index.html
    vite.config.ts
  scripts/
    download_models.sh
  README.md
```

---

## Backend Contracts

### 1) Parse endpoint (HTTP)

`POST /parse`

* Body: `{ "file_id": "<uuid returned by /upload>", "profile": "academic"|"news"|"report", "include_captions": false }`
* Returns:

```json
{
  "doc_id": "uuid",
  "blocks": [
    {
      "id": "b12",
      "role": "body|heading|list_item|quote|caption|table|figure|sidebar|header|footer|pagenum",
      "text": "Paragraph text ...",
      "bbox": [x0,y0,x1,y1],
      "page": 3,
      "column": 0,
      "confidence": 0.91,
      "policy": "read|skip|summarize",
      "sentences": [
        {"text":"Sentence 1.","start_char":0,"end_char":11},
        {"text":"Sentence 2.","start_char":12,"end_char":23}
      ]
    }
  ],
  "reading_order": ["b1","b4","b7","b12", "..."]
}
```

### 2) Stream TTS (WebSocket)

`WS /stream`

* Client sends:

```json
{
  "doc_id":"uuid",
  "reading_order":["b1","b4", "..."],
  "rate":1.4,
  "voice":"default",
  "start_index":0
}
```

* Server streams frames/chunks:

```json
{ "type":"audio", "seq":0, "pcm16_base64":"...", "sentence_id":"s_023", "t_start":0.0, "t_end":0.35 }
{ "type":"mark",  "sentence_id":"s_023", "status":"done" }
```

* Supports **mid-stream** `{"type":"control","rate":1.6}`—apply to next chunks.

---

## Parsing Pipeline (B & C hardened)

### pdf\_extractor.py (low-level)

* Dual extraction:

  * `fitz_page.get_text("rawdict")` → spans/lines with coords, font, rotation.
  * If sparse/broken: use **pdfminer** text → re-map to fitz boxes via alignment.
* Scanned detection:

  * If char density < threshold and image coverage > 60% → OCR path.
* Normalize:

  * Un-rotate page + span directions, normalize to top-left origin.
  * Merge words/lines with thresholds (x-gap < 0.3× median char width).
  * De-hyphenate if (end `-` + next token forms dictionary word).
  * Drop invisible/duplicate overlay text; keep drawings/images bboxes.

### ocr.py

* Rasterize page 220–300 DPI → **PaddleOCR**.
* Keep line/word boxes + reading order.
* Emit spans compatible with extractor output (`source="ocr"`).

### layout\_model.py

* Optional Detectron2 model (DocLayNet/PubLayNet-finetuned).
* Classes: title, heading, body\_text, caption, figure, table, list, sidebar, footnote, header, footer, pagenum.
* Return class labels + bboxes per page. If model unavailable → return `None`.

### layout\_heuristics.py (CPU fallback / complement)

* Build blocks from lines (font size similarity, y-gaps, left edge alignment).
* **Column detection**:

  * GMM (k=1..3) on block x-centroids with BIC selection; min centroid spacing 0.15×page width.
* Header/footer/page number removal:

  * Hash text+rounded bbox; if appears on >60% pages in top/bottom 15% height → mark header/footer; page number regex.
* Figure/table-caption association:

  * Below/above proximity rules; mark captions `policy=skip` by default.

### order\_graph.py

* Build DAG of blocks (exclude header/footer/caption unless `include_captions=true`).
* Edge score = vertical proximity + same-column bonus + horizontal overlap + font continuity.
* Topological sort; tie-break by (column, y, x).
* Page-to-page: finish columns L→R, then next page; merge cross-page broken paragraphs (indent + missing end-punct).

### normalize.py

* Text cleanup: ligatures, smart quotes, em/en dashes.
* Number/unit expansion (basic): “3 mg/mL” → “three milligrams per milliliter.”
* Sentence segmentation with `spaCy`; produce sentence spans aligned to block text.

### profiles.py

* Policies by `profile`:

  * **academic**: read Abstract/Intro/Results/Discussion/Conclusion; skip Affiliations/References/Acks/Supp; captions off by default.
  * **news**: read title/subhead/body; skip bylines/photo credits/pull-quotes unless inline.
  * **report**: read headings/body/lists; skip boilerplate/legal footers.
* Optional: “summarize figures” (replace caption text with short “Figure about …” placeholder).

---

## TTS Integration

### engine.py

* Initialize Coqui TTS with **MB-iSTFT-VITS** checkpoint (path via env).
* `synthesize(text: str, rate: float, voice: str) -> np.int16` (mono 22.05k/24k).
* Rate → set model duration/pause scaling; clamp 0.8×–2.0× for quality.
* Sentence-by-sentence synth; return PCM16 buffers.

### stream.py

* WebSocket server:

  * For each sentence in reading order: synthesize → encode base64 → send.
  * Maintain **2–3 sentence buffer** ahead; apply new `rate` to future sentences.
  * Crossfade at boundaries client-side (send `t_end` for alignment).

---

## Frontend (React)

### Upload.tsx

* POST file to `/upload` → returns `file_id`.
* Call `/parse` (profile + include\_captions).
* Show **Outline** (headings, sections, sentence counts).

### Reader.tsx

* Connect `WS /stream` with `doc_id`, `reading_order`, `rate`.
* **Speed slider** 0.8×–2.5×:

  * Send control message for synthesis-time rate (future chunks).
  * Apply **time-stretch** in the AudioWorklet for already-buffered audio.
* Word/line highlight:

  * Use sentence `mark` messages to sync caret in the text view.

### audio/Player.ts & TimeStretchWorkletProcessor.js

* Ring buffer fed by WS chunks.
* Phase-vocoder or SoundTouch algorithm for **pitch-preserving** time-stretch.
* Simple **crossfade** (10–20 ms) between chunks.

---

## Scripts & Model Setup

### scripts/download\_models.sh

* Download Coqui TTS + MB-iSTFT-VITS checkpoint.
* (Optional) Download Detectron2 layout model weights.
* Cache spaCy model.

---

## Minimal Code Stubs (start points)

### backend/app.py

```python
from fastapi import FastAPI, UploadFile, WebSocket, WebSocketDisconnect
from api.routes_parse import router as parse_router
from api.routes_stream import router as stream_router

app = FastAPI(title="Layout-Aware TTS Reader")
app.include_router(parse_router, prefix="/api")
app.include_router(stream_router, prefix="/api")

@app.post("/api/upload")
async def upload(file: UploadFile):
    # Save to disk, return file_id
    ...
```

### backend/api/routes\_parse.py

```python
from fastapi import APIRouter
from parsers.pdf_extractor import extract_pages
from parsers.layout_model import detect_layout
from parsers.layout_heuristics import build_blocks_and_roles, build_reading_order
from parsers.normalize import normalize_blocks
from parsers.profiles import apply_profile

router = APIRouter()

@router.post("/parse")
def parse(req: dict):
    pages = extract_pages(req["file_id"])
    layout = detect_layout(pages)  # may be None; we have heuristics fallback
    blocks = build_blocks_and_roles(pages, layout)
    blocks = normalize_blocks(blocks)
    blocks = apply_profile(blocks, profile=req.get("profile","academic"),
                           include_captions=req.get("include_captions", False))
    order = build_reading_order(blocks)
    return {"doc_id": req["file_id"], "blocks": blocks, "reading_order": order}
```

### backend/api/routes\_stream.py

```python
from fastapi import APIRouter, WebSocket
from tts.engine import TTS
from tts.stream import stream_sentences

router = APIRouter()
tts = TTS()

@router.websocket("/stream")
async def stream(ws: WebSocket):
    await ws.accept()
    cfg = await ws.receive_json()
    async for msg in stream_sentences(ws, tts, cfg):
        await ws.send_json(msg)
```

---

## Heuristic Defaults (tune later)

* De-hyphenate only if concat is dictionary word or next token starts lowercase.
* Column centers min spacing: **0.15× page width**.
* Header/footer zone: **top/bottom 15%** of page height; repeated on **>60%** pages → drop.
* Caption association: within **±20%** figure width and within **0.5×** median line height below (or above).
* Sentence chunk target duration: **200–400 ms**.
* Crossfade: **15 ms**.
* Playback speed limits: UI 0.8×–2.5×; synthesis 0.8×–2.0×.

---

## Evaluation (MVP)

* Put 30–50 PDFs into `backend/eval/goldset/docs/` (mix: arXiv/PMC, newspapers, reports).
* Hand-label “gold” reading order for 10 docs (lightweight).
* Metrics:

  * **Adjacency accuracy** (correct next-block %),
  * **Skip precision/recall** for headers/footers/captions,
  * **Sentence integrity** (% sentences without mid-sentence intrusions).

Add a `backend/eval/metrics.py` CLI to print metrics; add `make eval`.

---

## Deliverables (what the LLM should output now)

1. **Working FastAPI backend** with the modules above, including dual PDF extraction, heuristics, and TTS streaming stub.
2. **React frontend** with upload, outline viewer, streaming player, speed control, and text highlighting.
3. **Scripts** to download models and run the stack locally (CPU).
4. **README** with quickstart, expected latency, and how to add GPU + Detectron2.
5. **Tests** for:

   * Hyphenation & ligature normalization,
   * Header/footer de-dup,
   * Two-column order on sample doc,
   * Skip captions toggle behavior.

---

## Stretch (if time permits)

* Simple **figure/table summarizer** (rule-based 1-liner).
* **Pronunciation dictionary** (YAML) + overrides.
* **EPUB/HTML ingestion** (use native DOM structure; skip layout model).
* **On-device** packaging notes (WebAssembly TTS later).

---

### Instructions to the LLM

* Generate the **full repo** with the structure above.
* Provide **working code** stubs where feasible (don’t leave TODOs everywhere).
* Include **clear comments** and **docstrings**.
* Prefer **deterministic thresholds** behind constants for easy tuning.
* Where a heavy model (Detectron2) is optional, implement **graceful fallback** to heuristics.
* Ensure the app **runs on CPU only** out of the box; detect GPU if available.

---

If you want, I can tailor this brief for **Docker + compose** (backend, front-end, nginx) or add **Core ML/NNAPI** notes for an on-device mobile POC next.
