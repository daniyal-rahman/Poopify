# Poopify Chrome Extension MVP

This document describes the structure, design decisions, and flow of the Poopify text-to-speech Chrome extension prototype that lives under `clients/extension/`.

## Overview

The extension provides two ways to play text using the Poopify TTS daemon:

1. **Context menu** – Right–click a text selection and choose "Read selection with Poopify".
2. **Popup UI** – Use the extension action popup to paste text, adjust playback rate/voice, and play/stop.

Audio is streamed from a local FastAPI daemon (`ws://127.0.0.1:8000/api/stream`) and rendered with WebAudio in the current tab. If the daemon is unreachable the extension falls back to the browser Web Speech API.

## Project Structure

```
clients/extension/
  manifest.json       -- Manifest V3 definition
  background.ts/js    -- Service worker orchestrating TTS sessions
  content.ts/js       -- Content script hosting the audio player
  popup.ts/js         -- Popup logic for pasted text playback and settings
  popup.html          -- Popup markup
  utils/audio.ts/js   -- Shared WebAudio utilities and AudioPlayer
  tsconfig.json       -- Build configuration for TypeScript
```

TypeScript sources (`.ts`) are compiled to plain JavaScript (`.js`) using `tsc` without a bundler to keep the setup simple.

> **Note:** Compiled `.js` files and icon assets are intentionally left out of version control. See [Local Setup](#local-setup) for instructions on generating them.

## Runtime Architecture

### Background Service Worker (`background.ts`)
- Creates the context menu on installation.
- Stores user settings (`rate`, `voice`) in `chrome.storage.sync`.
- For playback requests it opens a WebSocket to the local TTS daemon and streams JSON messages.
- Audio frames `{type:"audio", pcm16_base64, sample_rate}` are forwarded to the active tab's content script.
- If the WebSocket fails or yields no audio, the worker commands the content script to use Web Speech API instead.
- Exposes message handlers for the popup to start/stop playback and update settings.

### Content Script (`content.ts`)
- Provides the selected text to the worker when asked (`get-selection`).
- Hosts a single `AudioContext` and an `AudioPlayer` instance for the tab.
- Receives audio frames, decodes base64 PCM16, and schedules them sequentially with a small (~15ms) crossfade for gapless playback.
- Can cancel playback and invoke Web Speech API for fallback speech.

### Popup (`popup.ts` & `popup.html`)
- Simple UI with textarea, play/stop buttons, rate slider (0.8–2.0×), voice dropdown, and a "Play in this tab" checkbox.
- Reads/writes settings via `chrome.storage.sync`.
- Sends "play-text" and "stop" messages to the background worker.

### Audio Utilities (`utils/audio.ts`)
- `decodePcm16` converts base64-encoded 16‑bit PCM to `Float32Array` for WebAudio.
- `AudioPlayer` schedules buffers on an `AudioContext`, applying playback rate and a short gain ramp for crossfading.

## Design Decisions

- **Content script playback** – Audio is rendered inside the active tab rather than an offscreen document to minimize complexity and latency.
- **WebSocket streaming** – The extension streams sentence-level PCM16 chunks from the daemon to start playback as soon as possible.
- **Crossfaded scheduling** – Each chunk is scheduled with a 15 ms fade in/out to avoid clicks and gaps.
- **Fallback to Web Speech API** – If the daemon is offline or unreachable, the extension remains usable via built-in speech synthesis.
- **Lightweight tooling** – The extension uses plain TypeScript with `tsc` compilation; no bundler or framework is required for this MVP.

## Limitations & Future Work

- No word highlighting or timing information is handled yet.
- Playback rate changes apply only to future audio buffers (no time‑stretching of already scheduled audio).
- Additional controls (voices, settings UI) are minimal and intended for expansion in future iterations.
 
## Local Setup

1. **Generate JavaScript:** Run `npx tsc -p clients/extension/tsconfig.json` to compile the TypeScript sources in-place, producing `background.js`, `content.js`, `popup.js`, and utility scripts required by Chrome.
2. **Provide Icons:** Add 16×16, 48×48, and 128×128 PNG images at `clients/extension/icons/icon16.png`, `icon48.png`, and `icon128.png`. These are referenced by `manifest.json` but not tracked in the repository.
3. **Load the extension:** Use Chrome's **Load unpacked** feature to point at `clients/extension/` after generating scripts and icons.
