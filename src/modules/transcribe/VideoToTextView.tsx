import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  FileText,
  Download,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  RefreshCw,
  Video,
} from "lucide-react";

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface HealthInfo {
  ok: boolean;
  ffmpeg: boolean;
  whisper: boolean;
  defaultWhisperModel: string;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatSrtTime(seconds: number) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${String(milli).padStart(3, "0")}`;
}

function formatVttTime(seconds: number) {
  return formatSrtTime(seconds).replace(",", ".");
}

function formatDuration(seconds: number) {
  const total = Math.round(seconds || 0);
  return `${Math.floor(total / 60)} phút ${total % 60} giây`;
}

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function VideoToTextView() {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<"auto" | "vi" | "en">("auto");
  const [model, setModel] = useState("small");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(true);

  const [transcript, setTranscript] = useState("");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [meta, setMeta] = useState<string | null>(null);
  const [baseName, setBaseName] = useState("transcript");

  const inputRef = useRef<HTMLInputElement>(null);

  const checkBackend = async () => {
    setCheckingHealth(true);
    try {
      const res = await fetch("/api/health");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as HealthInfo;
      setHealth(data);
      if (data.defaultWhisperModel) setModel(data.defaultWhisperModel);
    } catch {
      setHealth(null);
    } finally {
      setCheckingHealth(false);
    }
  };

  useEffect(() => {
    checkBackend();
  }, []);

  const handleTranscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || busy) return;
    setError(null);
    setBusy(true);

    try {
      const data = new FormData();
      data.append("video", file);
      data.append("language", language);
      data.append("model", model);

      const res = await fetch("/api/video-to-txt/transcribe", {
        method: "POST",
        body: data,
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Không thể xử lý video.");
      }

      const langNames: Record<string, string> = { vi: "Tiếng Việt", en: "Tiếng Anh" };
      setSegments(payload.segments || []);
      setTranscript(payload.text || "");
      setBaseName((payload.filename || "transcript").replace(/\.[^.]+$/, "") || "transcript");
      setMeta(
        `Ngôn ngữ: ${langNames[payload.language] || payload.language} · Model: ${payload.model} · ${formatDuration(
          payload.duration
        )}`
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Không kết nối được Local Backend. Hãy khởi chạy bằng start.command."
      );
    } finally {
      setBusy(false);
    }
  };

  const copyTranscript = () => {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const downloadSrt = () => {
    const content = segments
      .map((s, i) => `${i + 1}\n${formatSrtTime(s.start)} --> ${formatSrtTime(s.end)}\n${s.text}\n`)
      .join("\n");
    downloadText(`${baseName}.srt`, content, "text/plain;charset=utf-8");
  };

  const downloadVtt = () => {
    const content =
      "WEBVTT\n\n" +
      segments.map((s) => `${formatVttTime(s.start)} --> ${formatVttTime(s.end)}\n${s.text}\n`).join("\n");
    downloadText(`${baseName}.vtt`, content, "text/vtt;charset=utf-8");
  };

  const backendReady = Boolean(health?.ok && health.ffmpeg && health.whisper);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Video → Văn bản</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Chuyển giọng nói trong video/audio thành TXT, SRT, VTT cục bộ bằng Whisper & FFmpeg.
          </p>
        </div>

        <button
          onClick={checkBackend}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border self-start cursor-pointer transition ${
            backendReady
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checkingHealth ? "animate-spin" : ""}`} />
          <span>
            {checkingHealth
              ? "Đang kiểm tra backend..."
              : backendReady
              ? "Local Whisper Ready"
              : "Cần bật Local Backend (start.command)"}
          </span>
        </button>
      </div>

      {/* Offline warning if backend unavailable */}
      {!checkingHealth && !backendReady && (
        <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300 space-y-1">
          <p className="font-medium">
            {health
              ? `Backend đang chạy nhưng thiếu thành phần: ${!health.ffmpeg ? "FFmpeg " : ""}${
                  !health.whisper ? "faster-whisper" : ""
                }`
              : "Chưa kết nối được Python Local Backend (127.0.0.1:5050)."}
          </p>
          <p className="opacity-85">
            Chạy <code className="font-mono px-1 py-0.5 rounded bg-black/10 dark:bg-white/10">./start.command</code>{" "}
            hoặc{" "}
            <code className="font-mono px-1 py-0.5 rounded bg-black/10 dark:bg-white/10">
              python3 backend/app.py
            </code>{" "}
            để sử dụng tính năng nhận diện giọng nói.
          </p>
        </div>
      )}

      {/* Upload Form */}
      <form
        onSubmit={handleTranscribe}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4"
      >
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) setFile(f);
          }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition space-y-2 ${
            dragging
              ? "border-indigo-500 bg-indigo-500/5"
              : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*,audio/*,.mkv,.avi,.m4v,.mp3,.wav,.m4a"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFile(f);
              e.target.value = "";
            }}
          />
          <Video className="w-8 h-8 mx-auto text-zinc-400" />
          <p className="text-sm font-medium">
            {file ? file.name : "Kéo video hoặc audio vào đây, hoặc bấm để chọn"}
          </p>
          <p className="text-xs text-zinc-500">
            {file
              ? `${(file.size / 1048576).toFixed(1)} MB`
              : "Hỗ trợ MP4, MOV, MKV, WebM, AVI, M4V, MP3, WAV, M4A"}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-xs">
            <span className="text-zinc-500 block">Ngôn ngữ</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as "auto" | "vi" | "en")}
              className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs"
            >
              <option value="auto">Tự nhận diện</option>
              <option value="vi">Tiếng Việt</option>
              <option value="en">Tiếng Anh</option>
            </select>
          </label>

          <label className="space-y-1 text-xs">
            <span className="text-zinc-500 block">Model Whisper</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs"
            >
              <option value="base">base (Nhanh, nhẹ)</option>
              <option value="small">small (Cân bằng)</option>
              <option value="medium">medium (Chính xác cao)</option>
            </select>
          </label>

          <div className="flex-1" />

          <button
            type="submit"
            disabled={!file || busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium transition cursor-pointer"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang nhận diện...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Chuyển thành văn bản</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </form>

      {/* Output */}
      {(transcript || segments.length > 0) && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-500" />
                <span>Văn bản đã nhận diện</span>
              </h2>
              {meta && <p className="text-xs text-zinc-500 mt-0.5">{meta}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={copyTranscript}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Đã chép" : "Chép"}</span>
              </button>
              <button
                onClick={() => downloadText(`${baseName}.txt`, transcript, "text/plain;charset=utf-8")}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>TXT</span>
              </button>
              <button
                onClick={downloadSrt}
                disabled={!segments.length}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 text-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>SRT</span>
              </button>
              <button
                onClick={downloadVtt}
                disabled={!segments.length}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 text-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>VTT</span>
              </button>
            </div>
          </div>

          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={10}
            className="w-full p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm leading-relaxed outline-none focus:border-indigo-500"
          />
          <p className="text-[11px] text-zinc-500">
            Bạn có thể chỉnh sửa trực tiếp văn bản trước khi tải TXT. File SRT/VTT giữ nguyên mốc thời gian nhận diện.
          </p>
        </div>
      )}
    </div>
  );
}
