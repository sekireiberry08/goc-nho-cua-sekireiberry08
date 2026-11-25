import React, { useState, useEffect, lazy, Suspense } from "react";
import {
  Terminal,
  BookOpen,
  Network,
  Ticket,
  FileText,
  Scissors,
  Sun,
  Moon,
  ShieldCheck,
  Sparkles,
  Laptop,
  Loader2,
} from "lucide-react";

const CompilerView = lazy(() => import("./modules/compiler/CompilerView"));
const HistoryView = lazy(() => import("./modules/history/HistoryView"));
const NetworksView = lazy(() => import("./modules/networks/NetworksView"));
const PromoPilotView = lazy(() => import("./modules/promopilot/PromoPilotView"));
const PdfView = lazy(() => import("./modules/pdf/PdfView"));
const AudioView = lazy(() => import("./modules/audio/AudioView"));

type TabKey = "compiler" | "history" | "networks" | "promopilot" | "pdf" | "audio";

interface TabDef {
  key: TabKey;
  label: string;
  shortLabel: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabDef[] = [
  {
    key: "compiler",
    label: "MiRust Compiler",
    shortLabel: "Compiler",
    badge: "v4",
    icon: Terminal,
  },
  {
    key: "history",
    label: "Lịch Sử Đảng",
    shortLabel: "LS Đảng",
    badge: "SP1039",
    icon: BookOpen,
  },
  {
    key: "networks",
    label: "Mạng Máy Tính",
    shortLabel: "MMT",
    badge: "8 Chương",
    icon: Network,
  },
  {
    key: "pdf",
    label: "Trích Xuất PDF",
    shortLabel: "PDF",
    icon: FileText,
  },
  {
    key: "audio",
    label: "Cắt Audio",
    shortLabel: "Audio",
    icon: Scissors,
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "") as TabKey;
      if (TABS.some((t) => t.key === hash)) return hash;
      const saved = localStorage.getItem("goc-nho:active-tab") as TabKey;
      if (TABS.some((t) => t.key === saved)) return saved;
    }
    return "compiler";
  });

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("goc-nho:theme");
      if (saved === "light" || saved === "dark") return saved;
      return "dark";
    }
    return "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "light") {
      document.body.classList.remove("bg-slate-950", "text-slate-100");
      document.body.classList.add("bg-slate-100", "text-slate-900");
    } else {
      document.body.classList.remove("bg-slate-100", "text-slate-900");
      document.body.classList.add("bg-slate-950", "text-slate-100");
    }
    localStorage.setItem("goc-nho:theme", theme);
  }, [theme]);

  const handleSelectTab = (tab: TabKey) => {
    setActiveTab(tab);
    window.location.hash = tab;
    localStorage.setItem("goc-nho:active-tab", tab);
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <div className={`min-h-screen flex flex-col ${theme === "light" ? "bg-slate-50 text-slate-900" : "bg-slate-950 text-slate-100"}`}>
      {/* Top Navbar */}
      <header className={`sticky top-0 z-40 backdrop-blur-md border-b transition-colors ${
        theme === "light"
          ? "bg-white/80 border-slate-200/80 shadow-xs"
          : "bg-slate-950/80 border-slate-800/80 shadow-md shadow-black/20"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Brand Logo & Name */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-0.5 shadow-md shadow-indigo-500/20">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                </div>
              </div>
              <div>
                <a
                  href="#"
                  onClick={() => handleSelectTab("compiler")}
                  className="font-bold text-base tracking-tight hover:opacity-90 flex items-center gap-1.5"
                >
                  <span>Góc nhỏ của sekireiberry08</span>
                </a>
                <p className="text-[11px] text-slate-500 hidden sm:block">
                  Unified Developer & Student Workspace
                </p>
              </div>
            </div>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden lg:flex items-center gap-1 p-1 rounded-xl bg-slate-900/60 border border-slate-800/80">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => handleSelectTab(tab.key)}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                        isActive ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
                      }`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right Utilities */}
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-[11px] font-medium text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Vercel Ready · 100% Client-side</span>
              </div>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300 transition cursor-pointer"
                title={theme === "light" ? "Chuyển giao diện tối" : "Chuyển giao diện sáng"}
                aria-label="Toggle Theme"
              >
                {theme === "light" ? <Moon className="w-4 h-4 text-amber-500" /> : <Sun className="w-4 h-4 text-amber-400" />}
              </button>
            </div>
          </div>

          {/* Mobile Tab Strip */}
          <div className="flex lg:hidden overflow-x-auto py-2 gap-1.5 border-t border-slate-800/40 no-scrollbar">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleSelectTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 bg-slate-900/60 border border-slate-800"
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

      {/* Main Content Area with Suspense */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Suspense
          fallback={
            <div className="min-h-[500px] flex flex-col items-center justify-center text-slate-500 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="text-xs">Đang tải giao diện...</span>
            </div>
          }
        >
          {activeTab === "compiler" && <CompilerView />}
          {activeTab === "history" && <HistoryView />}
          {activeTab === "networks" && <NetworksView />}
          {activeTab === "promopilot" && <PromoPilotView />}
          {activeTab === "pdf" && <PdfView />}
          {activeTab === "audio" && <AudioView />}
        </Suspense>
      </main>

      {/* Global Footer */}
      <footer className="mt-auto border-t border-slate-800/60 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span>© 2026 Góc nhỏ của sekireiberry08</span>
            <span>•</span>
            <span>Đại học Bách Khoa TP.HCM (HCMUT)</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span className="flex items-center gap-1">
              <Laptop className="w-3.5 h-3.5 text-indigo-400" /> React 19 + Vite + Tailwind CSS
            </span>
            <span>•</span>
            <span className="text-emerald-400">Deployable on Vercel</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
