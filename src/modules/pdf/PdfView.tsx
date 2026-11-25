import React, { useState, useRef } from "react";
import {
  FileUp,
  FileText,
  Download,
  Copy,
  Check,
  X,
  LoaderCircle,
  FolderArchive,
  ShieldCheck,
  AlertCircle,
  Trash2,
  FileCheck2,
} from "lucide-react";
// @ts-ignore
import * as pdfjsLib from "pdfjs-dist";
import JSZip from "jszip";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

interface ExtractedDoc {
  name: string;
  pages: number;
  markdown: string;
  charCount: number;
}

export default function PdfView() {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<ExtractedDoc[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | File[]) => {
    const pdfs = Array.from(incoming).filter((f) =>
      f.name.toLowerCase().endsWith(".pdf")
    );
    if (!pdfs.length) return;
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      const novel = pdfs.filter((f) => !existing.has(f.name + f.size));
      return [...prev, ...novel];
    });
    setError(null);
  };

  const handleExtract = async () => {
    if (!files.length || busy) return;
    setBusy(true);
    setError(null);
    setProgress("Bắt đầu phân tích tài liệu...");
    setResults([]);

    const extractedList: ExtractedDoc[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`Đang đọc file (${i + 1}/${files.length}): ${file.name}...`);

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        let fullMarkdown = `# ${file.name}\n\n> Tổng số trang: ${pdf.numPages} | Kích thước: ${(file.size / 1024 / 1024).toFixed(2)} MB\n\n`;
        let totalChars = 0;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          setProgress(
            `Đang trích xuất: ${file.name} (trang ${pageNum}/${pdf.numPages})...`
          );
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();

          // Join text items into lines and paragraphs
          let lastY: number | null = null;
          let pageText = "";

          textContent.items.forEach((item: any) => {
            if ("str" in item) {
              if (lastY !== null && Math.abs(item.transform[5] - lastY) > 8) {
                pageText += "\n";
              } else if (pageText && !pageText.endsWith("\n") && !pageText.endsWith(" ")) {
                pageText += " ";
              }
              pageText += item.str;
              lastY = item.transform[5];
            }
          });

          const cleanPageText = pageText.trim();
          fullMarkdown += `## Trang ${pageNum}\n\n${cleanPageText || "*(Trang không có lớp văn bản số)*"}\n\n---\n\n`;
          totalChars += cleanPageText.length;
        }

        extractedList.push({
          name: file.name,
          pages: pdf.numPages,
          markdown: fullMarkdown,
          charCount: totalChars,
        });
      }

      setResults(extractedList);
      setSelectedIdx(0);
      setProgress(`Hoàn tất trích xuất ${extractedList.length} tài liệu.`);
    } catch (err: any) {
      console.error("PDF extract error", err);
      setError(err?.message || "Không thể phân tích PDF.");
    } finally {
      setBusy(false);
    }
  };

  const copyMarkdown = () => {
    if (!results.length) return;
    const textToCopy = results[selectedIdx]?.markdown || "";
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadZip = async () => {
    if (!results.length) return;
    const zip = new JSZip();

    results.forEach((doc) => {
      const folderName = doc.name.replace(/\.pdf$/i, "");
      const folder = zip.folder(folderName) || zip;
      folder.file("document.md", doc.markdown);
      folder.file(
        "metadata.json",
        JSON.stringify(
          {
            originalName: doc.name,
            pages: doc.pages,
            charCount: doc.charCount,
            extractedAt: new Date().toISOString(),
          },
          null,
          2
        )
      );
    });

    zip.file("README.md", `# Dữ liệu trích xuất từ Góc nhỏ của sekireiberry08\n\nBao gồm ${results.length} tài liệu PDF đã chuyển đổi thành Markdown.`);

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pdf_extracted_${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const current = results[selectedIdx];

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-sm font-semibold tracking-wider uppercase">
            <FileText className="w-4 h-4" />
            <span>Tiện Ích Văn Bản & Tài Liệu</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mt-1">
            Trích Xuất Dữ Liệu PDF
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Trích xuất văn bản có cấu trúc, chuyển đổi thành Markdown và tải về gói ZIP hoàn chỉnh.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 self-start md:self-auto">
          <ShieldCheck className="w-4 h-4" />
          <span>Xử lý 100% trên trình duyệt · Không tải lên server</span>
        </div>
      </div>

      {/* Upload & Setup Section */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2 ${
            dragging
              ? "border-indigo-500 bg-indigo-950/20"
              : "border-slate-800 hover:border-slate-700 bg-slate-950/40"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-1">
            <FileUp className="w-6 h-6" />
          </div>
          <p className="font-semibold text-slate-200 text-sm">
            Kéo thả tệp PDF vào đây hoặc <span className="text-indigo-400 underline">chọn từ thiết bị</span>
          </p>
          <p className="text-xs text-slate-500">
            Hỗ trợ chọn nhiều tệp cùng lúc • Xử lý hoàn toàn trong bộ nhớ máy bạn
          </p>
        </div>

        {/* Selected files list */}
        {files.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Đã chọn {files.length} tệp PDF</span>
              <button
                onClick={() => setFiles([])}
                className="text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa danh sách</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2 truncate mr-2">
                    <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-400 font-bold text-[10px]">
                      PDF
                    </span>
                    <span className="text-slate-300 truncate font-medium">{file.name}</span>
                  </div>
                  <button
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={handleExtract}
                disabled={busy}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20 active:scale-95 cursor-pointer"
              >
                {busy ? (
                  <>
                    <LoaderCircle className="w-4 h-4 animate-spin" />
                    <span>Đang trích xuất...</span>
                  </>
                ) : (
                  <>
                    <FileCheck2 className="w-4 h-4" />
                    <span>Bắt đầu trích xuất ({files.length} tệp)</span>
                  </>
                )}
              </button>
              {progress && <span className="text-xs text-slate-400 italic">{progress}</span>}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Results View */}
      {results.length > 0 && current && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 border-b border-slate-800">
            {/* Tabs for multiple files */}
            <div className="flex items-center gap-2 overflow-x-auto max-w-full">
              {results.map((doc, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedIdx(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                    selectedIdx === idx
                      ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {doc.name}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={copyMarkdown}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Đã sao chép" : "Sao chép Markdown"}</span>
              </button>

              <button
                onClick={downloadZip}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải trọn gói ZIP</span>
              </button>
            </div>
          </div>

          <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
            <span>
              {current.name} • <strong>{current.pages}</strong> trang •{" "}
              <strong>{current.charCount.toLocaleString()}</strong> ký tự
            </span>
            <span className="text-[11px] text-indigo-400">Định dạng: GitHub Flavored Markdown</span>
          </div>

          <div className="p-5 max-h-[550px] overflow-auto bg-slate-950/80 font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
            {current.markdown}
          </div>
        </div>
      )}
    </div>
  );
}
