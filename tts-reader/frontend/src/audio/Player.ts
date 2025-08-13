// frontend/src/audio/Player.ts
import { SoundTouch, SimpleFilter, getWebAudioNode } from 'soundtouchjs';

class FloatRingBuffer {
  private buf: Float32Array;
  private r = 0;
  private w = 0;
  private size: number;
  constructor(capacity: number) {
    this.buf = new Float32Array(capacity);
    this.size = capacity;
  }
  write(src: Float32Array) {
    let n = 0;
    for (let i = 0; i < src.length; i++) {
      const next = (this.w + 1) % this.size;
      if (next === this.r) break; // full
      this.buf[this.w] = src[i];
      this.w = next;
      n++;
    }
    return n;
  }
  read(target: Float32Array) {
    let n = 0;
    while (n < target.length && this.r !== this.w) {
      target[n++] = this.buf[this.r];
      this.r = (this.r + 1) % this.size;
    }
    for (let i = n; i < target.length; i++) target[i] = 0; // pad
    return n;
  }
}

function linearResampleMono(
  input: Float32Array,
  inRate: number,
  outRate: number
): Float32Array {
  if (inRate === outRate || input.length === 0) return input;
  const ratio = outRate / inRate;
  const outLen = Math.max(1, Math.floor(input.length * ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i / ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const t = pos - i0;
    out[i] = input[i0] * (1 - t) + input[i1] * t;
  }
  return out;
}

class Player {
  private audioContext: AudioContext;
  private soundtouch: SoundTouch;
  private filter: SimpleFilter;
  private node: AudioNode;
  private ring: FloatRingBuffer;
  public isPlaying = false;
  private inputSampleRate = 22050; // server PCM rate

  constructor() {
    this.audioContext = new AudioContext(); // Browser default 44100/48000
    const ctxRate = this.audioContext.sampleRate;

    this.soundtouch = new SoundTouch(ctxRate);

    const self = this;
    const source = {
      extract(target: Float32Array, numFrames: number) {
        self.ring.read(target);
        return numFrames;
      }
    };

    this.filter = new SimpleFilter(source, this.soundtouch);
    // @ts-ignore: soundtouchjs helper for WebAudio
    this.node = getWebAudioNode(this.audioContext, this.filter);
    this.node.connect(this.audioContext.destination);

    // ~2 seconds of buffer at ctxRate
    this.ring = new FloatRingBuffer(Math.ceil(ctxRate * 2));
  }

  addChunkPCM16(int16: Int16Array) {
    const f = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) f[i] = int16[i] / 32768;
    const ctxRate = this.audioContext.sampleRate;
    const fResampled = linearResampleMono(f, this.inputSampleRate, ctxRate);
    this.ring.write(fResampled);
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    if (this.audioContext.state === 'suspended') this.audioContext.resume();
    // Node pulls automatically from the ring via SoundTouch
  }

  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.audioContext.suspend();
  }

  stop() {
    this.isPlaying = false;
    try { this.audioContext.close(); } catch {}
  }

  setRate(rate: number) {
    this.soundtouch.tempo = Math.max(0.5, Math.min(3.0, rate));
  }
}

export default Player;
