// import React from "react";
import { X, FileText, ExternalLink } from "lucide-react";

export default function PdfDrawer({
  isOpen,
  onClose,
  pageNumber,
  docTitle = "Slide Chương 1 (TS. Đào Thị Bích Hồng)",
}) {
  if (!isOpen) return null;

  // Nhảy thẳng tới trang PDF tương ứng với câu hỏi
  const pdfUrl = `/docs/slide_chuong_1.pdf#page=${pageNumber || 1}`;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full md:w-1/2 bg-white shadow-2xl border-l border-slate-200 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-red-800 text-white">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          <div>
            <h3 className="font-semibold text-sm">{docTitle}</h3>
            <p className="text-xs text-red-200">
              Đang mở tại trang: {pageNumber || 1}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 hover:bg-red-700 rounded text-xs flex items-center gap-1"
            title="Mở tab mới"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button onClick={onClose} className="p-1.5 hover:bg-red-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 bg-slate-100">
        <iframe
          key={pdfUrl}
          src={pdfUrl}
          title="PDF Viewer"
          className="w-full h-full border-none"
        />
      </div>
    </div>
  );
}
