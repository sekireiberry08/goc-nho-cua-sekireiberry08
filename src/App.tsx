import React, { useState, useEffect, lazy, Suspense } from "react";
import {
  Film,
  Eraser,
  Captions,
  FileText,
  Terminal,
  Sun,
  Moon,
  Layers,
  Loader2,
} from "lucide-react";

const MediaStudioView = lazy(() => import("./modules/media/MediaStudioView"));
const InpaintView = lazy(() => import("./modules/inpaint/InpaintView"));
const VideoToTextView = lazy(() => import("./modules/transcribe/VideoToTextView"));
const PdfView = lazy(() => import("./modules/pdf/PdfView"));
const CompilerView = lazy(() => import("./modules/compiler/CompilerView"));

type TabKey = "media" | "inpaint" | "transcribe" | "pdf" | "compiler";

interface TabDef {
  key: TabKey;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabDef[] = [
  { key: "media", label: "Video & Audio", shortLabel: "Video/MP3", icon: Film },
  { key: "inpaint", label: "Xoá vật thể", shortLabel: "Xoá ảnh", icon: Eraser },
  { key: "transcribe", label: "Video → TXT", shortLabel: "Video→TXT", icon: Captions },
  { key: "pdf", label: "PDF Studio", shortLabel: "PDF", icon: FileText },
  { key: "compiler", label: "MiRust Compiler", shortLabel: "MiRust", icon: Terminal },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "") as TabKey;
      if (TABS.some((t) => t.key === hash)) return hash;
      const saved = localStorage.getItem("goc-nho:active-tab") as TabKey;
      if (TABS.some((t) => t.key === saved)) return saved;
    }
    return "media";
  });

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("goc-nho:theme");
      if (saved === "light" || saved === "dark") return saved;
    }
    return "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("goc-nho:theme", theme);
  }, [theme]);

  const handleSelectTab = (tab: TabKey) => {
    setActiveTab(tab);
    window.location.hash = tab;
    localStorage.setItem("goc-nho:active-tab", tab);
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Clean Top Navigation */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 gap-4">
            {/* Brand */}
            <a
              href="#media"
              onClick={(e) => {
                e.preventDefault();
                handleSelectTab("media");
              }}
              className="flex items-center gap-2.5 shrink-0"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <span className="font-semibold text-sm tracking-tight">Góc nhỏ của sekireiberry08</span>
            </a>

            {/* Desktop Tabs */}
            <nav className="hidden md:flex items-center gap-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => handleSelectTab(tab.key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                      active
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 transition cursor-pointer"
              title={theme === "light" ? "Chuyển sang giao diện tối" : "Chuyển sang giao diện sáng"}
              aria-label="Toggle Theme"
            >
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </div>

          {/* Mobile Tabs */}
          <div className="flex md:hidden overflow-x-auto py-2 gap-1.5 border-t border-zinc-200/70 dark:border-zinc-800/70 no-scrollbar">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleSelectTab(tab.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                    active
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        <Suspense
          fallback={
            <div className="min-h-[420px] flex flex-col items-center justify-center text-zinc-500 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="text-xs">Đang tải...</span>
            </div>
          }
        >
          {activeTab === "media" && <MediaStudioView />}
          {activeTab === "inpaint" && <InpaintView />}
          {activeTab === "transcribe" && <VideoToTextView />}
          {activeTab === "pdf" && <PdfView />}
          {activeTab === "compiler" && <CompilerView />}
        </Suspense>
      </main>

      {/* Minimal Footer */}
      <footer className="mt-auto border-t border-zinc-200 dark:border-zinc-800/80 py-4 text-xs text-zinc-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <span>© 2026 Góc nhỏ của sekireiberry08</span>
          <span>5 công cụ hợp nhất</span>
        </div>
      </footer>
    </div>
  );
}
