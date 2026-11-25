import React, { useState, useRef, useEffect } from "react";
import {
  Scissors,
  Play,
  Pause,
  Plus,
  Trash2,
  Download,
  Upload,
  AlertCircle,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Volume2,
} from "lucide-react";
import JSZip from "jszip";

interface Segment {
  id: string;
  name: string;
  start: number;
  end: number;
}

// Simple browser-based 16-bit PCM WAV encoder
function audioBufferToWav(buffer: AudioBuffer, startSec: number, endSec: number): ArrayBuffer {
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const startSample = Math.max(0, Math.floor(startSec * sampleRate));
  const endSample = Math.min(buffer.length, Math.floor(endSec * sampleRate));
  const frameCount = Math.max(0, endSample - startSample);

  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = frameCount * blockAlign;

  const bufferLength = 44 + dataSize;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // Write RIFF header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");

  // Write fmt chunk
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample

  // Write data chunk
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Interleave channel samples and convert Float32 to 16-bit Int
  let offset = 44;
  const channels = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  for (let i = startSample; i < endSample; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = channels[c][i];
      // Clamp between -1 and 1
      sample = Math.max(-1, Math.min(1, sample));
      // Scale to 16-bit signed integer
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}

const formatSeconds = (sec: number) => {
  if (isNaN(sec) || sec < 0) return "00:00.0";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
};

export default function AudioView() {
  const [file, setFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (mediaUrl) URL.revokeObjectURL(mediaUrl);

    const url = URL.createObjectURL(selectedFile);
    setFile(selectedFile);
    setMediaUrl(url);
    setError(null);
    setStatusMsg(`Đã nạp file: ${selectedFile.name}`);
    setSegments([
      {
        id: crypto.randomUUID(),
        name: "Đoạn 1",
        start: 0,
        end: 10,
      },
    ]);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setDuration(dur);
      setSegments((prev) =>
        prev.map((s) => ({
          ...s,
          end: Math.min(dur, Math.max(5, dur / 4)),
        }))
      );
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const addSegment = () => {
    const newStart = Math.min(currentTime, Math.max(0, duration - 5));
    const newEnd = Math.min(duration, newStart + 10);
    setSegments((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: `Đoạn ${prev.length + 1}`,
        start: newStart,
        end: newEnd,
      },
    ]);
  };

  const updateSegment = (id: string, updates: Partial<Segment>) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const removeSegment = (id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id));
  };

  const setSegmentToCurrent = (id: string, field: "start" | "end") => {
    updateSegment(id, { [field]: currentTime });
  };

  const exportAudio = async () => {
    if (!file || !segments.length) return;
    setIsProcessing(true);
    setStatusMsg("Đang giải mã âm thanh trong trình duyệt (Web Audio API)...");
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      setStatusMsg(`Đang trích xuất và mã hóa ${segments.length} đoạn WAV...`);

      if (segments.length === 1) {
        const seg = segments[0];
        const wavBuffer = audioBufferToWav(audioBuffer, seg.start, seg.end);
        const blob = new Blob([wavBuffer], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${seg.name.replace(/\s+/g, "_")}.wav`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const zip = new JSZip();
        segments.forEach((seg, idx) => {
          const wavBuffer = audioBufferToWav(audioBuffer, seg.start, seg.end);
          const filename = `${String(idx + 1).padStart(2, "0")}_${seg.name.replace(/\s+/g, "_")}.wav`;
          zip.file(filename, wavBuffer);
        });

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audio_cuts_${Date.now()}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      }

      setStatusMsg("✓ Đã hoàn tất xuất file âm thanh!");
    } catch (err: any) {
      console.error("Audio export error", err);
      setError("Không thể giải mã hoặc xuất âm thanh: " + (err?.message || "Lỗi không xác định"));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-sm font-semibold tracking-wider uppercase">
            <Scissors className="w-4 h-4" />
            <span>Tiện Ích Audio & Video</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mt-1">
            Cắt & Trích Xuất Audio
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Cắt nhiều đoạn từ video/audio trực tiếp trên trình duyệt bằng Web Audio API • Xuất file WAV chất lượng cao.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 self-start md:self-auto">
          <ShieldCheck className="w-4 h-4" />
          <span>Client-side 100% · Không giới hạn kích thước · Bảo mật riêng tư</span>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Player & Timeline */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            {/* Upload bar */}
            <div className="flex items-center justify-between gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,audio/*,.mp4,.mov,.webm,.mkv,.mp3,.wav,.m4a"
                hidden
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{file ? "Đổi tệp khác" : "Chọn video hoặc audio"}</span>
              </button>

              {file && (
                <span className="text-xs text-slate-400 truncate max-w-xs">
                  {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
                </span>
              )}
            </div>

            {/* Video preview or placeholder */}
            <div className="relative aspect-video bg-black/60 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
              {mediaUrl ? (
                <video
                  ref={videoRef}
                  src={mediaUrl}
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  className="w-full h-full object-contain"
                  playsInline
                />
              ) : (
                <div className="text-center p-6 text-slate-500 space-y-2">
                  <Volume2 className="w-10 h-10 mx-auto opacity-50 text-indigo-400" />
                  <p className="text-sm">Chưa có tệp nào được chọn</p>
                  <p className="text-xs">Chọn video MP4, WebM, MOV hoặc file âm thanh để phát và cắt đoạn</p>
                </div>
              )}
            </div>

            {/* Media controls */}
            {mediaUrl && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>{formatSeconds(currentTime)}</span>
                  <span>{formatSeconds(duration)}</span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlay}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 transition cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.05"
                    value={currentTime}
                    onChange={(e) => {
                      const t = parseFloat(e.target.value);
                      setCurrentTime(t);
                      if (videoRef.current) videoRef.current.currentTime = t;
                    }}
                    className="flex-1 accent-indigo-500 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Segments & Export */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-200 text-sm">Danh sách đoạn cần cắt</h3>
              <button
                onClick={addSegment}
                disabled={!mediaUrl}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm đoạn</span>
              </button>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-auto pr-1">
              {segments.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  Chưa có đoạn nào. Nhấn "Thêm đoạn" để tạo mốc cắt.
                </p>
              ) : (
                segments.map((seg, idx) => (
                  <div
                    key={seg.id}
                    className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={seg.name}
                        onChange={(e) => updateSegment(seg.id, { name: e.target.value })}
                        className="bg-transparent font-semibold text-slate-200 outline-none hover:border-b border-indigo-500/40"
                      />
                      <button
                        onClick={() => removeSegment(seg.id)}
                        className="text-slate-500 hover:text-rose-400 transition cursor-pointer"
                        title="Xóa đoạn này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block mb-1">
                          Bắt đầu (giây)
                        </span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max={seg.end}
                            step="0.1"
                            value={seg.start}
                            onChange={(e) =>
                              updateSegment(seg.id, { start: Math.max(0, parseFloat(e.target.value) || 0) })
                            }
                            className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-200"
                          />
                          <button
                            onClick={() => setSegmentToCurrent(seg.id, "start")}
                            title="Lấy thời gian phát hiện tại"
                            className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-indigo-400"
                          >
                            SET
                          </button>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block mb-1">
                          Kết thúc (giây)
                        </span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={seg.start}
                            max={duration || 1000}
                            step="0.1"
                            value={seg.end}
                            onChange={(e) =>
                              updateSegment(seg.id, { end: parseFloat(e.target.value) || 0 })
                            }
                            className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-200"
                          />
                          <button
                            onClick={() => setSegmentToCurrent(seg.id, "end")}
                            title="Lấy thời gian phát hiện tại"
                            className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-indigo-400"
                          >
                            SET
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 flex justify-between">
                      <span>Độ dài: {formatSeconds(Math.max(0, seg.end - seg.start))}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Export action */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <button
                onClick={exportAudio}
                disabled={!mediaUrl || !segments.length || isProcessing}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/20 active:scale-95 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>
                  {isProcessing
                    ? "Đang xuất âm thanh..."
                    : segments.length > 1
                    ? `Xuất ZIP (${segments.length} đoạn WAV)`
                    : "Xuất file audio WAV"}
                </span>
              </button>

              {statusMsg && (
                <p className="text-xs text-slate-400 text-center italic">{statusMsg}</p>
              )}

              {error && (
                <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
