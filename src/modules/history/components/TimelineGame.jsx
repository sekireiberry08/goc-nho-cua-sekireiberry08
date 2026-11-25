import React, { useState, useEffect } from "react";
import { CheckCircle2, RotateCcw, BookOpen, Sparkles } from "lucide-react";

export default function TimelineGame({ items, onOpenPdf }) {
  const [activeSubset, setActiveSubset] = useState([]);
  const [shuffledEvents, setShuffledEvents] = useState([]);
  const [selectedTime, setSelectedTime] = useState(null);
  const [matchedPairs, setMatchedPairs] = useState({});
  const [wrongAttempt, setWrongAttempt] = useState(false);

  const resetGame = () => {
    if (!items || items.length === 0) return;

    // Bốc ngẫu nhiên tối đa 6 mốc từ danh sách, sau đó giữ lại thứ tự gốc (trình tự thời gian) cho cột trái
    const pickedIndices = [...items.keys()]
      .sort(() => Math.random() - 0.5)
      .slice(0, 6)
      .sort((a, b) => a - b);

    const subset = pickedIndices.map((idx) => items[idx]);

    setActiveSubset(subset);
    setShuffledEvents([...subset].sort(() => Math.random() - 0.5));
    setSelectedTime(null);
    setMatchedPairs({});
    setWrongAttempt(false);
  };

  useEffect(() => {
    if (items.length > 0) resetGame();
  }, [items]);

  const handleSelectEvent = (eventItem) => {
    if (!selectedTime) return;
    if (selectedTime.Moc_Thoi_Gian === eventItem.Moc_Thoi_Gian) {
      setMatchedPairs((prev) => ({
        ...prev,
        [selectedTime.Moc_Thoi_Gian]: true,
      }));
      setSelectedTime(null);
      setWrongAttempt(false);
    } else {
      setWrongAttempt(true);
      setTimeout(() => setWrongAttempt(false), 600);
    }
  };

  const isAllMatched =
    activeSubset.length > 0 &&
    Object.keys(matchedPairs).length === activeSubset.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3 bg-amber-50 p-4 rounded-xl border border-amber-200">
        <div>
          <h3 className="font-bold text-amber-900">
            Nối Mốc Thời Gian &amp; Sự Kiện Lịch Sử
          </h3>
          <p className="text-sm text-amber-700">
            Bước 1: Chọn mốc thời gian bên trái &rarr; Bước 2: Chọn sự kiện
            tương ứng bên phải (Nối đúng sẽ hiện <strong>Ý nghĩa chính</strong>
            ).
          </p>
        </div>
        <button
          onClick={resetGame}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" /> Đổi bộ mốc khác
        </button>
      </div>

      {isAllMatched && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center justify-between text-sm">
          <span className="font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            Hoàn thành xuất sắc! Hãy đọc lại phần Ý nghĩa chính bên dưới từng sự
            kiện để khắc sâu kiến thức.
          </span>
          <button
            onClick={resetGame}
            className="px-3 py-1 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 cursor-pointer"
          >
            Lượt tiếp theo &rarr;
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cột Mốc Thời Gian */}
        <div className="space-y-2.5">
          <h4 className="font-semibold text-slate-600 text-sm uppercase">
            Mốc thời gian ({Object.keys(matchedPairs).length}/
            {activeSubset.length})
          </h4>
          {activeSubset.map((item) => {
            const isMatched = matchedPairs[item.Moc_Thoi_Gian];
            const isSelected =
              selectedTime?.Moc_Thoi_Gian === item.Moc_Thoi_Gian;
            return (
              <button
                key={item.Moc_Thoi_Gian}
                disabled={isMatched}
                onClick={() => setSelectedTime(item)}
                className={`w-full text-left p-3.5 rounded-xl border font-semibold transition flex justify-between items-center ${
                  isMatched
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700 opacity-75"
                    : isSelected
                      ? "bg-red-700 text-white border-red-800 shadow-md"
                      : "bg-white hover:border-red-400 border-slate-200 text-slate-800 cursor-pointer"
                }`}
              >
                <span>{item.Moc_Thoi_Gian}</span>
                {isMatched && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                )}
              </button>
            );
          })}
        </div>

        {/* Cột Sự Kiện & Ý Nghĩa Chính */}
        <div className="space-y-2.5">
          <h4 className="font-semibold text-slate-600 text-sm uppercase">
            Sự kiện / Nội dung cốt lõi
          </h4>
          {shuffledEvents.map((item) => {
            const isMatched = matchedPairs[item.Moc_Thoi_Gian];
            return (
              <div
                key={item.Su_Kien}
                onClick={() => !isMatched && handleSelectEvent(item)}
                className={`p-3.5 rounded-xl border text-sm transition flex justify-between items-start gap-2 ${
                  isMatched
                    ? "bg-emerald-50/90 border-emerald-300 text-emerald-900"
                    : wrongAttempt && selectedTime
                      ? "bg-red-50 border-red-300 cursor-pointer"
                      : "bg-white hover:border-blue-400 border-slate-200 text-slate-700 cursor-pointer"
                }`}
              >
                <div className="space-y-2 flex-1">
                  <div className="font-medium leading-relaxed">
                    {item.Su_Kien}
                  </div>

                  {/* Bung Ý nghĩa chính ngay khi nối đúng */}
                  {isMatched && item.Y_Nghia_Chinh && (
                    <div className="text-xs text-emerald-950 bg-emerald-100/80 border-l-2 border-emerald-600 px-2.5 py-1.5 rounded-r leading-relaxed">
                      <span className="font-bold text-emerald-800">
                        Ý nghĩa chính:{" "}
                      </span>
                      {item.Y_Nghia_Chinh}
                    </div>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenPdf(item.Trang_PDF);
                  }}
                  className="shrink-0 text-xs text-blue-600 hover:underline flex items-center gap-1 pt-0.5 cursor-pointer"
                  title="Xem trong Slide PDF"
                >
                  <BookOpen className="w-3.5 h-3.5" /> Tr.{item.Trang_PDF}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
