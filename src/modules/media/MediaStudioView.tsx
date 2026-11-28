import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Film,
  Music,
  Upload,
  Play,
  Pause,
  Scissors,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Crop,
  Undo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Plus,
  Volume2,
  AlertCircle,
  Loader2,
  FileAudio,
} from "lucide-react";
import JSZip from "jszip";
import {
  audioBufferToMp3,
  audioBufferToWav,
  concatAudioSegments,
  decodeMediaFile,
  formatSeconds,
  formatTimestamp,
} from "./audioEncoder";

type MediaSubTab = "video" | "audio";

interface VideoSource {
  id: string;
  name: string;
  file: File;
  url: string;
  w: number;
  h: number;
  duration: number;
  hue: number;
}

interface VideoSegment {
  k: number;
  s: number;
  e: number;
}

interface AudioCutSegment {
  id: string;
  name: string;
  start: number;
  end: number;
}

const PAD = 24;
const clamp = (x: number, a: number, b: number) => Math.min(Math.max(x, a), b);
const fmtShort = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export default function MediaStudioView() {
  const [subTab, setSubTab] = useState<MediaSubTab>("video");

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Video & Audio Studio</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Cắt, ghép, crop video trực tiếp hoặc chuyển đổi MP4 sang MP3 / WAV.
          </p>
        </div>

        <div className="inline-flex p-1 rounded-lg bg-zinc-200/70 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 self-start">
          <button
            onClick={() => setSubTab("video")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              subTab === "video"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Cắt, ghép & crop video</span>
          </button>
          <button
            onClick={() => setSubTab("audio")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              subTab === "audio"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>MP4 → MP3 & Cắt Audio</span>
          </button>
        </div>
      </div>

      {subTab === "video" ? <VideoEditorPanel /> : <AudioConverterPanel />}
    </div>
  );
}

/* ============================================================================
   1. VIDEO EDITOR PANEL (Port of Cắt, ghép & crop video.html + Export MP3)
============================================================================ */
function VideoEditorPanel() {
  const [srcs, setSrcs] = useState<VideoSource[]>([]);
  const [segs, setSegs] = useState<VideoSegment[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [T, setT] = useState(0);
  const [pps, setPps] = useState(60);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hist, setHist] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Crop state
  const [cropMode, setCropMode] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const [lock, setLock] = useState<"orig" | number | null>("orig");
  const [ovRect, setOvRect] = useState<{ show: boolean; left: number; top: number; width: number; height: number }>({
    show: false,
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });

  // Export modal state
  const [exportModal, setExportModal] = useState<{
    open: boolean;
    title: string;
    msg: string;
    progress: number;
    done: boolean;
    blob: Blob | null;
    filename: string;
  }>({
    open: false,
    title: "",
    msg: "",
    progress: 0,
    done: false,
    blob: null,
    filename: "",
  });

  const stageRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoElsRef = useRef<Record<string, HTMLVideoElement | null>>({});

  // AudioContext graph refs (created once per video element)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const monRef = useRef<GainNode | null>(null);
  const sourceNodeMapRef = useRef<WeakMap<HTMLVideoElement, MediaElementAudioSourceNode>>(new WeakMap());

  // Mutable refs for rAF & pointer handlers
  const stateRef = useRef({ srcs, segs, sel, T, pps, activeIdx, playing, exporting, curSegIdx: 0 });
  stateRef.current = {
    srcs,
    segs,
    sel,
    T,
    pps,
    activeIdx,
    playing,
    exporting,
    curSegIdx: stateRef.current.curSegIdx,
  };

  const cropRef = useRef({ crop, lock, cropMode });
  cropRef.current = { crop, lock, cropMode };

  const cropDragRef = useRef<{
    h: string;
    r: DOMRect;
    sx: number;
    sy: number;
    c: { x: number; y: number; w: number; h: number };
  } | null>(null);
  const timelineDragRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 2000);
  }, []);

  const calcTotal = (list: VideoSegment[]) => list.reduce((a, s) => a + (s.e - s.s), 0);
  const calcCum = (list: VideoSegment[]) => {
    let c = 0;
    return list.map((s) => {
      const o = c;
      c += s.e - s.s;
      return o;
    });
  };
  const locateAt = (t: number, list: VideoSegment[]) => {
    let c = 0;
    for (let i = 0; i < list.length; i++) {
      const d = list[i].e - list[i].s;
      if (t < c + d || i === list.length - 1) return { i, local: clamp(t - c, 0, d) };
      c += d;
    }
    return null;
  };

  const getRefSrc = useCallback(() => {
    const { srcs: s, segs: g } = stateRef.current;
    return s[g.length ? g[0].k : 0];
  }, []);

  const placeOv = useCallback(() => {
    const { srcs: s, activeIdx: act } = stateRef.current;
    const { crop: cr, cropMode: cm } = cropRef.current;
    const src = s[act];
    const el = src ? videoElsRef.current[src.id] : null;
    const st = stageRef.current;
    if (!el || !st || !s.length) {
      setOvRect((p) => (p.show ? { ...p, show: false } : p));
      return;
    }
    const r = el.getBoundingClientRect();
    const sr = st.getBoundingClientRect();
    if ((!cm && cr.w > 0.999 && cr.h > 0.999) || !r.width) {
      setOvRect((p) => (p.show ? { ...p, show: false } : p));
      return;
    }
    setOvRect({
      show: true,
      left: r.left - sr.left,
      top: r.top - sr.top,
      width: r.width,
      height: r.height,
    });
  }, []);

  useEffect(() => {
    placeOv();
  }, [crop, cropMode, activeIdx, srcs, placeOv]);

  useEffect(() => {
    const onResize = () => placeOv();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [placeOv]);

  const activate = useCallback(
    (k: number) => {
      const { activeIdx: curAct, srcs: curSrcs } = stateRef.current;
      if (k === curAct) return;
      const prevSrc = curSrcs[curAct];
      if (prevSrc && videoElsRef.current[prevSrc.id]) {
        videoElsRef.current[prevSrc.id]!.pause();
      }
      stateRef.current.activeIdx = k;
      setActiveIdx(k);
      requestAnimationFrame(placeOv);
    },
    [placeOv]
  );

  const seek = useCallback(
    (t: number, customSegs?: VideoSegment[], customSrcs?: VideoSource[]) => {
      const list = customSegs ?? stateRef.current.segs;
      const sources = customSrcs ?? stateRef.current.srcs;
      if (!list.length) return;
      const clamped = clamp(t, 0, calcTotal(list));
      stateRef.current.T = clamped;
      setT(clamped);

      const L = locateAt(clamped, list);
      if (!L) return;
      const sg = list[L.i];
      stateRef.current.curSegIdx = L.i;
      activate(sg.k);
      const src = sources[sg.k];
      const el = src ? videoElsRef.current[src.id] : null;
      if (el) {
        el.currentTime = sg.s + L.local;
        if (stateRef.current.playing && !stateRef.current.exporting) {
          el.play().catch(() => {});
        }
      }
    },
    [activate]
  );

  const pause = useCallback(() => {
    const { srcs: s, activeIdx: act } = stateRef.current;
    const src = s[act];
    if (src && videoElsRef.current[src.id]) {
      videoElsRef.current[src.id]!.pause();
    }
    stateRef.current.playing = false;
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    const { segs: g, exporting: exp, T: curT, srcs: s, activeIdx: act } = stateRef.current;
    if (!g.length || exp) return;
    const tot = calcTotal(g);
    if (curT >= tot - 0.05) seek(0);
    const src = s[stateRef.current.activeIdx >= 0 ? stateRef.current.activeIdx : act];
    const el = src ? videoElsRef.current[src.id] : null;
    if (el) {
      el.play().catch(() => {});
      stateRef.current.playing = true;
      setPlaying(true);
    }
  }, [seek]);

  const togglePlay = useCallback(() => {
    if (stateRef.current.playing) pause();
    else play();
  }, [pause, play]);

  // Playback rAF loop
  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      const { playing: pl, exporting: exp, segs: g, srcs: s } = stateRef.current;
      if (pl && !exp && g.length) {
        const idx = stateRef.current.curSegIdx;
        const sg = g[idx];
        const src = sg ? s[sg.k] : null;
        const el = src ? videoElsRef.current[src.id] : null;
        if (sg && el) {
          if (el.currentTime >= sg.e - 0.04) {
            const nx = g[idx + 1];
            if (nx) {
              if (nx.k === sg.k && Math.abs(nx.s - sg.e) < 0.05) {
                stateRef.current.curSegIdx = idx + 1;
              } else {
                stateRef.current.curSegIdx = idx + 1;
                activate(nx.k);
                const nSrc = s[nx.k];
                const nEl = nSrc ? videoElsRef.current[nSrc.id] : null;
                if (nEl) {
                  nEl.currentTime = nx.s;
                  nEl.play().catch(() => {});
                }
              }
            } else {
              pause();
              seek(calcTotal(g));
            }
          }
          if (stateRef.current.playing) {
            const c = calcCum(g);
            const s2 = g[stateRef.current.curSegIdx];
            const actEl = s2 && s[s2.k] ? videoElsRef.current[s[s2.k].id] : null;
            if (s2 && actEl) {
              const nextT = c[stateRef.current.curSegIdx] + clamp(actEl.currentTime - s2.s, 0, s2.e - s2.s);
              stateRef.current.T = nextT;
              setT(nextT);
            }
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [activate, pause, seek]);

  const zoomTimeline = useCallback((nextPps: number, fx?: number) => {
    const p = clamp(nextPps, 5, 600);
    const sc = scrollerRef.current;
    if (!sc) {
      setPps(p);
      return;
    }
    const w = sc.clientWidth;
    const focusX = fx ?? w / 2;
    const tAtFocus = (sc.scrollLeft + focusX - PAD) / stateRef.current.pps;
    setPps(p);
    requestAnimationFrame(() => {
      sc.scrollLeft = tAtFocus * p + PAD - focusX;
    });
  }, []);

  const fitTimeline = useCallback(
    (customSegs?: VideoSegment[]) => {
      const list = customSegs ?? stateRef.current.segs;
      const tot = calcTotal(list) || 1;
      const sc = scrollerRef.current;
      const width = sc ? sc.clientWidth : 800;
      const next = clamp((width - PAD * 2) / tot, 5, 600);
      setPps(next);
      if (sc) sc.scrollLeft = 0;
    },
    []
  );

  const addFiles = async (fileList: FileList | File[]) => {
    if (exporting) return;
    const fs = Array.from(fileList).filter((f) => f.type.startsWith("video/"));
    if (!fs.length) {
      toast("Hãy chọn file video hợp lệ.");
      return;
    }

    const first = segs.length === 0;
    pause();
    if (segs.length) {
      setHist((h) => [...h.slice(-59), JSON.stringify({ segs, T })]);
    }
    const t0 = calcTotal(segs);
    toast("Đang nạp video...");

    const addedSources: VideoSource[] = [];
    const addedSegs: VideoSegment[] = [];
    let nextK = srcs.length;

    for (const f of fs) {
      const url = URL.createObjectURL(f);
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.src = url;
      try {
        await new Promise<void>((resolve, reject) => {
          probe.onloadedmetadata = () => resolve();
          probe.onerror = () => reject(new Error("Load metadata failed"));
        });
      } catch {
        URL.revokeObjectURL(url);
        toast(`Không đọc được: ${f.name}`);
        continue;
      }

      const k = nextK++;
      addedSources.push({
        id: crypto.randomUUID(),
        name: f.name,
        file: f,
        url,
        w: probe.videoWidth,
        h: probe.videoHeight,
        duration: probe.duration,
        hue: (k * 67 + 235) % 360,
      });
      addedSegs.push({ k, s: 0, e: probe.duration });
    }

    if (!addedSources.length) return;
    const nextSrcs = [...srcs, ...addedSources];
    const nextSegs = [...segs, ...addedSegs];
    setSrcs(nextSrcs);
    setSegs(nextSegs);
    setSel(null);

    setTimeout(() => {
      if (first) {
        fitTimeline(nextSegs);
        seek(0, nextSegs, nextSrcs);
      } else {
        seek(t0, nextSegs, nextSrcs);
      }
      placeOv();
    }, 50);

    toast(
      addedSources.length > 1 || !first
        ? `Đã ghép thêm ${addedSources.length} video vào timeline`
        : "Đã nạp video"
    );
  };

  const pushHistory = useCallback(() => {
    setHist((h) => [...h.slice(-59), JSON.stringify({ segs: stateRef.current.segs, T: stateRef.current.T })]);
  }, []);

  const splitAtPlayhead = useCallback(() => {
    const { segs: g, T: curT, exporting: exp } = stateRef.current;
    if (!g.length || exp) return;
    const L = locateAt(curT, g);
    if (!L) return;
    const s = g[L.i];
    const m = s.s + L.local;
    if (m - s.s < 0.05 || s.e - m < 0.05) {
      toast("Đặt đầu phát vào giữa một đoạn để cắt.");
      return;
    }
    pushHistory();
    const next = [...g];
    next.splice(L.i, 1, { k: s.k, s: s.s, e: m }, { k: s.k, s: m, e: s.e });
    setSegs(next);
    setSel(null);
    stateRef.current.curSegIdx = L.i + 1;
    toast("Đã cắt đoạn tại đầu phát");
  }, [pushHistory, toast]);

  const deleteSegment = useCallback(() => {
    const { segs: g, sel: curSel, T: curT, exporting: exp } = stateRef.current;
    if (!g.length || exp) return;
    const idx = curSel ?? locateAt(curT, g)?.i;
    if (idx == null) return;
    pushHistory();
    const c = calcCum(g)[idx];
    const next = g.filter((_, i) => i !== idx);
    setSegs(next);
    setSel(null);
    if (!next.length) {
      pause();
      setT(0);
      toast("Đã xoá hết — bấm Hoàn tác để khôi phục");
      return;
    }
    seek(Math.min(c, calcTotal(next)), next);
    toast("Đã xoá đoạn");
  }, [pause, pushHistory, seek, toast]);

  const moveSegment = useCallback(
    (d: -1 | 1) => {
      const { segs: g, sel: curSel, exporting: exp } = stateRef.current;
      if (exp || curSel == null) return;
      const j = curSel + d;
      if (j < 0 || j >= g.length) return;
      pushHistory();
      const next = [...g];
      [next[curSel], next[j]] = [next[j], next[curSel]];
      setSegs(next);
      setSel(j);
      seek(calcCum(next)[j], next);
    },
    [pushHistory, seek]
  );

  const undo = useCallback(() => {
    if (stateRef.current.exporting) return;
    setHist((h) => {
      if (!h.length) return h;
      const nextHist = h.slice(0, -1);
      const parsed = JSON.parse(h[h.length - 1]);
      setSegs(parsed.segs);
      setSel(null);
      if (parsed.segs.length) {
        setTimeout(() => seek(parsed.T, parsed.segs), 0);
      }
      return nextHist;
    });
  }, [seek]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /INPUT|TEXTAREA|SELECT/.test(target.tagName) && (target as HTMLInputElement).type !== "range") {
        return;
      }
      const k = e.key;
      if ((e.metaKey || e.ctrlKey) && k.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      } else if (k === "s" || k === "S") {
        e.preventDefault();
        splitAtPlayhead();
      } else if (k === "Delete" || k === "Backspace") {
        e.preventDefault();
        deleteSegment();
      } else if (k === "[") {
        e.preventDefault();
        moveSegment(-1);
      } else if (k === "]") {
        e.preventDefault();
        moveSegment(1);
      } else if (k === " ") {
        e.preventDefault();
        togglePlay();
      } else if (k === "ArrowLeft") {
        e.preventDefault();
        seek(stateRef.current.T - (e.shiftKey ? 1 : 1 / 30));
      } else if (k === "ArrowRight") {
        e.preventDefault();
        seek(stateRef.current.T + (e.shiftKey ? 1 : 1 / 30));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSegment, moveSegment, seek, splitAtPlayhead, togglePlay, undo]);

  // Timeline scrubbing
  const scrubTimeline = (clientX: number, clientY: number, isFirst: boolean) => {
    const tr = trackRef.current;
    if (!tr || !segs.length || exporting) return;
    const r = tr.getBoundingClientRect();
    const t = clamp((clientX - r.left - PAD) / pps, 0, calcTotal(segs));
    seek(t);
    if (isFirst) {
      if (clientY - r.top >= 36) {
        const L = locateAt(t, segs);
        setSel(L ? L.i : null);
      }
    }
  };

  // Crop helpers
  const getLockRatio = (lk: "orig" | number | null, rf?: VideoSource) => {
    if (!rf) return 16 / 9;
    return lk === "orig" ? rf.w / rf.h : lk ?? rf.w / rf.h;
  };

  const applyCropPreset = (preset: string) => {
    const rf = getRefSrc();
    if (!rf) return;
    const nextLock: "orig" | number | null =
      preset === "free" ? null : preset === "orig" ? "orig" : Number(preset);
    setLock(nextLock);
    if (nextLock !== null) {
      const r = getLockRatio(nextLock, rf);
      let pw = rf.w;
      let ph = rf.w / r;
      if (ph > rf.h) {
        ph = rf.h;
        pw = rf.h * r;
      }
      const w = pw / rf.w;
      const h = ph / rf.h;
      setCrop({ w, h, x: (1 - w) / 2, y: (1 - h) / 2 });
    }
  };

  const applyCropPixels = (pwIn: number, phIn: number, which: "w" | "h") => {
    const rf = getRefSrc();
    if (!rf) return;
    let pw = clamp(pwIn || rf.w, 2, rf.w);
    let ph = clamp(phIn || rf.h, 2, rf.h);
    if (lock !== null) {
      const r = getLockRatio(lock, rf);
      if (which === "w") ph = pw / r;
      else pw = ph * r;
      if (ph > rf.h) {
        ph = rf.h;
        pw = ph * r;
      }
      if (pw > rf.w) {
        pw = rf.w;
        ph = pw / r;
      }
    }
    const cx = crop.x + crop.w / 2;
    const cy = crop.y + crop.h / 2;
    const w = pw / rf.w;
    const h = ph / rf.h;
    setCrop({
      w,
      h,
      x: clamp(cx - w / 2, 0, 1 - w),
      y: clamp(cy - h / 2, 0, 1 - h),
    });
  };

  const getOutSize = (): [number, number] => {
    const rf = getRefSrc();
    if (!rf) return [1280, 720];
    const w = crop.w * rf.w;
    const h = crop.h * rf.h;
    const sc = Math.min(1, 3840 / Math.max(w, h));
    return [Math.max(2, Math.round(w * sc) & ~1), Math.max(2, Math.round(h * sc) & ~1)];
  };

  // Export Video
  const exportVideo = async () => {
    if (!segs.length || exporting) return;
    if (!window.MediaRecorder) {
      toast("Trình duyệt không hỗ trợ ghi video.");
      return;
    }

    pause();
    setCropMode(false);
    setExporting(true);
    stateRef.current.exporting = true;

    const [W, H] = getOutSize();
    const cv = exportCanvasRef.current!;
    const g = cv.getContext("2d")!;
    cv.width = W;
    cv.height = H;

    setExportModal({
      open: true,
      title: "Đang xuất video...",
      msg: "Video được ghi theo thời gian thực. Vui lòng giữ tab này mở.",
      progress: 0,
      done: false,
      blob: null,
      filename: "",
    });

    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const seekEl = (el: HTMLVideoElement, t: number) =>
      new Promise<void>((r) => {
        const h = () => {
          el.removeEventListener("seeked", h);
          r();
        };
        el.addEventListener("seeked", h);
        el.currentTime = t;
      });

    try {
      const AudioCtxClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtxClass();
      const AC = audioCtxRef.current;
      await AC.resume();
      if (!destRef.current) {
        destRef.current = AC.createMediaStreamDestination();
        monRef.current = AC.createGain();
        monRef.current.connect(AC.destination);
      }
      const dest = destRef.current;
      const mon = monRef.current!;

      for (const s of srcs) {
        const el = videoElsRef.current[s.id];
        if (el && !sourceNodeMapRef.current.has(el)) {
          const node = AC.createMediaElementSource(el);
          node.connect(dest);
          node.connect(mon);
          sourceNodeMapRef.current.set(el, node);
        }
      }
      mon.gain.value = 0;

      const stream = cv.captureStream(30);
      dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
      const types = [
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
      const mt = types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
      const rec = new MediaRecorder(stream, mt ? { mimeType: mt, videoBitsPerSecond: 8e6 } : { videoBitsPerSecond: 8e6 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const stopped = new Promise<void>((r) => (rec.onstop = () => r()));

      let drawOn = true;
      const draw = () => {
        if (!drawOn) return;
        const curSrc = stateRef.current.srcs[stateRef.current.activeIdx];
        const el = curSrc ? videoElsRef.current[curSrc.id] : null;
        g.fillStyle = "#000";
        g.fillRect(0, 0, W, H);
        if (el && el.videoWidth) {
          const sw = crop.w * el.videoWidth;
          const sh = crop.h * el.videoHeight;
          const r = Math.min(W / sw, H / sh);
          const w = sw * r;
          const h = sh * r;
          g.drawImage(el, crop.x * el.videoWidth, crop.y * el.videoHeight, sw, sh, (W - w) / 2, (H - h) / 2, w, h);
        }
        requestAnimationFrame(draw);
      };

      rec.start(500);
      draw();
      const tot = calcTotal(segs);
      let done = 0;

      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        const p = segs[i - 1];
        const src = srcs[s.k];
        const el = videoElsRef.current[src.id]!;
        if (!(i > 0 && p.k === s.k && Math.abs(s.s - p.e) < 0.06)) {
          activate(s.k);
          await seekEl(el, s.s);
          await wait(80);
          await el.play();
        }
        while (el.currentTime < s.e - 0.03 && !el.ended) {
          const prog = clamp((done + el.currentTime - s.s) / tot, 0, 1);
          setExportModal((m) => ({ ...m, progress: prog }));
          await wait(25);
        }
        done += s.e - s.s;
      }

      const lastSrc = srcs[stateRef.current.activeIdx];
      if (lastSrc && videoElsRef.current[lastSrc.id]) videoElsRef.current[lastSrc.id]!.pause();
      await wait(200);
      drawOn = false;
      rec.stop();
      await stopped;

      const ext = (rec.mimeType || mt).includes("mp4") ? "mp4" : "webm";
      const outBlob = new Blob(chunks, { type: ext === "mp4" ? "video/mp4" : "video/webm" });
      const outName = `video-ghep.${ext}`;
      setExportModal({
        open: true,
        title: "Xuất video hoàn tất",
        msg: `${outName} · ${W}×${H}px · ${(outBlob.size / 1048576).toFixed(1)} MB`,
        progress: 1,
        done: true,
        blob: outBlob,
        filename: outName,
      });
    } catch (err) {
      console.error(err);
      setExportModal({
        open: true,
        title: "Xuất video thất bại",
        msg: "Trình duyệt không cho phép ghi video này. Thử Chrome hoặc Safari mới.",
        progress: 0,
        done: true,
        blob: null,
        filename: "",
      });
    } finally {
      if (monRef.current) monRef.current.gain.value = 1;
      setExporting(false);
      stateRef.current.exporting = false;
      seek(0);
    }
  };

  // Export Timeline directly as MP3!
  const exportTimelineMp3 = async () => {
    if (!segs.length || exporting) return;
    pause();
    setExporting(true);
    stateRef.current.exporting = true;

    setExportModal({
      open: true,
      title: "Đang chuyển sang MP3...",
      msg: "Đang giải mã âm thanh từ timeline và nén MP3 192 kbps...",
      progress: 0.1,
      done: false,
      blob: null,
      filename: "",
    });

    try {
      const cache = new Map<number, AudioBuffer>();
      const uniqueKs = Array.from(new Set(segs.map((s) => s.k)));
      for (let i = 0; i < uniqueKs.length; i++) {
        const k = uniqueKs[i];
        cache.set(k, await decodeMediaFile(srcs[k].file));
        setExportModal((m) => ({ ...m, progress: 0.1 + 0.35 * ((i + 1) / uniqueKs.length) }));
      }

      const merged = concatAudioSegments(
        segs.map((s) => ({
          buffer: cache.get(s.k)!,
          start: s.s,
          end: s.e,
        }))
      );

      const mp3Bytes = await audioBufferToMp3(merged, 0, merged.duration, 192, (r) => {
        setExportModal((m) => ({ ...m, progress: 0.45 + 0.55 * r }));
      });
      const blob = new Blob([mp3Bytes], { type: "audio/mpeg" });
      const baseName = srcs[0]?.name.replace(/\.[^.]+$/, "") || "audio";
      const outName = `${baseName}.mp3`;

      setExportModal({
        open: true,
        title: "Chuyển MP3 hoàn tất",
        msg: `${outName} · 192 kbps · ${(blob.size / 1048576).toFixed(2)} MB`,
        progress: 1,
        done: true,
        blob,
        filename: outName,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi giải mã âm thanh";
      setExportModal({
        open: true,
        title: "Chuyển MP3 thất bại",
        msg: `Không thể giải mã audio của video này: ${msg}`,
        progress: 0,
        done: true,
        blob: null,
        filename: "",
      });
    } finally {
      setExporting(false);
      stateRef.current.exporting = false;
    }
  };

  const tot = calcTotal(segs);
  const cumList = calcCum(segs);
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  const tickStep = steps.find((s) => s * pps >= 80) || 600;
  const ticks: number[] = [];
  for (let t = 0; t <= tot + 1e-6; t += tickStep) ticks.push(t);

  const rf = getRefSrc();
  const cropPxW = rf ? Math.round(crop.w * rf.w) : 0;
  const cropPxH = rf ? Math.round(crop.h * rf.h) : 0;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden flex flex-col">
      {/* Top Toolbar */}
      <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm video</span>
          </button>
          <span className="text-xs text-zinc-500 hidden md:inline">
            Phím tắt: <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[11px]">Space</kbd> Phát ·{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[11px]">S</kbd> Cắt ·{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[11px]">Del</kbd> Xoá
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportTimelineMp3}
            disabled={!segs.length || exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 transition cursor-pointer"
          >
            <FileAudio className="w-3.5 h-3.5 text-indigo-500" />
            <span>Xuất MP3</span>
          </button>
          <button
            onClick={exportVideo}
            disabled={!segs.length || exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất video</span>
          </button>
        </div>
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className="relative h-[380px] bg-zinc-950 flex items-center justify-center p-3 overflow-hidden"
      >
        {srcs.map((s, i) => (
          <video
            key={s.id}
            ref={(el) => {
              videoElsRef.current[s.id] = el;
            }}
            src={s.url}
            playsInline
            preload="auto"
            onLoadedMetadata={() => {
              if (i === activeIdx) placeOv();
            }}
            className={`max-w-full max-h-full rounded-lg bg-black ${i === activeIdx ? "block" : "hidden"}`}
          />
        ))}

        {!segs.length && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl px-8 py-12 text-center cursor-pointer transition max-w-md ${
              dragOver
                ? "border-indigo-500 bg-indigo-500/10 text-zinc-100"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            <Film className="w-9 h-9 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-medium text-zinc-200">Kéo thả video vào đây hoặc bấm “Thêm video”</p>
            <p className="text-xs text-zinc-500 mt-1">Hỗ trợ chọn nhiều video để ghép nối trên cùng timeline.</p>
          </div>
        )}

        {/* Crop Overlay */}
        {ovRect.show && (
          <div
            onPointerDown={(e) => {
              if (!cropMode) return;
              const target = e.target as HTMLElement;
              const handle = target.dataset.c || (target.dataset.box ? "move" : "");
              if (!handle) return;
              e.preventDefault();
              target.setPointerCapture(e.pointerId);
              cropDragRef.current = {
                h: handle,
                r: e.currentTarget.getBoundingClientRect(),
                sx: e.clientX,
                sy: e.clientY,
                c: { ...crop },
              };
            }}
            onPointerMove={(e) => {
              const cd = cropDragRef.current;
              if (!cd) return;
              const { r, c } = cd;
              const W = r.width;
              const H = r.height;
              if (cd.h === "move") {
                setCrop({
                  ...c,
                  x: clamp(c.x + (e.clientX - cd.sx) / W, 0, 1 - c.w),
                  y: clamp(c.y + (e.clientY - cd.sy) / H, 0, 1 - c.h),
                });
              } else {
                const fx = (cd.h.includes("w") ? c.x + c.w : c.x) * W;
                const fy = (cd.h.includes("n") ? c.y + c.h : c.y) * H;
                const px = clamp(e.clientX - r.left, 0, W);
                const py = clamp(e.clientY - r.top, 0, H);
                const dx = Math.abs(px - fx);
                const dy = Math.abs(py - fy);
                let w = dx;
                let h = dy;
                const refSrc = getRefSrc();
                if (lock !== null && refSrc) {
                  const rd = getLockRatio(lock, refSrc) * (W / refSrc.w) * (refSrc.h / H);
                  w = Math.max(Math.min(dx, dy * rd), 16);
                  h = w / rd;
                } else {
                  w = Math.max(w, 16);
                  h = Math.max(h, 16);
                }
                const x0 = clamp(px >= fx ? fx : fx - w, 0, W - w);
                const y0 = clamp(py >= fy ? fy : fy - h, 0, H - h);
                setCrop({ x: x0 / W, y: y0 / H, w: w / W, h: h / H });
              }
            }}
            onPointerUp={() => (cropDragRef.current = null)}
            onPointerCancel={() => (cropDragRef.current = null)}
            className="absolute overflow-hidden z-10 pointer-events-none"
            style={{
              left: ovRect.left,
              top: ovRect.top,
              width: ovRect.width,
              height: ovRect.height,
            }}
          >
            <div
              data-box="1"
              className={`absolute border-2 border-white box-border shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] ${
                cropMode ? "pointer-events-auto cursor-move touch-none" : "pointer-events-none"
              }`}
              style={{
                left: crop.x * ovRect.width,
                top: crop.y * ovRect.height,
                width: crop.w * ovRect.width,
                height: crop.h * ovRect.height,
              }}
            >
              {cropMode &&
                (["nw", "ne", "sw", "se"] as const).map((corner) => (
                  <i
                    key={corner}
                    data-c={corner}
                    className={`absolute w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-sm pointer-events-auto touch-none ${
                      corner === "nw"
                        ? "-left-2 -top-2 cursor-nwse-resize"
                        : corner === "ne"
                        ? "-right-2 -top-2 cursor-nesw-resize"
                        : corner === "sw"
                        ? "-left-2 -bottom-2 cursor-nesw-resize"
                        : "-right-2 -bottom-2 cursor-nwse-resize"
                    }`}
                  />
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Crop Bar */}
      {cropMode && (
        <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-medium text-zinc-600 dark:text-zinc-300 mr-1">Tỉ lệ Crop:</span>
          {[
            { r: "orig", label: "Gốc" },
            { r: "1.7778", label: "16:9" },
            { r: "0.5625", label: "9:16" },
            { r: "1", label: "1:1" },
            { r: "0.8", label: "4:5" },
            { r: "1.3333", label: "4:3" },
            { r: "free", label: "Tự do" },
          ].map((p) => {
            const active =
              p.r === "orig"
                ? lock === "orig"
                : p.r === "free"
                ? lock === null
                : typeof lock === "number" && Math.abs(lock - Number(p.r)) < 1e-3;
            return (
              <button
                key={p.r}
                onClick={() => applyCropPreset(p.r)}
                className={`px-2.5 py-1 rounded-md border transition cursor-pointer ${
                  active
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {p.label}
              </button>
            );
          })}
          <div className="flex-1" />
          <span className="text-zinc-500">Kích thước:</span>
          <input
            type="number"
            min={2}
            value={cropPxW}
            onChange={(e) => applyCropPixels(Number(e.target.value), cropPxH, "w")}
            className="w-16 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
          />
          <span>×</span>
          <input
            type="number"
            min={2}
            value={cropPxH}
            onChange={(e) => applyCropPixels(cropPxW, Number(e.target.value), "h")}
            className="w-16 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
          />
          <button
            onClick={() => applyCropPreset("orig")}
            className="px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            Đặt lại
          </button>
          <button
            onClick={() => setCropMode(false)}
            className="px-2.5 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 cursor-pointer"
          >
            Xong
          </button>
        </div>
      )}

      {/* Playback & Edit Bar */}
      <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-1.5 text-xs">
        <button
          onClick={togglePlay}
          disabled={!segs.length || exporting}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 cursor-pointer"
        >
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{playing ? "Dừng" : "Phát"}</span>
        </button>

        <button
          onClick={splitAtPlayhead}
          disabled={!segs.length || exporting}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
        >
          <Scissors className="w-3.5 h-3.5" />
          <span>Cắt</span>
        </button>

        <button
          onClick={deleteSegment}
          disabled={!segs.length || exporting}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Xoá</span>
        </button>

        <button
          onClick={() => moveSegment(-1)}
          disabled={exporting || sel == null || sel < 1}
          title="Dời đoạn sang trái ([)"
          className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => moveSegment(1)}
          disabled={exporting || sel == null || sel >= segs.length - 1}
          title="Dời đoạn sang phải (])"
          className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => {
            const next = !cropMode;
            setCropMode(next);
            if (next) pause();
          }}
          disabled={!segs.length || exporting}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border disabled:opacity-40 cursor-pointer transition ${
            cropMode
              ? "bg-indigo-600 border-indigo-600 text-white"
              : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <Crop className="w-3.5 h-3.5" />
          <span>Crop</span>
        </button>

        <button
          onClick={undo}
          disabled={!hist.length || exporting}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span>Hoàn tác</span>
        </button>

        <span className="font-mono text-xs text-zinc-500 px-2">
          {formatTimestamp(T)} / {formatTimestamp(tot)}
        </span>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <button
            onClick={() => zoomTimeline(pps / 1.5)}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            title="Thu nhỏ timeline"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <input
            type="range"
            min={0.7}
            max={2.78}
            step={0.01}
            value={Math.log10(pps)}
            onChange={(e) => zoomTimeline(Math.pow(10, Number(e.target.value)))}
            className="w-24 accent-indigo-600 cursor-pointer"
          />
          <button
            onClick={() => zoomTimeline(pps * 1.5)}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            title="Phóng to timeline"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => fitTimeline()}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Vừa</span>
          </button>
        </div>
      </div>

      {/* Timeline Track */}
      <div
        ref={scrollerRef}
        onWheel={(e) => {
          const sc = scrollerRef.current;
          if (!sc) return;
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            zoomTimeline(pps * Math.exp(-e.deltaY * 0.01), e.clientX - sc.getBoundingClientRect().left);
          } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            e.preventDefault();
            sc.scrollLeft += e.deltaY;
          }
        }}
        className="h-32 overflow-x-auto overflow-y-hidden border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 relative"
      >
        <div
          ref={trackRef}
          onPointerDown={(e) => {
            if (!segs.length || exporting) return;
            timelineDragRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            scrubTimeline(e.clientX, e.clientY, true);
          }}
          onPointerMove={(e) => {
            if (timelineDragRef.current) scrubTimeline(e.clientX, e.clientY, false);
          }}
          onPointerUp={() => (timelineDragRef.current = false)}
          onPointerCancel={() => (timelineDragRef.current = false)}
          className="relative h-full min-w-full select-none cursor-pointer touch-pan-x"
          style={{ width: PAD * 2 + tot * pps }}
        >
          {/* Ruler */}
          <div className="absolute inset-x-0 top-0 h-7 border-b border-zinc-200 dark:border-zinc-800">
            {ticks.map((tk) => (
              <div
                key={tk}
                className="absolute top-3.5 bottom-0 border-l border-zinc-300 dark:border-zinc-700"
                style={{ left: PAD + tk * pps }}
              >
                <span className="absolute -top-3.5 left-1 font-mono text-[10px] text-zinc-400 whitespace-nowrap">
                  {tickStep < 1 ? formatTimestamp(tk) : fmtShort(tk)}
                </span>
              </div>
            ))}
          </div>

          {/* Clips */}
          <div className="absolute inset-x-0 top-10 h-16">
            {segs.map((s, i) => {
              const h = srcs[s.k]?.hue ?? 240;
              return (
                <div
                  key={`${i}-${s.k}-${s.s}`}
                  className={`absolute top-0 h-16 box-border rounded-lg text-white text-[11px] px-2 py-1.5 overflow-hidden whitespace-nowrap border-2 ${
                    i === sel ? "border-amber-400 shadow-sm" : "border-transparent"
                  }`}
                  style={{
                    left: PAD + cumList[i] * pps,
                    width: Math.max(4, (s.e - s.s) * pps),
                    background: `linear-gradient(hsl(${h} 60% 52%), hsl(${h} 60% 40%))`,
                  }}
                >
                  <div className="font-mono font-semibold">{formatTimestamp(s.e - s.s)}</div>
                  <div className="opacity-85 truncate">{srcs[s.k]?.name}</div>
                </div>
              );
            })}
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 left-0 w-0 pointer-events-none z-10"
            style={{ transform: `translateX(${PAD + T * pps}px)` }}
          >
            <div className="absolute -left-px inset-y-0 w-0.5 bg-rose-500" />
            <div className="absolute -left-1.5 top-0 w-3 h-3 bg-rose-500 rounded-t-sm rounded-b-full" />
          </div>
        </div>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-zinc-900/90 text-white text-xs shadow-lg z-40">
          {toastMsg}
        </div>
      )}

      {/* Export Modal */}
      {exportModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 w-full max-w-sm text-center space-y-3 shadow-xl">
            <h3 className="font-semibold text-base">{exportModal.title}</h3>
            <div className="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-150"
                style={{ width: `${Math.round(exportModal.progress * 100)}%` }}
              />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{exportModal.msg}</p>
            {exportModal.done && (
              <div className="flex items-center justify-center gap-2 pt-1">
                {exportModal.blob && (
                  <button
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(exportModal.blob!);
                      a.download = exportModal.filename;
                      a.click();
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium cursor-pointer"
                  >
                    Tải xuống
                  </button>
                )}
                <button
                  onClick={() => setExportModal((m) => ({ ...m, open: false }))}
                  className="px-3.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <canvas ref={exportCanvasRef} className="hidden" />
    </div>
  );
}

/* ============================================================================
   2. MP4 -> MP3 & AUDIO CUTTER PANEL
============================================================================ */
function AudioConverterPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [segments, setSegments] = useState<AudioCutSegment[]>([]);
  const [format, setFormat] = useState<"mp3" | "wav">("mp3");
  const [kbps, setKbps] = useState<128 | 192 | 320>(192);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (incoming?: File) => {
    if (!incoming) return;
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    const url = URL.createObjectURL(incoming);
    setFile(incoming);
    setMediaUrl(url);
    setError(null);
    setStatusMsg(`Đã nạp: ${incoming.name}`);
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
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    setDuration(dur);
    setSegments((prev) =>
      prev.map((s) => ({
        ...s,
        end: Number(Math.min(dur, Math.max(5, dur / 2)).toFixed(1)),
      }))
    );
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
    const start = Number(Math.min(currentTime, Math.max(0, duration - 5)).toFixed(1));
    const end = Number(Math.min(duration, start + 10).toFixed(1));
    setSegments((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: `Đoạn ${prev.length + 1}`, start, end },
    ]);
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const convertFullToMp3 = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setStatusMsg("Đang giải mã âm thanh từ video...");

    try {
      const buffer = await decodeMediaFile(file);
      setStatusMsg(`Đang nén toàn bộ sang MP3 (${kbps} kbps)...`);
      const bytes = await audioBufferToMp3(buffer, 0, buffer.duration, kbps, (r) => {
        setStatusMsg(`Đang nén MP3 (${Math.round(r * 100)}%)...`);
      });
      const baseName = file.name.replace(/\.[^.]+$/, "");
      triggerDownload(new Blob([bytes], { type: "audio/mpeg" }), `${baseName}.mp3`);
      setStatusMsg(`Hoàn tất: đã xuất ${baseName}.mp3`);
    } catch (err: unknown) {
      setError(`Không thể chuyển sang MP3: ${err instanceof Error ? err.message : "Lỗi không xác định"}`);
    } finally {
      setBusy(false);
    }
  };

  const exportSegments = async () => {
    if (!file || !segments.length || busy) return;
    setBusy(true);
    setError(null);
    setStatusMsg("Đang giải mã âm thanh...");

    try {
      const buffer = await decodeMediaFile(file);
      const ext = format;
      const mime = format === "mp3" ? "audio/mpeg" : "audio/wav";

      const encodeSlice = async (seg: AudioCutSegment) => {
        if (format === "mp3") {
          return audioBufferToMp3(buffer, seg.start, seg.end, kbps);
        }
        return audioBufferToWav(buffer, seg.start, seg.end);
      };

      if (segments.length === 1) {
        const seg = segments[0];
        setStatusMsg(`Đang xuất ${seg.name}.${ext}...`);
        const data = await encodeSlice(seg);
        triggerDownload(new Blob([data], { type: mime }), `${seg.name.replace(/\s+/g, "_")}.${ext}`);
      } else {
        const zip = new JSZip();
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          setStatusMsg(`Đang xử lý đoạn ${i + 1}/${segments.length}...`);
          const data = await encodeSlice(seg);
          zip.file(`${String(i + 1).padStart(2, "0")}_${seg.name.replace(/\s+/g, "_")}.${ext}`, data);
        }
        const zipBlob = await zip.generateAsync({ type: "blob" });
        triggerDownload(zipBlob, `audio_cuts_${ext}_${Date.now()}.zip`);
      }

      setStatusMsg(`Hoàn tất xuất ${segments.length} đoạn ${ext.toUpperCase()}.`);
    } catch (err: unknown) {
      setError(`Không thể xuất âm thanh: ${err instanceof Error ? err.message : "Lỗi không xác định"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left: Media Preview & Quick Full MP4 -> MP3 */}
      <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,audio/*,.mp4,.mov,.webm,.mkv,.mp3,.wav,.m4a"
            hidden
            onChange={(e) => {
              handleFileChange(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{file ? "Đổi tệp khác" : "Chọn video / audio"}</span>
          </button>

          {file && (
            <span className="text-xs text-zinc-500 truncate max-w-xs">
              {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
            </span>
          )}
        </div>

        <div className="aspect-video bg-zinc-950 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
          {mediaUrl ? (
            <video
              ref={videoRef}
              src={mediaUrl}
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
              onEnded={() => setIsPlaying(false)}
              className="w-full h-full object-contain"
              playsInline
            />
          ) : (
            <div className="text-center p-6 text-zinc-500 space-y-2">
              <Volume2 className="w-9 h-9 mx-auto opacity-40" />
              <p className="text-sm font-medium text-zinc-300">Chưa có tệp nào được chọn</p>
              <p className="text-xs">Chọn MP4, MOV, WebM hoặc file âm thanh để chuyển sang MP3 hoặc cắt đoạn.</p>
            </div>
          )}
        </div>

        {mediaUrl && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-500 font-mono">
              <span>{formatSeconds(currentTime)}</span>
              <span>{formatSeconds(duration)}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.05}
                value={currentTime}
                onChange={(e) => {
                  const t = parseFloat(e.target.value);
                  setCurrentTime(t);
                  if (videoRef.current) videoRef.current.currentTime = t;
                }}
                className="flex-1 accent-indigo-600 cursor-pointer"
              />
            </div>

            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-zinc-500">Chuyển nhanh toàn bộ tệp sang MP3:</span>
              <button
                onClick={convertFullToMp3}
                disabled={!file || busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-medium transition cursor-pointer"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileAudio className="w-3.5 h-3.5" />}
                <span>Chuyển toàn bộ → MP3 ({kbps} kbps)</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: Segments & Format */}
      <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Cắt thành nhiều đoạn</h3>
          <button
            onClick={addSegment}
            disabled={!mediaUrl}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 text-xs font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm đoạn</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-500">Định dạng:</span>
          {(["mp3", "wav"] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => setFormat(fmt)}
              className={`px-2.5 py-1 rounded-md border uppercase font-medium cursor-pointer ${
                format === fmt
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {fmt}
            </button>
          ))}
          {format === "mp3" && (
            <select
              value={kbps}
              onChange={(e) => setKbps(Number(e.target.value) as 128 | 192 | 320)}
              className="ml-auto px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent text-xs"
            >
              <option value={128}>128 kbps</option>
              <option value={192}>192 kbps</option>
              <option value={320}>320 kbps</option>
            </select>
          )}
        </div>

        <div className="space-y-2.5 max-h-[340px] overflow-auto pr-1">
          {segments.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-8">Chưa có đoạn nào.</p>
          ) : (
            segments.map((seg) => (
              <div
                key={seg.id}
                className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={seg.name}
                    onChange={(e) =>
                      setSegments((prev) => prev.map((s) => (s.id === seg.id ? { ...s, name: e.target.value } : s)))
                    }
                    className="bg-transparent font-medium outline-none border-b border-transparent focus:border-indigo-500"
                  />
                  <button
                    onClick={() => setSegments((prev) => prev.filter((s) => s.id !== seg.id))}
                    className="text-zinc-400 hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[11px] text-zinc-500 block mb-1">Bắt đầu (s)</span>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        min={0}
                        max={seg.end}
                        step={0.1}
                        value={seg.start}
                        onChange={(e) =>
                          setSegments((prev) =>
                            prev.map((s) =>
                              s.id === seg.id ? { ...s, start: Math.max(0, parseFloat(e.target.value) || 0) } : s
                            )
                          )
                        }
                        className="w-full px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono"
                      />
                      <button
                        onClick={() =>
                          setSegments((prev) =>
                            prev.map((s) => (s.id === seg.id ? { ...s, start: Number(currentTime.toFixed(1)) } : s))
                          )
                        }
                        className="px-1.5 rounded bg-zinc-200 dark:bg-zinc-800 text-[10px] font-semibold cursor-pointer"
                      >
                        SET
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-zinc-500 block mb-1">Kết thúc (s)</span>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        min={seg.start}
                        max={duration || 1000}
                        step={0.1}
                        value={seg.end}
                        onChange={(e) =>
                          setSegments((prev) =>
                            prev.map((s) =>
                              s.id === seg.id ? { ...s, end: parseFloat(e.target.value) || 0 } : s
                            )
                          )
                        }
                        className="w-full px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono"
                      />
                      <button
                        onClick={() =>
                          setSegments((prev) =>
                            prev.map((s) => (s.id === seg.id ? { ...s, end: Number(currentTime.toFixed(1)) } : s))
                          )
                        }
                        className="px-1.5 rounded bg-zinc-200 dark:bg-zinc-800 text-[10px] font-semibold cursor-pointer"
                      >
                        SET
                      </button>
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-zinc-500">
                  Độ dài: {formatSeconds(Math.max(0, seg.end - seg.start))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
          <button
            onClick={exportSegments}
            disabled={!mediaUrl || !segments.length || busy}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium text-xs transition cursor-pointer"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>
              {segments.length > 1
                ? `Xuất ZIP (${segments.length} đoạn ${format.toUpperCase()})`
                : `Xuất đoạn ${format.toUpperCase()}`}
            </span>
          </button>

          {statusMsg && <p className="text-xs text-zinc-500 text-center">{statusMsg}</p>}
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
