import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload,
  Sparkles,
  Eraser,
  Undo2,
  RotateCcw,
  Eye,
  Download,
  Image as ImageIcon,
} from "lucide-react";

function dilateMask(mask: Uint8Array, w: number, h: number, iterations: number) {
  for (let k = 0; k < iterations; k++) {
    const prev = mask.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (
          !prev[i] &&
          ((x > 0 && prev[i - 1]) ||
            (x < w - 1 && prev[i + 1]) ||
            (y > 0 && prev[i - w]) ||
            (y < h - 1 && prev[i + w]))
        ) {
          mask[i] = 1;
        }
      }
    }
  }
}

async function runPatchInpaint(
  img: ImageData,
  mask: Uint8Array,
  w: number,
  h: number,
  onProgress: (p: number) => void
): Promise<boolean> {
  const d = img.data;
  const R = 4;
  const N = (2 * R + 1) ** 2;

  let x0 = w;
  let y0 = h;
  let x1 = 0;
  let y1 = 0;
  let total = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        total++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }

  const S = Math.max(60, Math.round(Math.max(x1 - x0, y1 - y0) * 0.8));
  const wx0 = Math.max(R, x0 - S);
  const wy0 = Math.max(R, y0 - S);
  const wx1 = Math.min(w - 1 - R, x1 + S);
  const wy1 = Math.min(h - 1 - R, y1 + S);

  const IW = w + 1;
  const integral = new Int32Array(IW * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += mask[y * w + x];
      integral[(y + 1) * IW + x + 1] = integral[y * IW + x + 1] + rowSum;
    }
  }

  const valid = new Uint8Array(w * h);
  const cands: number[] = [];
  for (let y = wy0; y <= wy1; y++) {
    for (let x = wx0; x <= wx1; x++) {
      const sum =
        integral[(y + R + 1) * IW + x + R + 1] -
        integral[(y - R) * IW + x + R + 1] -
        integral[(y + R + 1) * IW + x - R] +
        integral[(y - R) * IW + x - R];
      if (!sum) {
        valid[y * w + x] = 1;
        cands.push(y * w + x);
      }
    }
  }
  if (!cands.length) return false;

  const known = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) known[i] = mask[i] ? 0 : 1;
  const src = new Int32Array(w * h).fill(-1);

  const ox: number[] = [];
  const oy: number[] = [];
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      ox.push(dx);
      oy.push(dy);
    }
  }

  const tj = new Int32Array(N);
  const tr = new Int16Array(N);
  const tg = new Int16Array(N);
  const tb = new Int16Array(N);
  const K = Math.min(cands.length, 350);

  let left = total;
  let t0 = performance.now();

  while (left > 0) {
    const ring: number[] = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x;
        if (known[i]) continue;
        if (
          (x > 0 && known[i - 1]) ||
          (x < w - 1 && known[i + 1]) ||
          (y > 0 && known[i - w]) ||
          (y < h - 1 && known[i + w])
        ) {
          ring.push(i);
        }
      }
    }
    if (!ring.length) break;

    const res = new Int32Array(ring.length);
    for (let k = 0; k < ring.length; k++) {
      const p = ring[k];
      const px = p % w;
      const py = (p / w) | 0;
      let n = 0;
      for (let j = 0; j < N; j++) {
        const qx = px + ox[j];
        const qy = py + oy[j];
        if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
        const q = qy * w + qx;
        if (known[q]) {
          tj[n] = oy[j] * w + ox[j];
          tr[n] = d[q * 4];
          tg[n] = d[q * 4 + 1];
          tb[n] = d[q * 4 + 2];
          n++;
        }
      }

      const score = (c: number, lim: number) => {
        let s = 0;
        for (let j = 0; j < n; j++) {
          const q = (c + tj[j]) * 4;
          const a = d[q] - tr[j];
          const b = d[q + 1] - tg[j];
          const e = d[q + 2] - tb[j];
          s += a * a + b * b + e * e;
          if (s >= lim) return s;
        }
        return s;
      };

      let best = -1;
      let bestScore = 1e18;
      for (let t = 0; t < K; t++) {
        const c = cands[(Math.random() * cands.length) | 0];
        const s = score(c, bestScore);
        if (s < bestScore) {
          bestScore = s;
          best = c;
        }
      }

      for (const q of [p - 1, p + 1, p - w, p + w]) {
        if (q < 0 || q >= w * h || src[q] < 0) continue;
        const c = src[q] + (p - q);
        if (c >= 0 && c < w * h && valid[c]) {
          const s = score(c, bestScore);
          if (s < bestScore) {
            bestScore = s;
            best = c;
          }
        }
      }
      res[k] = best;
    }

    for (let k = 0; k < ring.length; k++) {
      const i = ring[k];
      const c = res[k];
      d[i * 4] = d[c * 4];
      d[i * 4 + 1] = d[c * 4 + 1];
      d[i * 4 + 2] = d[c * 4 + 2];
      src[i] = c;
      known[i] = 1;
      left--;
    }

    if (performance.now() - t0 > 40) {
      onProgress(1 - left / total);
      await new Promise((r) => setTimeout(r));
      t0 = performance.now();
    }
  }

  // Smooth filled region slightly to blend edges
  const copy = d.slice();
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const qx = x + dx;
            const qy = y + dy;
            if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
            sum += copy[(qy * w + qx) * 4 + c];
            count++;
          }
        }
        d[i * 4 + c] = copy[i * 4 + c] * 0.5 + (sum / count) * 0.5;
      }
    }
  }

  return true;
}

export default function InpaintView() {
  const baseRef = useRef<HTMLCanvasElement>(null);
  const ovRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const dimsRef = useRef({ w: 0, h: 0 });
  const origRef = useRef<ImageData | null>(null);
  const histRef = useRef<ImageData[]>([]);
  const keepPeekRef = useRef<ImageData | null>(null);
  const drawingRef = useRef(false);
  const lastPtRef = useRef<[number, number] | null>(null);

  const [hasImage, setHasImage] = useState(false);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [brushSize, setBrushSize] = useState(28);
  const [autoErase, setAutoErase] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [historyLen, setHistoryLen] = useState(0);
  const [status, setStatus] = useState("Chọn ảnh, dán (Ctrl/Cmd+V) hoặc kéo thả vào đây rồi tô lên vật thể muốn xoá.");
  const [cursorStyle, setCursorStyle] = useState<{ visible: boolean; x: number; y: number; d: number }>({
    visible: false,
    x: 0,
    y: 0,
    d: 28,
  });

  const applyCanvasImage = useCallback((source: HTMLImageElement | HTMLCanvasElement) => {
    const base = baseRef.current;
    const ov = ovRef.current;
    if (!base || !ov) return;

    const scale = Math.min(1, 1600 / Math.max(source.width, source.height));
    const w = Math.round(source.width * scale);
    const h = Math.round(source.height * scale);

    base.width = ov.width = w;
    base.height = ov.height = h;
    dimsRef.current = { w, h };
    setDims({ w, h });

    const bc = base.getContext("2d", { willReadFrequently: true });
    const oc = ov.getContext("2d", { willReadFrequently: true });
    if (!bc || !oc) return;

    bc.drawImage(source, 0, 0, w, h);
    oc.clearRect(0, 0, w, h);
    origRef.current = bc.getImageData(0, 0, w, h);
    histRef.current = [];
    setHistoryLen(0);
    setHasImage(true);
    setStatus(`Tô lên chi tiết muốn xoá · Kích thước ${w}×${h}px`);
  }, []);

  const loadFromUrl = useCallback(
    (url: string, revokeAfter = false) => {
      const im = new Image();
      im.onload = () => {
        applyCanvasImage(im);
        if (revokeAfter) URL.revokeObjectURL(url);
      };
      im.src = url;
    },
    [applyCanvasImage]
  );

  const loadDemo = () => {
    const c = document.createElement("canvas");
    c.width = 900;
    c.height = 560;
    const x = c.getContext("2d");
    if (!x) return;
    const g = x.createLinearGradient(0, 0, 900, 560);
    g.addColorStop(0, "#5ec2ff");
    g.addColorStop(0.55, "#ffd27a");
    g.addColorStop(1, "#ff7a9c");
    x.fillStyle = g;
    x.fillRect(0, 0, 900, 560);
    for (let i = 0; i < 160; i++) {
      x.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
      x.beginPath();
      x.arc(Math.random() * 900, Math.random() * 560, Math.random() * 40, 0, Math.PI * 2);
      x.fill();
    }
    x.fillStyle = "#222";
    x.font = "bold 86px sans-serif";
    x.fillText("XOÁ TÔI", 240, 300);
    x.fillStyle = "#d11";
    x.beginPath();
    x.arc(700, 150, 48, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = "#fff";
    x.font = "28px sans-serif";
    x.fillText("Watermark 2026", 560, 520);
    applyCanvasImage(c);
  };

  const runErase = useCallback(async () => {
    const { w, h } = dimsRef.current;
    const base = baseRef.current;
    const ov = ovRef.current;
    if (busy || !w || !base || !ov) return;

    const bc = base.getContext("2d", { willReadFrequently: true });
    const oc = ov.getContext("2d", { willReadFrequently: true });
    if (!bc || !oc) return;

    const ovData = oc.getImageData(0, 0, w, h).data;
    const mask = new Uint8Array(w * h);
    let any = false;
    for (let i = 0; i < w * h; i++) {
      if (ovData[i * 4 + 3] > 20) {
        mask[i] = 1;
        any = true;
      }
    }
    if (!any) return;

    dilateMask(mask, w, h, 2);
    setBusy(true);
    setStatus("Đang xử lý xoá vùng tô...");

    const before = bc.getImageData(0, 0, w, h);
    const work = new ImageData(new Uint8ClampedArray(before.data), w, h);
    const ok = await runPatchInpaint(work, mask, w, h, setProgress);

    if (ok) {
      histRef.current.push(before);
      if (histRef.current.length > 20) histRef.current.shift();
      setHistoryLen(histRef.current.length);
      bc.putImageData(work, 0, 0);
      setStatus("Hoàn tất. Bạn có thể tô tiếp hoặc Hoàn tác.");
    } else {
      setStatus("Không đủ vùng nền tham chiếu — hãy thử tô vùng nhỏ hơn.");
    }

    oc.clearRect(0, 0, w, h);
    setProgress(0);
    setBusy(false);
  }, [busy]);

  const handleUndo = useCallback(() => {
    if (busy || !histRef.current.length || !baseRef.current) return;
    const bc = baseRef.current.getContext("2d", { willReadFrequently: true });
    const prev = histRef.current.pop();
    if (bc && prev) {
      bc.putImageData(prev, 0, 0);
      setHistoryLen(histRef.current.length);
      setStatus("Đã hoàn tác.");
    }
  }, [busy]);

  const handleReset = () => {
    if (!origRef.current || busy || !baseRef.current || !ovRef.current) return;
    const bc = baseRef.current.getContext("2d", { willReadFrequently: true });
    const oc = ovRef.current.getContext("2d", { willReadFrequently: true });
    if (!bc || !oc) return;
    bc.putImageData(origRef.current, 0, 0);
    oc.clearRect(0, 0, dimsRef.current.w, dimsRef.current.h);
    histRef.current = [];
    setHistoryLen(0);
    setStatus("Đã đặt lại ảnh gốc.");
  };

  const handleDownload = () => {
    if (!dims.w || !baseRef.current) return;
    const url = baseRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `inpainted_${Date.now()}.png`;
    a.click();
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) loadFromUrl(URL.createObjectURL(f), true);
        }
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("paste", onPaste);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("keydown", onKey);
    };
  }, [handleUndo, loadFromUrl]);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const ov = ovRef.current!;
    const rect = ov.getBoundingClientRect();
    return [
      ((e.clientX - rect.left) * dimsRef.current.w) / rect.width,
      ((e.clientY - rect.top) * dimsRef.current.h) / rect.height,
    ];
  };

  const drawStroke = (a: [number, number], b: [number, number]) => {
    const oc = ovRef.current?.getContext("2d", { willReadFrequently: true });
    if (!oc) return;
    oc.strokeStyle = oc.fillStyle = "#f43f5e";
    oc.lineCap = "round";
    oc.lineJoin = "round";
    oc.lineWidth = brushSize;
    oc.beginPath();
    oc.moveTo(a[0], a[1]);
    oc.lineTo(b[0], b[1]);
    oc.stroke();
  };

  const updateCursor = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ov = ovRef.current;
    if (!ov || !dimsRef.current.w) return;
    const rect = ov.getBoundingClientRect();
    setCursorStyle({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      d: (brushSize * rect.width) / dimsRef.current.w,
    });
  };

  const peekOn = () => {
    if (!origRef.current || busy || !baseRef.current) return;
    const bc = baseRef.current.getContext("2d", { willReadFrequently: true });
    if (!bc) return;
    keepPeekRef.current = bc.getImageData(0, 0, dimsRef.current.w, dimsRef.current.h);
    bc.putImageData(origRef.current, 0, 0);
  };

  const peekOff = () => {
    if (!keepPeekRef.current || !baseRef.current) return;
    const bc = baseRef.current.getContext("2d", { willReadFrequently: true });
    if (!bc) return;
    bc.putImageData(keepPeekRef.current, 0, 0);
    keepPeekRef.current = null;
  };

  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Cọ xoá vật thể ảnh</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Tô lên watermark, chữ hoặc chi tiết thừa để xoá trực tiếp trên trình duyệt.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) loadFromUrl(URL.createObjectURL(f), true);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Chọn ảnh</span>
          </button>
          <button
            onClick={loadDemo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Ảnh mẫu</span>
          </button>
          <button
            onClick={handleDownload}
            disabled={!hasImage || busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Lưu ảnh PNG</span>
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <span>Cỡ cọ</span>
          <input
            type="range"
            min={4}
            max={120}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-28 accent-indigo-600 cursor-pointer"
          />
          <span className="font-mono text-[11px] w-9 text-right text-zinc-500">{brushSize}px</span>
        </label>

        <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoErase}
            onChange={(e) => setAutoErase(e.target.checked)}
            className="accent-indigo-600 rounded"
          />
          <span>Tự xoá khi thả chuột</span>
        </label>

        <div className="flex-1" />

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={runErase}
            disabled={!hasImage || busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 transition cursor-pointer"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Xoá vùng tô</span>
          </button>

          <button
            onClick={handleUndo}
            disabled={!historyLen || busy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Hoàn tác</span>
          </button>

          <button
            onClick={handleReset}
            disabled={!hasImage || busy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Đặt lại</span>
          </button>

          <button
            onPointerDown={peekOn}
            onPointerUp={peekOff}
            onPointerLeave={peekOff}
            disabled={!hasImage || busy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition cursor-pointer select-none"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Giữ xem gốc</span>
          </button>
        </div>
      </div>

      {/* Progress & Status */}
      <div className="space-y-1.5">
        <div className="h-1 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 transition-all duration-100"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{status}</p>
      </div>

      {/* Canvas Stage */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f && f.type.startsWith("image/")) loadFromUrl(URL.createObjectURL(f), true);
        }}
        className="min-h-[460px] rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center p-4 overflow-auto"
        style={{
          backgroundImage:
            "repeating-conic-gradient(rgba(128,128,128,0.08) 0% 25%, transparent 0% 50%)",
          backgroundSize: "20px 20px",
        }}
      >
        {!hasImage && (
          <div className="text-center space-y-2 text-zinc-500 dark:text-zinc-400">
            <ImageIcon className="w-10 h-10 mx-auto opacity-40" />
            <p className="text-sm font-medium">Chưa có ảnh nào được chọn</p>
            <p className="text-xs">Kéo thả, dán ảnh (⌘V / Ctrl+V), bấm “Chọn ảnh” hoặc “Ảnh mẫu”.</p>
          </div>
        )}

        <div className={`relative leading-none shadow-xl ${hasImage ? "block" : "hidden"}`}>
          <canvas
            ref={baseRef}
            className="max-w-full max-h-[68vh] w-auto h-auto block rounded-lg"
          />
          <canvas
            ref={ovRef}
            onPointerDown={(e) => {
              if (busy || !dimsRef.current.w) return;
              drawingRef.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              const pt = getCanvasPoint(e);
              lastPtRef.current = pt;
              drawStroke(pt, pt);
              updateCursor(e);
            }}
            onPointerMove={(e) => {
              updateCursor(e);
              if (!drawingRef.current || !lastPtRef.current) return;
              const pt = getCanvasPoint(e);
              drawStroke(lastPtRef.current, pt);
              lastPtRef.current = pt;
            }}
            onPointerLeave={() => {
              if (!drawingRef.current) setCursorStyle((prev) => ({ ...prev, visible: false }));
            }}
            onPointerUp={() => {
              if (!drawingRef.current) return;
              drawingRef.current = false;
              if (autoErase) runErase();
            }}
            onPointerCancel={() => {
              drawingRef.current = false;
            }}
            className="absolute inset-0 w-full h-full opacity-55 touch-none cursor-none rounded-lg"
          />
        </div>
      </div>

      {/* Floating Brush Cursor */}
      {cursorStyle.visible && (
        <div
          className="fixed pointer-events-none rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.8)] -translate-x-1/2 -translate-y-1/2 z-50"
          style={{
            left: cursorStyle.x,
            top: cursorStyle.y,
            width: Math.max(4, cursorStyle.d),
            height: Math.max(4, cursorStyle.d),
          }}
        />
      )}
    </div>
  );
}
