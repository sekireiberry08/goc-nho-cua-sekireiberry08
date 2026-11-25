import React from "react";
import {
  Layers,
  Clock,
  BrainCircuit,
  AlertCircle,
  BookMarked,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";

export default function Sidebar({
  activeTab,
  setActiveTab,
  selectedChapter,
  setSelectedChapter,
  quizFilter,
  setQuizFilter,
  stats,
  onResetProgress,
}) {
  const chapters = [
    { id: "ALL", label: "Tất cả các chương" },
    {
      id: 1,
      label: "Chương 1: Đảng ra đời & Lãnh đạo giành chính quyền (1930-1945)",
    },
    { id: 2, label: "Chương 2: Lãnh đạo hai cuộc kháng chiến (1945-1975)" },
    {
      id: 3,
      label: "Chương 3: Lãnh đạo cả nước quá độ lên CNXH & Đổi mới (1975-nay)",
    },
  ];

  const percent =
    stats.totalQuestions > 0
      ? Math.round((stats.completedCount / stats.totalQuestions) * 100)
      : 0;

  return (
    <aside className="w-full lg:w-72 shrink-0 space-y-5">
      {/* Thẻ Tiến độ học tập */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Tiến độ hoàn thành
          </span>
          <span className="text-sm font-extrabold text-red-700">
            {percent}%
          </span>
        </div>
        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-red-700 h-full transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
          <div className="bg-emerald-50 text-emerald-800 p-2 rounded-lg flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <div>
              <div className="font-bold">{stats.completedCount}</div>
              <div className="text-[11px] opacity-80">Đã làm</div>
            </div>
          </div>
          <div className="bg-amber-50 text-amber-800 p-2 rounded-lg flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <div>
              <div className="font-bold">{stats.wrongCount}</div>
              <div className="text-[11px] opacity-80">Cần ôn lại</div>
            </div>
          </div>
        </div>
      </div>

      {/* Chọn Chương học */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 pb-1">
          <BookMarked className="w-4 h-4 text-red-700" /> Phạm vi ôn tập
        </div>
        <div className="space-y-1.5">
          {chapters.map((ch) => {
            const active = String(selectedChapter) === String(ch.id);
            return (
              <button
                key={ch.id}
                onClick={() => setSelectedChapter(ch.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition leading-snug ${
                  active
                    ? "bg-red-700 text-white font-semibold shadow-sm"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {ch.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chế độ học */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-1">
          Công cụ luyện tập
        </div>
        <button
          onClick={() => setActiveTab("theory")}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
            activeTab === "theory"
              ? "bg-red-50 text-red-800 border border-red-200"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4" /> Trọng tâm & CĐR
          </span>
          <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">
            {stats.theoryCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("timeline")}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
            activeTab === "timeline"
              ? "bg-red-50 text-red-800 border border-red-200"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4" /> Nối Timeline
          </span>
          <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">
            {stats.timelineCount}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("quiz");
            setQuizFilter("ALL");
          }}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
            activeTab === "quiz" && quizFilter === "ALL"
              ? "bg-red-50 text-red-800 border border-red-200"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <span className="flex items-center gap-2">
            <BrainCircuit className="w-4 h-4" /> Ngân hàng câu hỏi
          </span>
          <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">
            {stats.totalQuestions}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("quiz");
            setQuizFilter("WRONG");
          }}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
            activeTab === "quiz" && quizFilter === "WRONG"
              ? "bg-amber-100 text-amber-900 border border-amber-300"
              : "text-amber-700 hover:bg-amber-50/70"
          }`}
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Ôn lại câu sai
          </span>
          <span className="text-xs bg-amber-200/80 px-2 py-0.5 rounded-full font-bold">
            {stats.wrongCount}
          </span>
        </button>
      </div>

      {/* Nút Reset */}
      <button
        onClick={onResetProgress}
        className="w-full py-2 px-3 text-xs text-slate-500 hover:text-red-700 flex items-center justify-center gap-1.5 transition"
      >
        <RotateCcw className="w-3.5 h-3.5" /> Xóa tiến độ làm lại từ đầu
      </button>
    </aside>
  );
}
