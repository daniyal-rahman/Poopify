import { AudioPlayer } from './utils/audio.js';

const player = new AudioPlayer();

let overlay: HTMLDivElement | null = null;
let playBtn: HTMLButtonElement | null = null;
let stopBtn: HTMLButtonElement | null = null;

function createOverlay() {
  console.log('[Poopify] createOverlay called');
  if (overlay) {
    console.log('[Poopify] Overlay already exists.');
    return;
  }

  // NOTE: The red box is for testing and should be removed later.
  const redBox = document.createElement('div');
  redBox.style.position = 'fixed';
  redBox.style.top = '20px';
  redBox.style.right = '20px';
  redBox.style.width = '100px';
  redBox.style.height = '100px';
  redBox.style.background = 'red';
  redBox.style.zIndex = '2147483647';
  document.body.appendChild(redBox);

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
  overlay.style.alignItems = 'center';

  playBtn = document.createElement('button');
  playBtn.textContent = 'Pause';
  playBtn.onclick = () => {
    if (player.isPaused()) {
      chrome.runtime.sendMessage({ type: 'resume' });
      player.resume();
      playBtn!.textContent = 'Pause';
    } else {
      chrome.runtime.sendMessage({ type: 'pause' });
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

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'X';
  closeBtn.style.background = 'transparent';
  closeBtn.style.border = 'none';
  closeBtn.style.color = '#fff';
  closeBtn.style.fontSize = '16px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.marginLeft = '8px';
  closeBtn.onclick = removeOverlay;

  overlay.appendChild(playBtn);
  overlay.appendChild(stopBtn);
  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);
  console.log('[Poopify] Overlay created and appended.');
}

function removeOverlay() {
  console.log('[Poopify] removeOverlay called');
  // NOTE: This is a temporary cleanup for the red box.
  const redBox = document.querySelector('div[style*="background: red;"]');
  redBox?.remove();

  overlay?.remove();
  overlay = null;
  playBtn = null;
  stopBtn = null;
}

chrome.runtime.onMessage.addListener((msg: any, sender: any, sendResponse: any) => {
  console.log('[Poopify] Message received:', msg);
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
    // removeOverlay(); // <-- Removed this call
    const u = new SpeechSynthesisUtterance(msg.text);
    u.rate = msg.rate || 1.0;
    speechSynthesis.speak(u);
  }
  return true;
});
