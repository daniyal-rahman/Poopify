const CONTEXT_MENU_ID = 'poopify-read-selection';

interface Settings {
  rate: number;
  voice: string;
}

let settings: Settings = { rate: 1.0, voice: 'default' };
let currentWs: WebSocket | null = null;
let currentTabId: number | null = null;
let receivedAudio = false;
let paused = false;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: CONTEXT_MENU_ID, title: 'Read selection with Poopify', contexts: ['selection'] });
  chrome.storage.sync.get(settings).then((s: any) => { settings = Object.assign(settings, s); });
});

chrome.runtime.onMessage.addListener((msg: any, sender: any, sendResponse: any) => {
  if (msg.type === 'play-text') {
    (async () => {
      const text: string = msg.text || '';
      if (!text.trim()) return;
      let tabId = msg.tabId as number | undefined;
      if (!tabId) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        tabId = tab.id;
      }
      startTts(text, tabId!, msg.playInTab !== false);
    })();
  } else if (msg.type === 'stop') {
    stopTts();
  } else if (msg.type === 'pause') {
    if (currentWs && currentWs.readyState === WebSocket.OPEN) {
      currentWs.send(JSON.stringify({ type: 'pause' }));
    }
    paused = true;
  } else if (msg.type === 'resume') {
    if (currentWs && currentWs.readyState === WebSocket.OPEN) {
      currentWs.send(JSON.stringify({ type: 'resume' }));
    }
    paused = false;
  } else if (msg.type === 'set-settings') {
    settings.rate = msg.rate ?? settings.rate;
    settings.voice = msg.voice ?? settings.voice;
    chrome.storage.sync.set(settings);
  }
  return true;
});

chrome.contextMenus.onClicked.addListener((info: any, tab: any) => {
  if (info.menuItemId === CONTEXT_MENU_ID && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'get-selection' }, (response: any) => {
      const text = response?.text || '';
      if (text.trim()) startTts(text, tab.id!, true);
    });
  }
  return true;
});

function startTts(text: string, tabId: number, useContent: boolean) {
  stopTts();
  currentTabId = tabId;
  try {
    console.log('[Poopify BG] Attempting to connect to WebSocket...');
    const ws = new WebSocket('ws://127.0.0.1:8000/api/stream');
    currentWs = ws;
    receivedAudio = false;
    paused = false;
    ws.onopen = () => {
      console.log('[Poopify BG] WebSocket connection opened.');
      ws.send(JSON.stringify({ text, rate: settings.rate, voice: settings.voice }));
      if (useContent) {
        chrome.tabs.sendMessage(tabId, { type: 'tts-start', engine: 'daemon' });
      }
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'audio') {
          receivedAudio = true;
          if (useContent && !paused) {
            chrome.tabs.sendMessage(tabId, {
              type: 'tts-audio',
              pcm16: msg.pcm16_base64,
              sampleRate: msg.sample_rate || 22050,
              rate: settings.rate,
            });
          }
        }
      } catch (e) {
        // ignore non-JSON
      }
    };
    ws.onerror = (err) => {
      console.error('[Poopify BG] WebSocket error:', err);
      ws.close();
    };
    ws.onclose = () => {
      console.log('[Poopify BG] WebSocket connection closed.');
      if (!receivedAudio) {
        console.log('[Poopify BG] No audio received, falling back to Web Speech API.');
        fallbackWebSpeech(text, tabId, useContent);
      }
    };
  } catch (e) {
    console.error('[Poopify BG] Failed to create WebSocket:', e);
    fallbackWebSpeech(text, tabId, useContent);
  }
}

function stopTts() {
  if (currentWs) {
    currentWs.close();
    currentWs = null;
  }
  if (currentTabId != null) {
    chrome.tabs.sendMessage(currentTabId, { type: 'tts-stop' });
  }
  currentTabId = null;
  paused = false;
}

function fallbackWebSpeech(text: string, tabId: number, useContent: boolean) {
  if (useContent) {
    chrome.tabs.sendMessage(tabId, { type: 'speak-webspeech', text, rate: settings.rate });
  }
}
