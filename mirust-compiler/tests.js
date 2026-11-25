const fs = require("fs");
const vm = require("vm");
const source = fs.readFileSync(__dirname + "/compiler.js", "utf8");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(source + ";globalThis.compileUnderTest = compileMiRust;", ctx);
const cases = [
  [
    "recursive function",
    `fn fact(n: i32) -> i32 { if (n <= 1) { return 1; } else { return n * fact(n - 1); } } fn main() -> void { println_i32(fact(5)); }`,
    ["invokestatic MiRustProgram/_fact(I)I", "ireturn"],
  ],
  [
    "while loop",
    `fn main() -> void { let mut x: i32 = 0; while (x < 3) { println_i32(x); x = x + 1; } }`,
    ["if_icmplt", "iadd", "goto"],
  ],
  [
    "switch fall-through/break",
    `fn main() -> void { let x: i32 = 2; switch (x) { case 1: println_i32(10); break; case 2: println_i32(20); break; default: println_i32(0); } }`,
    ["if_icmpeq", "goto"],
  ],
  [
    "short circuit boolean",
    `fn main() -> void { let x: bool = true && false; if (x) println_i32(1); else println_i32(0); }`,
    ["ifeq", "iconst_0", "iconst_1"],
  ],
];
let failed = 0;
for (const [name, input, mustContain] of cases) {
  try {
    const result = ctx.compileUnderTest(input).jasmin;
    const missing = mustContain.filter((s) => !result.includes(s));
    if (missing.length)
      throw new Error("missing Jasmin: " + missing.join(", "));
    console.log("PASS", name);
  } catch (e) {
    failed++;
    console.error("FAIL", name, e.message);
  }
}
if (failed) process.exit(1);
