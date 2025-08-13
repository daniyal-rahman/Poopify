const textEl = document.getElementById('text') as HTMLTextAreaElement;
const rateEl = document.getElementById('rate') as HTMLInputElement;
const rateLabel = document.getElementById('rateLabel') as HTMLElement;
const voiceEl = document.getElementById('voice') as HTMLSelectElement;
const playInTabEl = document.getElementById('playInTab') as HTMLInputElement;
const playBtn = document.getElementById('play') as HTMLButtonElement;
const stopBtn = document.getElementById('stop') as HTMLButtonElement;

chrome.storage.sync.get({ rate: 1.0, voice: 'default' }).then((s: any) => {
  rateEl.value = String(s.rate);
  rateLabel.textContent = s.rate.toFixed(1);
  voiceEl.value = s.voice;
});

rateEl.addEventListener('input', () => {
  rateLabel.textContent = parseFloat(rateEl.value).toFixed(1);
  chrome.runtime.sendMessage({ type: 'set-settings', rate: parseFloat(rateEl.value), voice: voiceEl.value });
});

voiceEl.addEventListener('change', () => {
  chrome.runtime.sendMessage({ type: 'set-settings', rate: parseFloat(rateEl.value), voice: voiceEl.value });
});

playBtn.addEventListener('click', () => {
  const text = textEl.value.trim();
  chrome.runtime.sendMessage({ type: 'play-text', text, playInTab: playInTabEl.checked });
});

stopBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'stop' });
});
