class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.bufferSize = 2048; // ~128ms at 16kHz
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const samples = input[0];
    for (let i = 0; i < samples.length; i++) {
      this.buffer.push(samples[i]);
    }

    if (this.buffer.length >= this.bufferSize) {
      const pcm = new Int16Array(this.buffer.length);
      for (let i = 0; i < this.buffer.length; i++) {
        const s = Math.max(-1, Math.min(1, this.buffer[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      // Calculate audio level (RMS)
      let sum = 0;
      for (let i = 0; i < this.buffer.length; i++) {
        sum += this.buffer[i] * this.buffer[i];
      }
      const rms = Math.sqrt(sum / this.buffer.length);
      const level = Math.min(1, rms * 5); // Amplify for visual feedback

      this.port.postMessage({ type: 'audio', buffer: pcm.buffer, level }, [pcm.buffer]);
      this.buffer = [];
    }

    return true;
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
