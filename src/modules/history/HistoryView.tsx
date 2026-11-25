import React, { useState, useEffect, useMemo } from "react";
import { Download, UserCheck, BookOpen, Clock, HelpCircle, AlertTriangle, RefreshCw, Layers } from "lucide-react";
// @ts-ignore
import { getOrCreateGuestId, getProgress, saveQuizResult, exportProgressJson } from "./utils/guestStorage";
// @ts-ignore
import { loadExcelData } from "./utils/excelParser";
// @ts-ignore
import Sidebar from "./components/Sidebar";
// @ts-ignore
import TheoryView from "./components/TheoryView";
// @ts-ignore
import QuizEngine from "./components/QuizEngine";
// @ts-ignore
import TimelineGame from "./components/TimelineGame";
// @ts-ignore
import PdfDrawer from "./components/PdfDrawer";

export default function HistoryView() {
  const [guestId] = useState(getOrCreateGuestId);
  const [progress, setProgress] = useState(getProgress);
  const [data, setData] = useState<any>({ trongTam: [], timeline: [], cauHoi: [] });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [selectedChapter, setSelectedChapter] = useState<any>("ALL");
  const [activeTab, setActiveTab] = useState("theory"); // 'theory' | 'timeline' | 'quiz'
  const [quizFilter, setQuizFilter] = useState("ALL"); // 'ALL' | 'WRONG'
  const [pdfState, setPdfState] = useState({ isOpen: false, page: 1 });

  useEffect(() => {
    loadExcelData("/data/data_lich_su_dang.xlsx")
      .then((res: any) => {
        setData(res);
        setLoading(false);
      })
      .catch((err: any) => {
        console.error("Lỗi đọc file Excel:", err);
        setErrorMsg("Không tìm thấy file public/data/data_lich_su_dang.xlsx");
        setLoading(false);
      });
  }, []);

  const filteredData = useMemo(() => {
    const matchChapter = (item: any) => {
      if (selectedChapter === "ALL") return true;
      if (item.Chuong !== undefined && item.Chuong !== "") {
        return String(item.Chuong) === String(selectedChapter);
      }
      if (item.ID && String(item.ID).startsWith(`C${selectedChapter}_`)) {
        return true;
      }
      return selectedChapter === 1;
    };

    const trongTam = (data.trongTam || []).filter(matchChapter);
    const timeline = (data.timeline || []).filter(matchChapter);
    const allChapterQuestions = (data.cauHoi || []).filter(matchChapter);

    const cauHoi =
      quizFilter === "WRONG"
        ? allChapterQuestions.filter((q: any) => progress.wrongIds?.includes(q.ID))
        : allChapterQuestions;

    return { trongTam, timeline, cauHoi, allChapterQuestions };
  }, [data, selectedChapter, quizFilter, progress.wrongIds]);

  const stats = {
    theoryCount: filteredData.trongTam.length,
    timelineCount: filteredData.timeline.length,
    totalQuestions: filteredData.allChapterQuestions.length,
    completedCount: filteredData.allChapterQuestions.filter((q: any) =>
      progress.completedIds?.includes(q.ID)
    ).length,
    wrongCount: filteredData.allChapterQuestions.filter((q: any) =>
      progress.wrongIds?.includes(q.ID)
    ).length,
  };

  const handleOpenPdf = (page: number) => {
    setPdfState({ isOpen: true, page: page || 1 });
  };

  const handleAnswer = (qId: string, isCorrect: boolean) => {
    const updated = saveQuizResult(qId, isCorrect);
    setProgress({ ...updated });
  };

  const handleResetProgress = () => {
    if (window.confirm("Bạn chắc chắn muốn xóa toàn bộ tiến độ ôn tập?")) {
      localStorage.removeItem("lsd_study_progress");
      setProgress({ completedIds: [], wrongIds: [], timelineScores: {} });
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-red-950/40 p-5 rounded-2xl border border-red-900/40 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-red-400 text-sm font-semibold tracking-wider uppercase">
            <BookOpen className="w-4 h-4" />
            <span>Học phần SP1039 · ĐH Bách Khoa TP.HCM</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mt-1">
            Ôn Lịch Sử Đảng (Killer Suite)
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Học trọng tâm CĐR • Timeline sự kiện lịch sử • Ngân hàng Quiz trắc nghiệm • Tra cứu slide
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-900/80 px-3 py-2 rounded-xl text-xs flex items-center gap-2 border border-slate-800 text-slate-300">
            <UserCheck className="w-4 h-4 text-amber-400" />
            <span>ID: <strong>{guestId}</strong></span>
            <span className="text-slate-600">|</span>
            <span>
              Đã làm: <strong>{progress.completedIds?.length || 0}/{data.cauHoi?.length || 0}</strong> câu
            </span>
          </div>

          <button
            onClick={exportProgressJson}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl text-xs transition cursor-pointer active:scale-95 shadow-md shadow-amber-500/20"
            title="Tải file JSON sao lưu tiến độ"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Backup Tiến Độ</span>
          </button>
        </div>
      </div>

      {/* Main Study Layout: Sidebar & Content View */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-72 shrink-0">
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            selectedChapter={selectedChapter}
            setSelectedChapter={setSelectedChapter}
            quizFilter={quizFilter}
            setQuizFilter={setQuizFilter}
            stats={stats}
            onResetProgress={handleResetProgress}
          />
        </div>

        <main className="flex-1 min-w-0">
          {loading ? (
            <div className="bg-slate-900/60 p-12 rounded-2xl border border-slate-800 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin text-red-500" />
              <span>Đang nạp dữ liệu ngân hàng câu hỏi từ file Excel...</span>
            </div>
          ) : errorMsg ? (
            <div className="bg-rose-950/30 border border-rose-800/60 text-rose-300 p-6 rounded-2xl text-sm flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <strong>Lỗi tải dữ liệu:</strong> {errorMsg}
              </div>
            </div>
          ) : (
            <>
              {activeTab === "theory" && (
                <TheoryView items={filteredData.trongTam} onOpenPdf={handleOpenPdf} />
              )}

              {activeTab === "timeline" && (
                <TimelineGame items={filteredData.timeline} onOpenPdf={handleOpenPdf} />
              )}

              {activeTab === "quiz" && (
                <>
                  {quizFilter === "WRONG" && filteredData.cauHoi.length === 0 ? (
                    <div className="bg-emerald-950/30 border border-emerald-800/50 text-emerald-300 p-8 rounded-2xl text-center space-y-3">
                      <div className="font-bold text-base">
                        🎉 Tuyệt vời! Bạn không còn câu sai nào trong phạm vi này.
                      </div>
                      <button
                        onClick={() => setQuizFilter("ALL")}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                      >
                        Quay lại làm toàn bộ ngân hàng câu hỏi
                      </button>
                    </div>
                  ) : (
                    <QuizEngine
                      key={`${selectedChapter}-${quizFilter}`}
                      questions={filteredData.cauHoi}
                      onAnswer={handleAnswer}
                      onOpenPdf={handleOpenPdf}
                    />
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>

      {/* PDF Drawer Modal */}
      <PdfDrawer
        isOpen={pdfState.isOpen}
        onClose={() => setPdfState({ ...pdfState, isOpen: false })}
        pageNumber={pdfState.page}
      />
    </div>
  );
}
