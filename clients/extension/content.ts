import { AudioPlayer } from './utils/audio.js';

const player = new AudioPlayer();

chrome.runtime.onMessage.addListener((msg: any, sender: any, sendResponse: any) => {
  if (msg.type === 'get-selection') {
    const text = window.getSelection()?.toString() || '';
    sendResponse({ text });
  } else if (msg.type === 'tts-audio') {
    player.setRate(msg.rate || 1.0);
    player.enqueue(msg.pcm16, msg.sampleRate || 22050);
  } else if (msg.type === 'tts-stop') {
    player.stop();
  } else if (msg.type === 'speak-webspeech') {
    player.stop();
    const u = new SpeechSynthesisUtterance(msg.text);
    u.rate = msg.rate || 1.0;
    speechSynthesis.speak(u);
  }
  return true;
});
