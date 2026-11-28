import React, { useState, useRef, useEffect } from "react";
import {
  FileUp,
  FileText,
  FolderKanban,
  Download,
  Copy,
  Check,
  X,
  Loader2,
  AlertCircle,
  Trash2,
  FileCheck2,
  RefreshCw,
} from "lucide-react";
// @ts-ignore
import * as pdfjsLib from "pdfjs-dist";
import JSZip from "jszip";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

type PdfSubTab = "sorter" | "extractor";

interface SorterRow {
  filename: string;
  subject: string;
  confidence: number;
  reason: string;
}

interface ExtractedDoc {
  name: string;
  pages: number;
  markdown: string;
  charCount: number;
}

interface HealthInfo {
  ok: boolean;
  pymupdf: boolean;
  tesseract: boolean;
  pytesseract: boolean;
  ollama: boolean;
  ollamaModels: string[];
  defaultOllamaModel: string;
}

export default function PdfView() {
  const [subTab, setSubTab] = useState<PdfSubTab>("sorter");

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">PDF Studio</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Phân loại đề thi PDF theo môn học (OCR + Ollama) và trích xuất văn bản sang Markdown.
          </p>
        </div>

        <div className="inline-flex p-1 rounded-lg bg-zinc-200/70 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 self-start">
          <button
            onClick={() => setSubTab("sorter")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              subTab === "sorter"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5" />
            <span>Phân loại đề thi (AI + OCR)</span>
          </button>
          <button
            onClick={() => setSubTab("extractor")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              subTab === "extractor"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Trích xuất Markdown</span>
          </button>
        </div>
      </div>

      {subTab === "sorter" ? <PdfSorterPanel /> : <PdfExtractorPanel />}
    </div>
  );
}

/* ============================================================================
   1. PDF EXAM SORTER (OCR + Ollama Local)
============================================================================ */
function PdfSorterPanel() {
  const [subjects, setSubjects] = useState(
    "Mạng máy tính (Computer Networks, MMT)\nQuản lý dự án (Project Management, QLDA)\nHệ điều hành (Operating Systems, HĐH)"
  );
  const [files, setFiles] = useState<File[]>([]);
  const [model, setModel] = useState("qwen2.5:7b");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ token: string; total: number; rows: SorterRow[] } | null>(null);

  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const checkHealth = async () => {
    setCheckingHealth(true);
    try {
      const res = await fetch("/api/health");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as HealthInfo;
      setHealth(data);
      if (data.ollamaModels?.length && !data.ollamaModels.includes(model)) {
        setModel(data.ollamaModels[0]);
      } else if (data.defaultOllamaModel) {
        setModel(data.defaultOllamaModel);
      }
    } catch {
      setHealth(null);
    } finally {
      setCheckingHealth(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const addFiles = (incoming: FileList | File[]) => {
    const pdfs = Array.from(incoming).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) return;
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...pdfs.filter((f) => !seen.has(f.name + f.size))];
    });
    setError(null);
  };

  const handleSort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjects.trim() || !files.length || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append("subjects", subjects);
      form.append("model", model.trim() || "qwen2.5:7b");
      files.forEach((f) => form.append("files", f));

      const res = await fetch("/api/pdf-sorter/sort", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể phân loại PDF.");
      }
      setResult(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Không kết nối được Local Backend. Hãy chạy ./start.command và mở Ollama."
      );
    } finally {
      setBusy(false);
    }
  };

  const ready = Boolean(health?.ok && health.pymupdf && health.ollama);

  return (
    <div className="space-y-4">
      {/* Backend status bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-3 text-zinc-600 dark:text-zinc-400">
          <span>
            Backend:{" "}
            <strong className={health?.ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"}>
              {health?.ok ? "Online" : "Offline"}
            </strong>
          </span>
          <span>
            OCR (Tesseract):{" "}
            <strong className={health?.tesseract ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}>
              {health?.tesseract ? "Sẵn sàng" : "Chưa có"}
            </strong>
          </span>
          <span>
            Ollama:{" "}
            <strong className={health?.ollama ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"}>
              {health?.ollama ? "Đang chạy" : "Chưa bật"}
            </strong>
          </span>
        </div>

        <button
          onClick={checkHealth}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 ${checkingHealth ? "animate-spin" : ""}`} />
          <span>Kiểm tra lại</span>
        </button>
      </div>

      {!checkingHealth && !ready && (
        <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300">
          Để chạy phân loại AI + OCR cục bộ: hãy chạy{" "}
          <code className="font-mono px-1 py-0.5 rounded bg-black/10 dark:bg-white/10">./start.command</code> và bật
          Ollama (<code className="font-mono px-1 py-0.5 rounded bg-black/10 dark:bg-white/10">ollama serve</code>).
        </div>
      )}

      <form onSubmit={handleSort} className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Subjects & Model */}
        <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold block">1. Danh sách môn học (mỗi dòng một môn)</label>
            <textarea
              value={subjects}
              onChange={(e) => setSubjects(e.target.value)}
              rows={6}
              required
              placeholder="Mạng máy tính (Computer Networks, MMT)"
              className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs leading-relaxed outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-zinc-500">
              Tên trước dấu ngoặc là tên thư mục trong ZIP; tên viết tắt trong ngoặc giúp AI đối chiếu chính xác hơn.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold block">2. Mô hình Ollama</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              list="ollama-models-list"
              placeholder="qwen2.5:7b"
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-mono outline-none focus:border-indigo-500"
            />
            <datalist id="ollama-models-list">
              {(health?.ollamaModels || []).map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Right: File Dropzone & Submit */}
        <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-4 flex flex-col">
          <label className="text-xs font-semibold block">3. Chọn các file đề thi PDF</label>
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
            className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition space-y-1.5 ${
              dragging
                ? "border-indigo-500 bg-indigo-500/5"
                : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <FileUp className="w-7 h-7 mx-auto text-zinc-400" />
            <p className="text-sm font-medium">Kéo thả các file PDF vào đây hoặc bấm để chọn</p>
            <p className="text-xs text-zinc-500">Tự động OCR nếu là PDF scan (eng+vie).</p>
          </div>

          {files.length > 0 && (
            <div className="space-y-2 flex-1">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Đã chọn {files.length} tệp PDF</span>
                <button
                  type="button"
                  onClick={() => setFiles([])}
                  className="text-rose-500 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Xoá hết</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-auto">
                {files.map((f, idx) => (
                  <div
                    key={`${f.name}-${idx}`}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs"
                  >
                    <span className="truncate mr-2">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-1 flex justify-end mt-auto">
            <button
              type="submit"
              disabled={!files.length || !subjects.trim() || busy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium transition cursor-pointer"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang OCR & phân loại...</span>
                </>
              ) : (
                <>
                  <FolderKanban className="w-4 h-4" />
                  <span>Phân loại & tạo ZIP ({files.length} tệp)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Results Table */}
      {result && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Kết quả phân loại ({result.total} tệp)</h2>
              <p className="text-xs text-zinc-500">Các tệp có độ tin cậy dưới 0.55 được đưa vào “Chưa xác định”.</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/api/pdf-sorter/download/${result.token}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải ZIP kết quả</span>
              </a>
              <a
                href={`/api/pdf-sorter/report/${result.token}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Báo cáo CSV</span>
              </a>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
                  <th className="py-2 pr-4 font-medium">File</th>
                  <th className="py-2 pr-4 font-medium">Môn được chọn</th>
                  <th className="py-2 pr-4 font-medium">Độ tin cậy</th>
                  <th className="py-2 font-medium">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r, i) => (
                  <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/60">
                    <td className="py-2.5 pr-4 font-medium">{r.filename}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`px-2 py-0.5 rounded-md font-medium ${
                          r.subject === "Chưa xác định"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                        }`}
                      >
                        {r.subject}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 font-mono">{r.confidence}</td>
                    <td className="py-2.5 text-zinc-500">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   2. PDF TO MARKDOWN EXTRACTOR (100% Client-side)
============================================================================ */
function PdfExtractorPanel() {
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
    const pdfs = Array.from(incoming).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) return;
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...pdfs.filter((f) => !existing.has(f.name + f.size))];
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
        setProgress(`Đang đọc (${i + 1}/${files.length}): ${file.name}...`);

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullMarkdown = `# ${file.name}\n\n> Tổng số trang: ${pdf.numPages} | Kích thước: ${(
          file.size /
          1024 /
          1024
        ).toFixed(2)} MB\n\n`;
        let totalChars = 0;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          setProgress(`Đang trích xuất: ${file.name} (trang ${pageNum}/${pdf.numPages})...`);
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();

          let lastY: number | null = null;
          let pageText = "";

          textContent.items.forEach((item: any) => {
            if ("str" in item && Array.isArray(item.transform)) {
              if (lastY !== null && Math.abs(item.transform[5] - lastY) > 8) {
                pageText += "\n";
              } else if (pageText && !pageText.endsWith("\n") && !pageText.endsWith(" ")) {
                pageText += " ";
              }
              pageText += item.str;
              lastY = item.transform[5];
            }
          });

          const clean = pageText.trim();
          fullMarkdown += `## Trang ${pageNum}\n\n${clean || "*(Trang không có lớp văn bản số)*"}\n\n---\n\n`;
          totalChars += clean.length;
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể phân tích PDF.");
    } finally {
      setBusy(false);
    }
  };

  const downloadZip = async () => {
    if (!results.length) return;
    const zip = new JSZip();

    results.forEach((doc) => {
      const folder = zip.folder(doc.name.replace(/\.pdf$/i, "")) || zip;
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
    <div className="space-y-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
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
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition space-y-1.5 ${
            dragging
              ? "border-indigo-500 bg-indigo-500/5"
              : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
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
          <FileUp className="w-7 h-7 mx-auto text-zinc-400" />
          <p className="text-sm font-medium">Kéo thả tệp PDF vào đây hoặc bấm để chọn</p>
          <p className="text-xs text-zinc-500">Xử lý hoàn toàn trong trình duyệt để xuất Markdown & ZIP.</p>
        </div>

        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Đã chọn {files.length} tệp PDF</span>
              <button
                onClick={() => setFiles([])}
                className="text-rose-500 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xoá danh sách</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs"
                >
                  <span className="truncate mr-2 font-medium">{file.name}</span>
                  <button
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleExtract}
                disabled={busy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium cursor-pointer"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck2 className="w-4 h-4" />}
                <span>{busy ? "Đang trích xuất..." : `Trích xuất (${files.length} tệp)`}</span>
              </button>
              {progress && <span className="text-xs text-zinc-500">{progress}</span>}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {results.length > 0 && current && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {results.map((doc, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedIdx(idx)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
                    selectedIdx === idx
                      ? "bg-indigo-600 text-white"
                      : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {doc.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(current.markdown);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Đã chép" : "Chép Markdown"}</span>
              </button>
              <button
                onClick={downloadZip}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải ZIP</span>
              </button>
            </div>
          </div>

          <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 flex justify-between">
            <span>
              {current.name} · {current.pages} trang · {current.charCount.toLocaleString()} ký tự
            </span>
          </div>

          <pre className="p-4 max-h-[480px] overflow-auto bg-zinc-50 dark:bg-zinc-950 font-mono text-xs whitespace-pre-wrap leading-relaxed">
            {current.markdown}
          </pre>
        </div>
      )}
    </div>
  );
}
