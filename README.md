# Poopify

Poopify is an open-source, layout-aware text-to-speech reader inspired by commercial tools like Speechify. It combines a FastAPI backend with a React frontend to parse documents and stream synthesized speech.

## Features

- Upload PDF files and extract reading order using heuristics.
- Stream synthesized speech to the browser using a lightweight TTS engine.
- React interface with upload, playback, and speed control.

## Quick Start

### Backend

```bash
cd tts-reader/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --ws wsproto
# For production with uvloop:
uvicorn app:app --host 0.0.0.0 --port 8000 --loop uvloop --http h11 --ws wsproto
```

### Frontend

```bash
cd tts-reader/frontend
npm install
npm run dev
```

Open your browser at [http://localhost:5173](http://localhost:5173) to use the app.

## Project Brief

The original project specification has been moved to [docs/BUILD_BRIEF.md](docs/BUILD_BRIEF.md).

## File Structure:
tts-reader/
├── backend/
│   ├── app.py
│   ├── core/
│   │   └── config.py
│   ├── api/
│   │   ├── routes_parse.py           # POST /api/parse
│   │   └── routes_stream.py          # WS /api/stream
│   ├── database.py                   # if you persist anything
│   ├── parsers/
│   │   ├── layout_heuristics.py
│   │   ├── layout_model.py           # optional (Detectron2)
│   │   ├── normalize.py
│   │   ├── ocr.py
│   │   ├── order_graph.py
│   │   ├── pdf_extractor.py
│   │   └── profiles.py
│   ├── tts/
│   │   ├── engine.py
│   │   └── stream.py                 # backend audio stream helpers
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx                  # React root (StrictMode lives here)
│       ├── App.tsx
│       ├── api.ts                    # fetch wrappers (upload/parse)
│       ├── audio/
│       │   └── Player.ts             # soundtouchjs usage (deprecation warning)
│       ├── components/
│       │   ├── Upload.tsx            # calls upload/parse
│       │   └── Reader.tsx            # WebSocket client (fix here)
│       └── index.css / App.css
├── scripts/
│   ├── check_runtime_versions.py
│   └── download_models.sh
├── README.md
└── docs/
    ├── BUILD_BRIEF.md
    └── ISSUES_AND_FIXES.md

## Contributing

Pull requests and issues are welcome. Please run linters and tests where available before submitting changes.

