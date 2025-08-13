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
uvicorn app:app --reload
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

## Contributing

Pull requests and issues are welcome. Please run linters and tests where available before submitting changes.

