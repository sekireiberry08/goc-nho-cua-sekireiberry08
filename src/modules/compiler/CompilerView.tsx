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
  const [astOutput, setAstOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"jasmin" | "ast">("jasmin");
  const [copied, setCopied] = useState(false);
  const [testResults, setTestResults] = useState<{ name: string; pass: boolean; error?: string }[] | null>(null);
  const [showDocs, setShowDocs] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCompile = (codeToCompile?: string) => {
    const code = codeToCompile !== undefined ? codeToCompile : sourceCode;
    try {
      const result = compileMiRust(code);
      setJasminOutput(result.jasmin);
      setAstOutput(result.ast);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Lỗi biên dịch không xác định.");
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
          setSourceCode(val.slice(0, lineStart) + val.slice(lineStart + n));
          setTimeout(() => {
            textarea.selectionStart = start - n;
            textarea.selectionEnd = end - n;
          }, 0);
        }
      } else if (start === end) {
        setSourceCode(val.slice(0, start) + "    " + val.slice(end));
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 4;
        }, 0);
      } else {
        const lineStart = val.lastIndexOf("\n", start - 1) + 1;
        const lineEnd = val.indexOf("\n", end) === -1 ? val.length : val.indexOf("\n", end);
        const indented = val
          .slice(lineStart, lineEnd)
          .split("\n")
          .map((line) => "    " + line)
          .join("\n");
        setSourceCode(val.slice(0, lineStart) + indented + val.slice(lineEnd));
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
    setTimeout(() => setCopied(false), 1800);
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
      } catch (e: unknown) {
        return { name: tc.name, pass: false, error: e instanceof Error ? e.message : "Error" };
      }
    });
    setTestResults(results);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">MiRust → Jasmin Compiler</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Biên dịch ngôn ngữ MiRust sang JVM bytecode Jasmin ngay trên trình duyệt.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleCompile()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Biên dịch (⌘ Enter)</span>
          </button>

          <button
            onClick={runAllTests}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-medium transition cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Test Suite</span>
          </button>

          <button
            onClick={() => setShowDocs(!showDocs)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-medium transition cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-zinc-500" />
            <span>Ghi chú</span>
            {showDocs ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-zinc-500 mr-1">Mẫu:</span>
        {SAMPLES.map((sample, idx) => (
          <button
            key={idx}
            onClick={() => {
              setSourceCode(sample.code);
              handleCompile(sample.code);
            }}
            className="text-xs px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            {sample.name}
          </button>
        ))}
      </div>

      {/* Test Results */}
      {testResults && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>
              Kết quả kiểm thử ({testResults.filter((r) => r.pass).length}/{testResults.length} đạt)
            </span>
            <button onClick={() => setTestResults(null)} className="text-zinc-500 hover:text-zinc-700 cursor-pointer">
              Đóng
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {testResults.map((t, i) => (
              <div
                key={i}
                className={`p-2.5 rounded-lg border flex items-center justify-between ${
                  t.pass
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
                }`}
              >
                <span className="truncate mr-2">{t.name}</span>
                <span className="font-bold text-[10px]">{t.pass ? "PASS" : "FAIL"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editor & Output */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 text-xs">
            <div className="flex items-center gap-2 font-medium">
              <FileCode className="w-4 h-4 text-indigo-500" />
              <span>MiRust Source</span>
            </div>
            <span className="text-zinc-500 text-[11px]">Tab: 4 spaces</span>
          </div>

          <textarea
            ref={textareaRef}
            value={sourceCode}
            onChange={(e) => setSourceCode(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="w-full h-[460px] p-4 bg-zinc-50 dark:bg-zinc-950 font-mono text-sm leading-relaxed outline-none resize-none"
            placeholder="// Nhập mã nguồn MiRust..."
          />

          <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 text-xs flex items-center justify-between">
            {error ? (
              <div className="flex items-center gap-1.5 text-rose-500 font-medium truncate">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="truncate">{error}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Cú pháp hợp lệ</span>
              </div>
            )}
            <span className="text-zinc-500 text-[11px] shrink-0 ml-2">{sourceCode.split("\n").length} dòng</span>
          </div>
        </div>

        <div className="flex flex-col bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab("jasmin")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                  activeTab === "jasmin"
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Jasmin (.j)</span>
              </button>
              <button
                onClick={() => setActiveTab("ast")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                  activeTab === "ast"
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <ListTree className="w-3.5 h-3.5" />
                <span>AST</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={copyJasmin}
                disabled={!jasminOutput}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 text-xs cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Đã chép" : "Chép"}</span>
              </button>
              <button
                onClick={downloadJasmin}
                disabled={!jasminOutput}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 text-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải .j</span>
              </button>
            </div>
          </div>

          <div className="flex-1 bg-zinc-50 dark:bg-zinc-950 overflow-auto h-[460px] p-4 text-xs font-mono">
            {error ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
                <p className="text-rose-500 font-medium mb-1">Không thể sinh mã Jasmin</p>
                <p className="text-xs max-w-md">{error}</p>
              </div>
            ) : activeTab === "jasmin" ? (
              <pre className="text-emerald-700 dark:text-emerald-300 whitespace-pre leading-relaxed">
                {jasminOutput || "Nhấn Biên dịch để xem Jasmin assembly."}
              </pre>
            ) : (
              <pre className="text-sky-700 dark:text-sky-300 whitespace-pre-wrap leading-relaxed">
                {astOutput ? JSON.stringify(astOutput, null, 2) : "Chưa có dữ liệu AST."}
              </pre>
            )}
          </div>

          <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 text-xs flex items-center justify-between text-zinc-500">
            <span>{jasminOutput ? `${jasminOutput.split("\n").length} dòng Jasmin` : "Chờ biên dịch"}</span>
            <span>JVM Target</span>
          </div>
        </div>
      </div>

      {showDocs && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-xs text-zinc-500 dark:text-zinc-400 space-y-1.5 leading-relaxed">
          <p>
            • Hỗ trợ <code className="font-mono text-indigo-500">fn</code>, kiểu{" "}
            <code className="font-mono text-indigo-500">i32/bool/void</code>,{" "}
            <code className="font-mono text-indigo-500">let/let mut</code>,{" "}
            <code className="font-mono text-indigo-500">if/else</code>,{" "}
            <code className="font-mono text-indigo-500">while</code>,{" "}
            <code className="font-mono text-indigo-500">for in</code>,{" "}
            <code className="font-mono text-indigo-500">switch/case/break</code>, và{" "}
            <code className="font-mono text-indigo-500">println_i32</code>.
          </p>
          <p>
            • Chạy file đã xuất:{" "}
            <code className="font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
              java -jar jasmin.jar MiRustProgram.j && java MiRustProgram
            </code>
          </p>
        </div>
      )}
    </div>
  );
}
