import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  FileCode,
  Copy,
  Check,
  Download,
  AlertCircle,
  CheckCircle2,
  ListTree,
  FileText,
  Terminal,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
// @ts-ignore
import { compileMiRust } from "./engine.js";

const SAMPLES = [
  {
    name: "Sum 0..n (For loop)",
    code: `fn sum_to(n: i32) -> i32 {
    let mut total: i32 = 0;
    for (i in 0..n) {
        total = total + i;
    }
    return total;
}

fn main() -> void {
    let answer: i32 = sum_to(10);
    println_i32(answer);
}`,
  },
  {
    name: "Factorial (Đệ quy)",
    code: `fn fact(n: i32) -> i32 {
    if (n <= 1) {
        return 1;
    } else {
        return n * fact(n - 1);
    }
}

fn main() -> void {
    let res: i32 = fact(5);
    println_i32(res);
}`,
  },
  {
    name: "While Loop",
    code: `fn main() -> void {
    let mut x: i32 = 0;
    while (x < 5) {
        println_i32(x);
        x = x + 1;
    }
}`,
  },
  {
    name: "Switch / Case / Break",
    code: `fn main() -> void {
    let x: i32 = 2;
    switch (x) {
        case 1:
            println_i32(10);
            break;
        case 2:
            println_i32(20);
            break;
        default:
            println_i32(0);
    }
}`,
  },
  {
    name: "Boolean & Logic",
    code: `fn main() -> void {
    let a: bool = true;
    let b: bool = false;
    if (a && !b) {
        println_i32(1);
    } else {
        println_i32(0);
    }
}`,
  },
];

const TEST_CASES = [
  {
    name: "Recursive function (fact)",
    input: `fn fact(n: i32) -> i32 { if (n <= 1) { return 1; } else { return n * fact(n - 1); } } fn main() -> void { println_i32(fact(5)); }`,
    mustContain: ["invokestatic MiRustProgram/_fact(I)I", "ireturn"],
  },
  {
    name: "While loop & conditions",
    input: `fn main() -> void { let mut x: i32 = 0; while (x < 3) { println_i32(x); x = x + 1; } }`,
    mustContain: ["if_icmplt", "iadd", "goto"],
  },
  {
    name: "Switch fall-through / break",
    input: `fn main() -> void { let x: i32 = 2; switch (x) { case 1: println_i32(10); break; case 2: println_i32(20); break; default: println_i32(0); } }`,
    mustContain: ["if_icmpeq", "goto"],
  },
  {
    name: "Short circuit boolean logic",
    input: `fn main() -> void { let x: bool = true && false; if (x) println_i32(1); else println_i32(0); }`,
    mustContain: ["ifeq", "iconst_0", "iconst_1"],
  },
];

export default function CompilerView() {
  const [sourceCode, setSourceCode] = useState(SAMPLES[0].code);
  const [jasminOutput, setJasminOutput] = useState("");
  const [astOutput, setAstOutput] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"jasmin" | "ast">("jasmin");
  const [copied, setCopied] = useState(false);
  const [testResults, setTestResults] = useState<
    { name: string; pass: boolean; error?: string }[] | null
  >(null);
  const [showDocs, setShowDocs] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCompile = (codeToCompile?: string) => {
    const code = codeToCompile !== undefined ? codeToCompile : sourceCode;
    try {
      const result = compileMiRust(code);
      setJasminOutput(result.jasmin);
      setAstOutput(result.ast);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Lỗi biên dịch không xác định.");
      setJasminOutput("");
      setAstOutput(null);
    }
  };

  useEffect(() => {
    handleCompile(SAMPLES[0].code);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleCompile();
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      if (e.shiftKey) {
        const lineStart = val.lastIndexOf("\n", start - 1) + 1;
        const line = val.slice(lineStart, start);
        const n = line.startsWith("    ") ? 4 : line.startsWith("\t") ? 1 : 0;
        if (n) {
          const nextVal = val.slice(0, lineStart) + val.slice(lineStart + n);
          setSourceCode(nextVal);
          setTimeout(() => {
            textarea.selectionStart = start - n;
            textarea.selectionEnd = end - n;
          }, 0);
        }
      } else if (start === end) {
        const nextVal = val.slice(0, start) + "    " + val.slice(end);
        setSourceCode(nextVal);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 4;
        }, 0);
      } else {
        const lineStart = val.lastIndexOf("\n", start - 1) + 1;
        const lineEnd = val.indexOf("\n", end) === -1 ? val.length : val.indexOf("\n", end);
        const block = val.slice(lineStart, lineEnd);
        const indented = block
          .split("\n")
          .map((line) => "    " + line)
          .join("\n");
        const nextVal = val.slice(0, lineStart) + indented + val.slice(lineEnd);
        setSourceCode(nextVal);
        setTimeout(() => {
          textarea.selectionStart = lineStart;
          textarea.selectionEnd = lineStart + indented.length;
        }, 0);
      }
    }
  };

  const copyJasmin = () => {
    if (!jasminOutput) return;
    navigator.clipboard.writeText(jasminOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadJasmin = () => {
    if (!jasminOutput) return;
    const blob = new Blob([jasminOutput], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "MiRustProgram.j";
    a.click();
    URL.revokeObjectURL(url);
  };

  const runAllTests = () => {
    const results = TEST_CASES.map((tc) => {
      try {
        const res = compileMiRust(tc.input);
        const missing = tc.mustContain.filter((s) => !res.jasmin.includes(s));
        if (missing.length > 0) {
          return { name: tc.name, pass: false, error: "Thiếu lệnh: " + missing.join(", ") };
        }
        return { name: tc.name, pass: true };
      } catch (e: any) {
        return { name: tc.name, pass: false, error: e.message };
      }
    });
    setTestResults(results);
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-sm font-semibold tracking-wider uppercase">
            <Terminal className="w-4 h-4" />
            <span>Compiler Lab v4 · MiRust to JVM Bytecode</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mt-1">
            MiRust → Jasmin Compiler
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Phân tích từ vựng (Lexer) → Cú pháp (Parser) → AST → Sinh mã Jasmin bytecode cho máy ảo Java (JVM).
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleCompile()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95 cursor-pointer"
            title="Nhấn Cmd+Enter hoặc Ctrl+Enter để biên dịch nhanh"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Biên dịch (⌘ Enter)</span>
          </button>

          <button
            onClick={runAllTests}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-medium transition cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Chạy Test Suite</span>
          </button>

          <button
            onClick={() => setShowDocs(!showDocs)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-sm transition cursor-pointer"
          >
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>Ghi chú</span>
            {showDocs ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Preset selector bar */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider mr-1">
          Nạp mẫu code:
        </span>
        {SAMPLES.map((sample, idx) => (
          <button
            key={idx}
            onClick={() => {
              setSourceCode(sample.code);
              handleCompile(sample.code);
            }}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-300 border border-slate-700/60 hover:border-indigo-500/50 transition cursor-pointer"
          >
            {sample.name}
          </button>
        ))}
      </div>

      {/* Test Suite Modal / Result strip */}
      {testResults && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg animate-in fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Kết quả kiểm thử ({testResults.filter((r) => r.pass).length}/{testResults.length} ĐẠT)
            </span>
            <button
              onClick={() => setTestResults(null)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Đóng
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {testResults.map((t, i) => (
              <div
                key={i}
                className={`p-2.5 rounded-lg border flex items-center justify-between ${
                  t.pass
                    ? "bg-emerald-950/30 border-emerald-800/60 text-emerald-300"
                    : "bg-rose-950/30 border-rose-800/60 text-rose-300"
                }`}
              >
                <span className="truncate mr-2">{t.name}</span>
                <span className="font-bold text-[10px] px-1.5 py-0.5 rounded bg-black/30">
                  {t.pass ? "PASS" : "FAIL"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Two-Column Grid: Code Editor & Output */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Column: Source Editor */}
        <div className="flex flex-col bg-slate-900/80 rounded-2xl border border-slate-800 shadow-md overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 text-xs">
            <div className="flex items-center gap-2 font-medium text-slate-300">
              <FileCode className="w-4 h-4 text-indigo-400" />
              <span>MiRust Source Code</span>
            </div>
            <span className="text-slate-500 text-[11px]">
              Tab: 4 spaces · Shift+Tab: lùi indent
            </span>
          </div>

          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={sourceCode}
              onChange={(e) => setSourceCode(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              className="w-full h-[520px] p-4 bg-slate-950/70 text-slate-100 font-mono text-sm leading-relaxed outline-none resize-none selection:bg-indigo-600/40"
              placeholder="// Nhập mã nguồn MiRust..."
            />
          </div>

          {/* Source Status Bar */}
          <div className="px-4 py-2.5 bg-slate-900/90 border-t border-slate-800 text-xs flex items-center justify-between">
            {error ? (
              <div className="flex items-center gap-1.5 text-rose-400 font-medium truncate">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="truncate">{error}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Cú pháp hợp lệ · Sẵn sàng sinh mã Jasmin</span>
              </div>
            )}
            <span className="text-slate-500 text-[11px] shrink-0 ml-2">
              {sourceCode.split("\n").length} dòng
            </span>
          </div>
        </div>

        {/* Right Column: Jasmin Bytecode & AST Viewer */}
        <div className="flex flex-col bg-slate-900/80 rounded-2xl border border-slate-800 shadow-md overflow-hidden">
          {/* Output Header Tabs */}
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab("jasmin")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTab === "jasmin"
                    ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Jasmin Assembly (.j)</span>
              </button>
              <button
                onClick={() => setActiveTab("ast")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTab === "ast"
                    ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <ListTree className="w-3.5 h-3.5" />
                <span>AST Tree</span>
              </button>
            </div>

            {/* Output Tools */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={copyJasmin}
                disabled={!jasminOutput}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs transition cursor-pointer"
                title="Sao chép Jasmin output"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Đã chép" : "Chép"}</span>
              </button>

              <button
                onClick={downloadJasmin}
                disabled={!jasminOutput}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs transition cursor-pointer"
                title="Tải file MiRustProgram.j"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải .j</span>
              </button>
            </div>
          </div>

          {/* Output Content */}
          <div className="relative flex-1 bg-slate-950/70 overflow-auto h-[520px] p-4 text-xs font-mono">
            {error ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <AlertCircle className="w-10 h-10 text-rose-500/80 mb-2" />
                <p className="text-rose-400 font-semibold mb-1">Không thể sinh mã Jasmin</p>
                <p className="text-xs text-slate-400 max-w-md">{error}</p>
              </div>
            ) : activeTab === "jasmin" ? (
              jasminOutput ? (
                <pre className="text-emerald-300/90 whitespace-pre leading-relaxed">
                  {jasminOutput}
                </pre>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500">
                  Nhấn "Biên dịch" để xem Jasmin assembly.
                </div>
              )
            ) : astOutput ? (
              <pre className="text-sky-300/90 whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(astOutput, null, 2)}
              </pre>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">
                Chưa có dữ liệu AST.
              </div>
            )}
          </div>

          {/* Output Status Bar */}
          <div className="px-4 py-2.5 bg-slate-900/90 border-t border-slate-800 text-xs flex items-center justify-between text-slate-400">
            <span>
              {jasminOutput
                ? `Đã tạo ${jasminOutput.split("\n").length} dòng mã Jasmin (.class public MiRustProgram)`
                : "Chờ biên dịch..."}
            </span>
            <span className="text-[11px] text-slate-500">Target JVM: Java Bytecode</span>
          </div>
        </div>
      </div>

      {/* Collapsible Info / Docs Section */}
      {showDocs && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 text-sm space-y-3">
          <h3 className="font-semibold text-slate-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Phạm vi ngôn ngữ & Hướng dẫn sử dụng
          </h3>
          <div className="text-xs text-slate-400 space-y-2 leading-relaxed">
            <p>
              • <strong>Tập con ngôn ngữ MiRust:</strong> Hỗ trợ khai báo hàm (<code className="text-indigo-300">fn</code>), tham số và kiểu trả về (<code className="text-indigo-300">i32</code>, <code className="text-indigo-300">bool</code>, <code className="text-indigo-300">void</code>), khai báo biến cục bộ (<code className="text-indigo-300">let</code>, <code className="text-indigo-300">let mut</code>), cấu trúc điều khiển (<code className="text-indigo-300">if/else</code>, <code className="text-indigo-300">while</code>, <code className="text-indigo-300">for in start..end</code>, <code className="text-indigo-300">switch/case/break</code>), và hàm in tích hợp (<code className="text-indigo-300">println_i32</code>, <code className="text-indigo-300">print_i32</code>, <code className="text-indigo-300">println</code>).
            </p>
            <p>
              • <strong>Cách chạy mã Jasmin trên máy:</strong> Lưu output thành <code className="text-indigo-300">MiRustProgram.j</code>, dùng trình lắp ráp Jasmin để tạo file class: <code className="text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">java -jar jasmin.jar MiRustProgram.j</code>, sau đó chạy trực tiếp trên Java: <code className="text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">java MiRustProgram</code>.
            </p>
            <p>
              • <strong>Hoàn toàn client-side:</strong> Toàn bộ quá trình Lexing, Parsing, kiểm tra kiểu dữ liệu tĩnh và sinh mã chạy 100% trên trình duyệt người dùng với độ trễ 0ms, không phụ thuộc máy chủ.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
