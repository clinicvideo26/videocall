// Audio-thread PCM capture for realtime transcription.
// Runs off the main thread so UI re-renders can't starve it (the cause of
// dropped audio with the old ScriptProcessorNode). The AudioContext is created
// at 16 kHz, so the frames here are already 16 kHz mono — we just batch them
// (~128 ms) and hand them to the main thread to encode and send.
class PCMWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffers = [];
    this._count = 0;
    this._target = 2048; // ~128 ms at 16 kHz
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length) {
      this._buffers.push(channel.slice(0));
      this._count += channel.length;
      if (this._count >= this._target) {
        const merged = new Float32Array(this._count);
        let offset = 0;
        for (const b of this._buffers) {
          merged.set(b, offset);
          offset += b.length;
        }
        this.port.postMessage(merged, [merged.buffer]);
        this._buffers = [];
        this._count = 0;
      }
    }
    return true;
  }
}

registerProcessor("pcm-worklet", PCMWorklet);
