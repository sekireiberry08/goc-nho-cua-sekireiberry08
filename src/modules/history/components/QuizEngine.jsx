import React, { useState } from "react";
import { BookOpen, CheckCircle, XCircle, ArrowRight } from "lucide-react";

export default function QuizEngine({ questions, onAnswer, onOpenPdf }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState("");
  const [textInput, setTextInput] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!questions || questions.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500">
        Chưa có câu hỏi nào trong dữ liệu.
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const isFillBlank = currentQ.Loai_Cau_Hoi === "DIEN_TU";

  const checkCorrect = () => {
    if (isFillBlank) {
      return (
        textInput.trim().toLowerCase() ===
        String(currentQ.Dap_An_Dung).trim().toLowerCase()
      );
    }
    return selectedOption === currentQ.Dap_An_Dung;
  };

  const handleSubmit = () => {
    if ((isFillBlank && !textInput.trim()) || (!isFillBlank && !selectedOption))
      return;
    setIsSubmitted(true);
    onAnswer(currentQ.ID, checkCorrect());
  };

  const handleNext = () => {
    setSelectedOption("");
    setTextInput("");
    setIsSubmitted(false);
    setCurrentIndex((prev) => (prev + 1) % questions.length);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
      <div className="flex justify-between items-center border-b pb-3">
        <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full">
          Câu {currentIndex + 1}/{questions.length} •{" "}
          {isFillBlank ? "Điền từ khóa" : "Trắc nghiệm"}
        </span>

        {/* Nút mở PDF đúng trang của câu hỏi */}
        <button
          onClick={() => onOpenPdf(currentQ.Trang_PDF)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition"
        >
          <BookOpen className="w-4 h-4" />
          Xem tài liệu (Slide tr. {currentQ.Trang_PDF || 1})
        </button>
      </div>

      <h3 className="text-lg font-semibold text-slate-800 leading-relaxed">
        {currentQ.Cau_Hoi}
      </h3>

      {isFillBlank ? (
        <div className="space-y-2">
          <input
            type="text"
            disabled={isSubmitted}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Nhập chính xác cụm từ khóa còn thiếu..."
            className="w-full p-3.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none"
          />
        </div>
      ) : (
        <div className="space-y-2.5">
          {["A", "B", "C", "D"].map((opt) => {
            const optText = currentQ[`Lua_Chon_${opt}`];
            if (!optText) return null;

            let btnStyle = "border-slate-200 hover:border-red-400 bg-white";
            if (isSubmitted) {
              if (opt === currentQ.Dap_An_Dung) {
                btnStyle =
                  "border-emerald-500 bg-emerald-50 text-emerald-900 font-medium";
              } else if (opt === selectedOption) {
                btnStyle = "border-red-500 bg-red-50 text-red-900";
              }
            } else if (selectedOption === opt) {
              btnStyle = "border-red-600 bg-red-50/50 ring-1 ring-red-600";
            }

            return (
              <button
                key={opt}
                disabled={isSubmitted}
                onClick={() => setSelectedOption(opt)}
                className={`w-full text-left p-3.5 rounded-xl border transition flex items-center gap-3 ${btnStyle}`}
              >
                <span className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs shrink-0">
                  {opt}
                </span>
                <span>{optText}</span>
              </button>
            );
          })}
        </div>
      )}

      {isSubmitted && (
        <div
          className={`p-4 rounded-xl border ${checkCorrect() ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}
        >
          <div className="flex items-center gap-2 font-bold mb-1">
            {checkCorrect() ? (
              <span className="text-emerald-700 flex items-center gap-1">
                <CheckCircle className="w-5 h-5" /> Chính xác!
              </span>
            ) : (
              <span className="text-red-700 flex items-center gap-1">
                <XCircle className="w-5 h-5" /> Chưa chính xác! Đáp án đúng:{" "}
                {currentQ.Dap_An_Dung}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-700">{currentQ.Giai_Thich}</p>
        </div>
      )}

      <div className="flex justify-end pt-2">
        {!isSubmitted ? (
          <button
            onClick={handleSubmit}
            className="px-5 py-2.5 bg-red-700 text-white font-semibold rounded-xl hover:bg-red-800 transition"
          >
            Kiểm tra đáp án
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="px-5 py-2.5 bg-slate-800 text-white font-semibold rounded-xl hover:bg-slate-900 transition flex items-center gap-2"
          >
            Câu tiếp theo <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
