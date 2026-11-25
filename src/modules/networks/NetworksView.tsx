import React, { useState, useEffect, useMemo } from "react";
import {
  Network,
  CheckCircle2,
  XCircle,
  Eye,
  RotateCcw,
  Zap,
  Filter,
  BarChart3,
  Award,
  HelpCircle,
  AlertCircle,
  BookOpen,
} from "lucide-react";
// @ts-ignore
import { quizData } from "./data/questions.js";

const SESSION_KEY = "quiz-mmt:session:v2";

export default function NetworksView() {
  const chapters = useMemo(() => Object.keys(quizData), []);
  const [selectedChapter, setSelectedChapter] = useState<string>(chapters[0] || "");
  const [autoCheck, setAutoCheck] = useState(true);
  const [showAllAnswers, setShowAllAnswers] = useState(false);
  const [onlyWrong, setOnlyWrong] = useState(false);

  // User state: map question key -> { selectedOptionIndex: number, checked: boolean, isCorrect: boolean }
  const [userAnswers, setUserAnswers] = useState<Record<string, { selected: number; isCorrect: boolean }>>(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(userAnswers));
    } catch (e) {
      console.warn("Could not save answers to localStorage", e);
    }
  }, [userAnswers]);

  // Questions for current selection
  const rawQuestions = useMemo(() => {
    if (!selectedChapter) return [];
    if (selectedChapter === "ALL") {
      return chapters.flatMap((chap, chapIdx) =>
        quizData[chap].map((q: any, qIdx: number) => ({
          ...q,
          chapter: chap,
          key: `${chapIdx}-${qIdx}-${q.q.slice(0, 30)}`,
        }))
      );
    }
    const chapIdx = chapters.indexOf(selectedChapter);
    return (quizData[selectedChapter] || []).map((q: any, qIdx: number) => ({
      ...q,
      chapter: selectedChapter,
      key: `${chapIdx}-${qIdx}-${q.q.slice(0, 30)}`,
    }));
  }, [selectedChapter, chapters]);

  // Filtered by wrong
  const questions = useMemo(() => {
    if (!onlyWrong) return rawQuestions;
    return rawQuestions.filter((q) => {
      const ans = userAnswers[q.key];
      return ans && !ans.isCorrect;
    });
  }, [rawQuestions, onlyWrong, userAnswers]);

  // Stats calculation
  const stats = useMemo(() => {
    let done = 0;
    let correct = 0;
    let wrong = 0;

    rawQuestions.forEach((q) => {
      const a = userAnswers[q.key];
      if (a !== undefined) {
        done++;
        if (a.isCorrect) correct++;
        else wrong++;
      }
    });

    const accuracy = done > 0 ? Math.round((correct / done) * 100) : 0;
    return { total: rawQuestions.length, done, correct, wrong, accuracy };
  }, [rawQuestions, userAnswers]);

  const handleSelectOption = (qKey: string, optIdx: number, correctIdx: number) => {
    const isCorrect = optIdx === correctIdx;
    setUserAnswers((prev) => ({
      ...prev,
      [qKey]: { selected: optIdx, isCorrect },
    }));
  };

  const resetChapterProgress = () => {
    if (!window.confirm("Bạn có chắc muốn đặt lại toàn bộ câu trả lời của chương này?")) return;
    const nextAnswers = { ...userAnswers };
    rawQuestions.forEach((q) => {
      delete nextAnswers[q.key];
    });
    setUserAnswers(nextAnswers);
    setShowAllAnswers(false);
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-sky-950/30 p-5 rounded-2xl border border-sky-900/40 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-sky-400 text-sm font-semibold tracking-wider uppercase">
            <Network className="w-4 h-4" />
            <span>Ngân Hàng Câu Hỏi Mạng Máy Tính (HCMUT)</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mt-1">
            Ôn Thi Mạng Máy Tính Toàn Diện
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            8 Chương chuẩn hóa • Phản hồi đúng/sai tức thì • Giải thích chi tiết từng câu
          </p>
        </div>

        {/* Global badges */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300 font-medium">
            Tổng cộng: <strong className="text-sky-300">{chapters.reduce((sum, c) => sum + quizData[c].length, 0)}</strong> câu
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300 font-medium">
            <strong>8</strong> Chương / Chủ đề
          </div>
        </div>
      </div>

      {/* Control Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Chapter Selector */}
          <div className="flex-1 max-w-xl">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Chọn chương / chủ đề để luyện tập:
            </label>
            <select
              value={selectedChapter}
              onChange={(e) => {
                setSelectedChapter(e.target.value);
                setShowAllAnswers(false);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 text-slate-100 border border-slate-700 focus:border-sky-500 focus:outline-none text-sm transition"
            >
              {chapters.map((chap, idx) => (
                <option key={idx} value={chap}>
                  {chap} ({quizData[chap]?.length} câu)
                </option>
              ))}
              <option value="ALL">🌟 Tất cả các chương (Tổng hợp)</option>
            </select>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
            <button
              onClick={() => setShowAllAnswers(!showAllAnswers)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
                showAllAnswers
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showAllAnswers ? "Ẩn đáp án gợi ý" : "Hiện tất cả đáp án"}</span>
            </button>

            <button
              onClick={() => setOnlyWrong(!onlyWrong)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
                onlyWrong
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{onlyWrong ? "Hiện tất cả" : `Chỉ câu làm sai (${stats.wrong})`}</span>
            </button>

            <button
              onClick={resetChapterProgress}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 text-xs font-medium transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Làm lại phần này</span>
            </button>
          </div>
        </div>

        {/* Live Chapter Stats & Progress Bar */}
        <div className="pt-3 border-t border-slate-800/80 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-4">
              <span>Tổng số: <strong className="text-slate-200">{stats.total}</strong> câu</span>
              <span>Đã làm: <strong className="text-slate-200">{stats.done}</strong></span>
              <span className="text-emerald-400">Đúng: <strong>{stats.correct}</strong></span>
              <span className="text-rose-400">Sai: <strong>{stats.wrong}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span>Độ chính xác:</span>
              <span className={`font-bold text-sm ${stats.accuracy >= 80 ? "text-emerald-400" : stats.accuracy >= 50 ? "text-amber-400" : "text-rose-400"}`}>
                {stats.accuracy}%
              </span>
            </div>
          </div>

          {/* Progress bar line */}
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${stats.total ? (stats.correct / stats.total) * 100 : 0}%` }}
              title={`Đúng: ${stats.correct}`}
            />
            <div
              className="bg-rose-500 h-full transition-all duration-300"
              style={{ width: `${stats.total ? (stats.wrong / stats.total) * 100 : 0}%` }}
              title={`Sai: ${stats.wrong}`}
            />
          </div>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {questions.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 space-y-2">
            <Award className="w-10 h-10 text-emerald-500/80 mx-auto" />
            <p className="text-slate-300 font-semibold">Không có câu hỏi nào để hiển thị!</p>
            {onlyWrong && <p className="text-xs">Bạn chưa có câu nào làm sai trong chương này.</p>}
          </div>
        ) : (
          questions.map((q, idx) => {
            const userAns = userAnswers[q.key];
            const isAnswered = userAns !== undefined;
            const correctOptIdx = q.ans;

            return (
              <div
                key={q.key}
                className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 hover:border-slate-700/80 transition"
              >
                {/* Question title & header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="shrink-0 px-2.5 py-1 rounded-lg bg-sky-950/60 text-sky-400 border border-sky-800/40 text-xs font-bold font-mono">
                      Câu {idx + 1}
                    </span>
                    <h3 className="text-slate-200 font-medium text-sm sm:text-base leading-relaxed">
                      {q.q}
                    </h3>
                  </div>

                  {isAnswered && (
                    <div className="shrink-0">
                      {userAns.isCorrect ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-lg">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đúng
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-bold text-rose-400 bg-rose-950/40 border border-rose-800/40 px-2 py-0.5 rounded-lg">
                          <XCircle className="w-3.5 h-3.5" /> Sai
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Optional question image */}
                {q.image && (
                  <div className="my-2 p-2 bg-slate-950 rounded-xl border border-slate-800 max-w-lg">
                    <img
                      src={q.image.startsWith("/") ? q.image : `/${q.image}`}
                      alt="Hình minh họa câu hỏi"
                      className="max-h-72 rounded-lg object-contain mx-auto"
                      loading="lazy"
                    />
                  </div>
                )}

                {/* Options list */}
                <div className="grid grid-cols-1 gap-2">
                  {q.options.map((opt: string, optIdx: number) => {
                    const isSelected = userAns?.selected === optIdx;
                    const isTargetCorrect = optIdx === correctOptIdx;
                    const showCorrectness = isAnswered || showAllAnswers;

                    let btnStyle = "bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40";

                    if (showCorrectness) {
                      if (isTargetCorrect) {
                        btnStyle = "bg-emerald-950/40 border-emerald-600/60 text-emerald-300 font-semibold";
                      } else if (isSelected && !isTargetCorrect) {
                        btnStyle = "bg-rose-950/40 border-rose-600/60 text-rose-300 font-semibold";
                      }
                    }

                    return (
                      <button
                        key={optIdx}
                        onClick={() => handleSelectOption(q.key, optIdx, correctOptIdx)}
                        className={`w-full text-left p-3 rounded-xl border text-xs sm:text-sm flex items-start gap-3 transition cursor-pointer ${btnStyle}`}
                      >
                        <span
                          className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5 ${
                            showCorrectness && isTargetCorrect
                              ? "bg-emerald-500 text-slate-950"
                              : showCorrectness && isSelected && !isTargetCorrect
                              ? "bg-rose-500 text-white"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span className="flex-1 leading-snug">{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Detailed Explanation */}
                {(isAnswered || showAllAnswers) && q.explain && (
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 leading-relaxed space-y-1">
                    <div className="font-semibold text-sky-400 flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Giải thích chi tiết:</span>
                    </div>
                    <p>{q.explain}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
