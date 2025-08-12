import { SoundTouch, SimpleFilter } from 'soundtouchjs';

class Player {
  private audioContext: AudioContext;
  private soundtouch: SoundTouch;
  private audioQueue: AudioBuffer[] = [];
  private activeSourceNodes: AudioBufferSourceNode[] = [];
  public isPlaying = false;
  private nextPlayTime = 0;

  constructor(sampleRate = 22050) {
    this.audioContext = new AudioContext({ sampleRate });
    this.soundtouch = new SoundTouch(sampleRate);
  }

  addChunk(chunk: Int16Array) {
    const floatChunk = new Float32Array(chunk.length);
    for (let i = 0; i < chunk.length; i++) {
      floatChunk[i] = chunk[i] / 32768;
    }

    const buffer = this.audioContext.createBuffer(1, floatChunk.length, this.audioContext.sampleRate);
    buffer.copyToChannel(floatChunk, 0);

    const filter = new SimpleFilter(this.soundtouch, (processedData) => {
      if (processedData.data.length > 0) {
        const newBuffer = this.audioContext.createBuffer(1, processedData.data.length, this.audioContext.sampleRate);
        newBuffer.copyToChannel(processedData.data, 0);
        this.audioQueue.push(newBuffer);
        if (this.isPlaying) {
          this.schedulePlayback();
        }
      }
    });

    filter.source = {
      extract: (target, numFrames, position) => {
        const sourceData = buffer.getChannelData(0);
        if (position >= sourceData.length) {
          return 0;
        }
        const slicedData = sourceData.subarray(position, position + numFrames);
        target.set(slicedData);
        return slicedData.length;
      }
    };

    this.soundtouch.putSamples(floatChunk);
  }

  private schedulePlayback() {
    while (this.audioQueue.length > 0) {
      const buffer = this.audioQueue.shift();
      if (!buffer) continue;

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);

      const currentTime = this.audioContext.currentTime;
      const playTime = Math.max(currentTime, this.nextPlayTime);

      source.start(playTime);
      this.nextPlayTime = playTime + buffer.duration;

      // Track this source so we can stop it later
      this.activeSourceNodes.push(source);
      source.onended = () => {
        // Remove from tracking when it finishes
        this.activeSourceNodes = this.activeSourceNodes.filter(s => s !== source);
      };
    }
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    this.schedulePlayback();
  }

  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    
    // Stop all scheduled and playing sources
    this.activeSourceNodes.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Ignore errors if the source has already been stopped
      }
    });

    this.activeSourceNodes = []; // Clear the array
    this.audioQueue = []; // Clear the pending queue
    this.nextPlayTime = 0; // Reset playback time
  }

  stop() {
    this.pause();
    this.audioContext.close().catch(console.error);
  }

  setRate(rate: number) {
    this.soundtouch.tempo = rate;
  }
}

export default Player;