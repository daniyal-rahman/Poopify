import { AudioPlayer } from './utils/audio.js';

const player = new AudioPlayer();

let overlay: HTMLDivElement | null = null;
let playBtn: HTMLButtonElement | null = null;
let stopBtn: HTMLButtonElement | null = null;

function createOverlay() {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.bottom = '20px';
  overlay.style.right = '20px';
  overlay.style.zIndex = '2147483647';
  overlay.style.background = 'rgba(0,0,0,0.7)';
  overlay.style.color = '#fff';
  overlay.style.padding = '8px';
  overlay.style.borderRadius = '4px';
  overlay.style.display = 'flex';
  overlay.style.gap = '8px';

  playBtn = document.createElement('button');
  playBtn.textContent = 'Pause';
  playBtn.onclick = () => {
    if (player.isPaused()) {
      player.resume();
      playBtn!.textContent = 'Pause';
    } else {
      player.pause();
      playBtn!.textContent = 'Play';
    }
  };

  stopBtn = document.createElement('button');
  stopBtn.textContent = 'Stop';
  stopBtn.onclick = () => {
    chrome.runtime.sendMessage({ type: 'stop' });
    removeOverlay();
  };

  overlay.appendChild(playBtn);
  overlay.appendChild(stopBtn);
  document.body.appendChild(overlay);
}

function removeOverlay() {
  overlay?.remove();
  overlay = null;
  playBtn = null;
  stopBtn = null;
}

chrome.runtime.onMessage.addListener((msg: any, sender: any, sendResponse: any) => {
  if (msg.type === 'get-selection') {
    const text = window.getSelection()?.toString() || '';
    sendResponse({ text });
  } else if (msg.type === 'tts-start') {
    createOverlay();
  } else if (msg.type === 'tts-audio') {
    createOverlay();
    player.setRate(msg.rate || 1.0);
    player.enqueue(msg.pcm16, msg.sampleRate || 22050);
  } else if (msg.type === 'tts-stop') {
    player.stop();
    removeOverlay();
  } else if (msg.type === 'speak-webspeech') {
    player.stop();
    removeOverlay();
    const u = new SpeechSynthesisUtterance(msg.text);
    u.rate = msg.rate || 1.0;
    speechSynthesis.speak(u);
  }
  return true;
});
