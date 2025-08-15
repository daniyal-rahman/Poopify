export function decodePcm16(pcm16Base64: string): Float32Array {
  const binary = atob(pcm16Base64);
  const len = binary.length / 2;
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const lo = binary.charCodeAt(i * 2);
    const hi = binary.charCodeAt(i * 2 + 1);
    let val = (hi << 8) | lo;
    if (val & 0x8000) val = val - 0x10000;
    out[i] = val / 32768;
  }
  return out;
}

export class AudioPlayer {
  private ctx: AudioContext;
  private gain: GainNode;
  private nextTime: number;
  private rate = 1.0;
  private sources: AudioBufferSourceNode[] = [];
  private fade = 0.015;
  private paused = false;

  constructor() {
    this.ctx = new AudioContext();
    this.gain = this.ctx.createGain();
    this.gain.connect(this.ctx.destination);
    this.nextTime = this.ctx.currentTime;
  }

  setRate(r: number) {
    this.rate = r;
  }

  enqueue(pcm16Base64: string, sampleRate: number) {
    this.ctx.resume();
    this.paused = false;
    const float32 = decodePcm16(pcm16Base64);
    const buffer = this.ctx.createBuffer(1, float32.length, sampleRate);
    buffer.getChannelData(0).set(float32);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = this.rate;

    const gain = this.ctx.createGain();
    const start = Math.max(this.nextTime, this.ctx.currentTime);
    const duration = buffer.duration / this.rate;

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(1, start + this.fade);
    gain.gain.setValueAtTime(1, start + duration - this.fade);
    gain.gain.linearRampToValueAtTime(0, start + duration);

    source.connect(gain).connect(this.gain);
    source.start(start);
    this.sources.push(source);
    this.nextTime = start + duration - this.fade;
  }

  stop() {
    for (const s of this.sources) {
      try { s.stop(); } catch (e) {}
    }
    this.sources = [];
    this.nextTime = this.ctx.currentTime;
    this.paused = false;
  }

  pause() {
    if (!this.paused) {
      this.ctx.suspend();
      this.paused = true;
    }
  }

  resume() {
    if (this.paused) {
      this.ctx.resume();
      this.paused = false;
    }
  }

  isPaused() {
    return this.paused;
  }
}
