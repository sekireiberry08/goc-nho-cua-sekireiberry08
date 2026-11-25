import React, { useState } from "react";
import { BookOpen, Search, Sparkles, Tag } from "lucide-react";

export default function TheoryView({ items, onOpenPdf }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMuc, setSelectedMuc] = useState("ALL");

  if (!items || items.length === 0) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
        Chưa có dữ liệu trọng tâm cho chương này. Hãy kiểm tra sheet{" "}
        <code className="text-red-700 font-semibold">Trong_Tam</code> trong file
        Excel.
      </div>
    );
  }

  const mucList = ["ALL", ...new Set(items.map((i) => i.Muc).filter(Boolean))];

  const filteredItems = items.filter((item) => {
    const matchMuc = selectedMuc === "ALL" || item.Muc === selectedMuc;
    const keyword = searchTerm.toLowerCase();
    const matchSearch =
      !keyword ||
      String(item.Tieu_De || "")
        .toLowerCase()
        .includes(keyword) ||
      String(item.Noi_Dung_Cot_Loi || "")
        .toLowerCase()
        .includes(keyword) ||
      String(item.Tu_Khoa_Can_Nho || "")
        .toLowerCase()
        .includes(keyword);
    return matchMuc && matchSearch;
  });

  return (
    <div className="space-y-4">
      {/* Thanh tìm kiếm & lọc mục CĐR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm nhanh sự kiện, văn kiện, từ khóa (VD: Cương lĩnh, TW 8, Việt Minh...)"
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600"
          />
        </div>

        {mucList.length > 2 && (
          <div className="flex flex-wrap gap-1.5">
            {mucList.map((muc) => (
              <button
                key={muc}
                onClick={() => setSelectedMuc(muc)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  selectedMuc === muc
                    ? "bg-red-700 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {muc === "ALL" ? "Tất cả mục" : muc}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Danh sách thẻ kiến thức trọng tâm */}
      {filteredItems.length === 0 ? (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-sm text-slate-500">
          Không tìm thấy nội dung nào khớp với từ khóa "{searchTerm}".
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item, idx) => (
            <div
              key={idx}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-red-200 transition space-y-3"
            >
              <div className="flex flex-wrap justify-between items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-red-700 bg-red-50 px-2.5 py-1 rounded-lg border border-red-100">
                  <Tag className="w-3 h-3" /> {item.Muc || "Trọng tâm CĐR"}
                </span>

                {item.Trang_PDF && (
                  <button
                    onClick={() => onOpenPdf(item.Trang_PDF)}
                    className="text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition"
                  >
                    <BookOpen className="w-3.5 h-3.5" /> Mở Slide trang{" "}
                    {item.Trang_PDF}
                  </button>
                )}
              </div>

              <h3 className="font-bold text-base text-slate-900 leading-snug">
                {item.Tieu_De}
              </h3>

              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {item.Noi_Dung_Cot_Loi}
              </p>

              {item.Tu_Khoa_Can_Nho && (
                <div className="text-xs text-amber-900 bg-amber-50/90 px-3.5 py-2.5 rounded-xl border border-amber-200/80 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold">Từ khóa ăn điểm thi: </strong>
                    <span>{item.Tu_Khoa_Can_Nho}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
