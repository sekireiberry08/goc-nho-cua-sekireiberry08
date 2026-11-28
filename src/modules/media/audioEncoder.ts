import { Mp3Encoder } from "@breezystack/lamejs";

export function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "00:00.0";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
}

export function formatTimestamp(t: number): string {
  const safe = Math.max(0, t);
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, "0")}.${String(
    Math.floor((safe % 1) * 100)
  ).padStart(2, "0")}`;
}

function floatTo16Bit(input: Float32Array, start: number, end: number): Int16Array {
  const len = Math.max(0, end - start);
  const out = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    const clamped = Math.max(-1, Math.min(1, input[start + i]));
    out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return out;
}

export function audioBufferToWav(buffer: AudioBuffer, startSec: number, endSec: number): ArrayBuffer {
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const startSample = Math.max(0, Math.floor(startSec * sampleRate));
  const endSample = Math.min(buffer.length, Math.floor(endSec * sampleRate));
  const frameCount = Math.max(0, endSample - startSample);

  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = frameCount * blockAlign;

  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  for (let i = startSample; i < endSample; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}

export async function audioBufferToMp3(
  buffer: AudioBuffer,
  startSec: number,
  endSec: number,
  kbps = 192,
  onProgress?: (ratio: number) => void
): Promise<ArrayBuffer> {
  const sampleRate = buffer.sampleRate;
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const startSample = Math.max(0, Math.floor(startSec * sampleRate));
  const endSample = Math.min(buffer.length, Math.floor(endSec * sampleRate));
  const totalSamples = Math.max(0, endSample - startSample);

  const encoder = new Mp3Encoder(numChannels, sampleRate, kbps);
  const left = floatTo16Bit(buffer.getChannelData(0), startSample, endSample);
  const right =
    numChannels > 1
      ? floatTo16Bit(buffer.getChannelData(1), startSample, endSample)
      : undefined;

  const chunks: Uint8Array[] = [];
  const blockSize = 1152;
  let totalBytes = 0;

  for (let i = 0; i < totalSamples; i += blockSize) {
    const leftChunk = left.subarray(i, i + blockSize);
    const encoded = right
      ? encoder.encodeBuffer(leftChunk, right.subarray(i, i + blockSize))
      : encoder.encodeBuffer(leftChunk);

    if (encoded.length > 0) {
      const copy = new Uint8Array(encoded);
      chunks.push(copy);
      totalBytes += copy.length;
    }

    if (i % (blockSize * 150) === 0) {
      onProgress?.(totalSamples > 0 ? i / totalSamples : 1);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const tail = encoder.flush();
  if (tail.length > 0) {
    const copy = new Uint8Array(tail);
    chunks.push(copy);
    totalBytes += copy.length;
  }
  onProgress?.(1);

  const outputBuffer = new ArrayBuffer(totalBytes);
  const output = new Uint8Array(outputBuffer);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return outputBuffer;
}

export async function decodeMediaFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioCtxClass =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtxClass();
  try {
    return await ctx.decodeAudioData(arrayBuffer);
  } finally {
    await ctx.close().catch(() => {});
  }
}

export function concatAudioSegments(
  segments: Array<{ buffer: AudioBuffer; start: number; end: number }>
): AudioBuffer {
  if (!segments.length) {
    throw new Error("Không có đoạn âm thanh để ghép.");
  }
  const sampleRate = segments[0].buffer.sampleRate;
  const numChannels = Math.min(2, Math.max(...segments.map((s) => s.buffer.numberOfChannels)));

  let totalFrames = 0;
  const slices = segments.map(({ buffer, start, end }) => {
    const sr = buffer.sampleRate;
    const s0 = Math.max(0, Math.floor(start * sr));
    const s1 = Math.min(buffer.length, Math.floor(end * sr));
    const len = Math.max(0, s1 - s0);
    totalFrames += len;
    return { buffer, s0, len };
  });

  const out = new AudioBuffer({
    length: Math.max(1, totalFrames),
    numberOfChannels: numChannels,
    sampleRate,
  });

  let offset = 0;
  for (const { buffer, s0, len } of slices) {
    for (let c = 0; c < numChannels; c++) {
      const srcChan = buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1));
      out.getChannelData(c).set(srcChan.subarray(s0, s0 + len), offset);
    }
    offset += len;
  }
  return out;
}
