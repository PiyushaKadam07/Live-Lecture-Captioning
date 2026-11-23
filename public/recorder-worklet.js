// Runs on the browser's audio thread. Collects microphone samples into
// blocks of about 0.1 s and posts them to the page.
class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(4096);
    this.length = 0;
  }

  process(inputs) {
    const channel = inputs[0][0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) {
        this.buffer[this.length++] = channel[i];
        if (this.length === this.buffer.length) {
          this.port.postMessage(this.buffer);
          this.buffer = new Float32Array(4096);
          this.length = 0;
        }
      }
    }
    return true; // keep running
  }
}

registerProcessor("recorder", RecorderProcessor);