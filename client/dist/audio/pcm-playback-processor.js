class PcmPlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ringBuffer = new Float32Array(96000); // 4 seconds at 24kHz
    this.writePos = 0;
    this.readPos = 0;
    this.bufferedSamples = 0;
    this.playing = false;

    this.port.onmessage = (event) => {
      if (event.data.type === 'audio') {
        const pcm = new Int16Array(event.data.buffer);
        for (let i = 0; i < pcm.length; i++) {
          this.ringBuffer[this.writePos] = pcm[i] / 32768;
          this.writePos = (this.writePos + 1) % this.ringBuffer.length;
          this.bufferedSamples++;
        }
        if (!this.playing && this.bufferedSamples > 1200) {
          this.playing = true;
        }
      } else if (event.data.type === 'stop') {
        this.playing = false;
        this.bufferedSamples = 0;
        this.readPos = this.writePos;
      }
    };
  }

  process(outputs) {
    const output = outputs[0];
    if (!output || !output[0]) return true;

    const channel0 = output[0];
    const channel1 = output.length > 1 ? output[1] : null;

    if (this.playing && this.bufferedSamples > 0) {
      const samplesToRead = Math.min(channel0.length, this.bufferedSamples);
      for (let i = 0; i < samplesToRead; i++) {
        const sample = this.ringBuffer[this.readPos];
        channel0[i] = sample;
        if (channel1) channel1[i] = sample;
        this.readPos = (this.readPos + 1) % this.ringBuffer.length;
      }
      this.bufferedSamples -= samplesToRead;

      // Fill remaining with silence if we ran out
      for (let i = samplesToRead; i < channel0.length; i++) {
        channel0[i] = 0;
        if (channel1) channel1[i] = 0;
      }

      // Calculate output level for voice wave
      let sum = 0;
      for (let i = 0; i < samplesToRead; i++) {
        sum += channel0[i] * channel0[i];
      }
      const level = Math.min(1, Math.sqrt(sum / samplesToRead) * 5);
      this.port.postMessage({ type: 'level', level, playing: true });

      if (this.bufferedSamples <= 0) {
        this.playing = false;
        this.port.postMessage({ type: 'level', level: 0, playing: false });
      }
    } else {
      for (let i = 0; i < channel0.length; i++) {
        channel0[i] = 0;
        if (channel1) channel1[i] = 0;
      }
    }

    return true;
  }
}

registerProcessor('pcm-playback-processor', PcmPlaybackProcessor);
