export interface RecordingResult {
  playbackUrl: string;
  uploadBlob: Blob;
  mimeType: string;
  durationMs: number;
}

export function isRecordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}

function selectBestMimeType(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "";
}

export class MicrophoneRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;

  async start(): Promise<void> {
    if (!isRecordingSupported()) {
      throw new Error(
        "Microphone recording is not supported in this browser. Please use a modern Chrome, Edge, Firefox, or Safari browser."
      );
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      const domErr = err as DOMException | undefined;
      if (domErr?.name === "NotAllowedError" || domErr?.name === "PermissionDeniedError") {
        throw new Error(
          "Microphone permission was denied. Please allow microphone access in your browser address bar and try again."
        );
      }
      if (domErr?.name === "NotFoundError" || domErr?.name === "DevicesNotFoundError") {
        throw new Error(
          "No microphone was detected on this device. Please connect a microphone and try again."
        );
      }
      throw new Error("Could not access the microphone. Please check your device settings.");
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);
      }
    } catch {
      // Visualizer is optional; recording still proceeds
    }

    const mimeType = selectBestMimeType();
    this.chunks = [];
    this.mediaRecorder = mimeType
      ? new MediaRecorder(this.stream, { mimeType })
      : new MediaRecorder(this.stream);

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.startedAt = performance.now();
    this.mediaRecorder.start(100);
  }

  getVolumeLevel(): number {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    const avg = sum / data.length;
    return Math.min(1, avg / 90);
  }

  async stop(): Promise<RecordingResult> {
    const recorder = this.mediaRecorder;
    if (!recorder) {
      this.cleanup();
      throw new Error("No active recording to stop.");
    }

    const durationMs = Math.max(0, Math.round(performance.now() - this.startedAt));

    const rawBlob: Blob = await new Promise((resolve, reject) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        resolve(new Blob(this.chunks, { type }));
      };
      recorder.onerror = () => {
        reject(new Error("Recording failed unexpectedly."));
      };
      if (recorder.state !== "inactive") {
        recorder.stop();
      } else {
        const type = recorder.mimeType || "audio/webm";
        resolve(new Blob(this.chunks, { type }));
      }
    });

    this.cleanup();

    if (rawBlob.size < 200 || durationMs < 250) {
      throw new Error("Recording was too short. Hold and speak the word clearly, then press Stop.");
    }

    const playbackUrl = URL.createObjectURL(rawBlob);

    // Try normalizing to 16kHz mono WAV for universal Gemini audio compatibility
    try {
      const wavBlob = await convertBlobToWav(rawBlob);
      return {
        playbackUrl,
        uploadBlob: wavBlob,
        mimeType: "audio/wav",
        durationMs,
      };
    } catch {
      const normalizedMime = (rawBlob.type || "audio/webm").split(";")[0].trim();
      return {
        playbackUrl,
        uploadBlob: rawBlob,
        mimeType: normalizedMime,
        durationMs,
      };
    }
  }

  cancel(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {
        // Ignore
      }
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.analyser = null;
    this.mediaRecorder = null;
  }
}

async function convertBlobToWav(blob: Blob): Promise<Blob> {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error("AudioContext unavailable");
  }

  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new AudioCtx();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const targetSampleRate = 16000;
    const offlineCtx = new OfflineAudioContext(
      1,
      Math.max(1, Math.ceil(audioBuffer.duration * targetSampleRate)),
      targetSampleRate
    );
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);
    const rendered = await offlineCtx.startRendering();
    const samples = rendered.getChannelData(0);
    const wavBytes = encodePcm16Wav(samples, targetSampleRate);
    return new Blob([wavBytes], { type: "audio/wav" });
  } finally {
    ctx.close().catch(() => {});
  }
}

function encodePcm16Wav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not encode audio recording."));
        return;
      }
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error("Failed to read audio recording."));
    reader.readAsDataURL(blob);
  });
}

// Gentle classroom-friendly Web Audio feedback sounds
function getToneContext(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    return AudioCtx ? new AudioCtx() : null;
  } catch {
    return null;
  }
}

export function playSuccessChime(): void {
  const ctx = getToneContext();
  if (!ctx) return;
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const start = ctx.currentTime + idx * 0.08;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.26);
  });
  setTimeout(() => ctx.close().catch(() => {}), 600);
}

export function playRetryTone(): void {
  const ctx = getToneContext();
  if (!ctx) return;
  const notes = [349.23, 293.66]; // F4 -> D4
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = ctx.currentTime + idx * 0.11;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.1, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.22);
  });
  setTimeout(() => ctx.close().catch(() => {}), 500);
}

export function playVictoryFanfare(): void {
  const ctx = getToneContext();
  if (!ctx) return;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const start = ctx.currentTime + idx * 0.1;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.38);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  });
  setTimeout(() => ctx.close().catch(() => {}), 900);
}
