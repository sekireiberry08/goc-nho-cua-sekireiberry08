/* MiRust v1.0 focused compiler frontend + Jasmin backend. Supported: i32/bool/void, funcs, locals, calls, arithmetic/comparison/logical ops, if/else, while, for-in range, break/continue, return, print_i32/println_i32/println. */
"use strict";
const KEYWORDS = new Set(
  "fn let mut i32 bool void true false if else while for in break continue return switch case default".split(
    " ",
  ),
);
function lex(src) {
  const out = [];
  let i = 0,
    line = 1,
    col = 1;
  const add = (kind, value, startLine = line, startCol = col) =>
    out.push({ kind, value, line: startLine, col: startCol });
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      if (c === "\n") {
        line++;
        col = 1;
      } else col++;
      i++;
      continue;
    }
    if (src.startsWith("//", i)) {
      while (i < src.length && src[i] !== "\n") {
        i++;
        col++;
      }
      continue;
    }
    const sl = line,
      sc = col;
    if (/[A-Za-z_]/.test(c)) {
      let s = "";
      while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) {
        s += src[i++];
        col++;
      }
      add(KEYWORDS.has(s) ? "kw" : "id", s, sl, sc);
      continue;
    }
    if (/[0-9]/.test(c)) {
      let s = "";
      while (i < src.length && /[0-9]/.test(src[i])) {
        s += src[i++];
        col++;
      }
      add("int", s, sl, sc);
      continue;
    }
    const two = src.slice(i, i + 2);
    if (["->", "==", "!=", "<=", ">=", "&&", "||", ".."].includes(two)) {
      add("op", two, sl, sc);
      i += 2;
      col += 2;
      continue;
    }
    if ("+-*/%<>=!;:,(){}[]".includes(c)) {
      add("op", c, sl, sc);
      i++;
      col++;
      continue;
    }
    throw new Error(`Lexical error at ${line}:${col}: unexpected '${c}'`);
  }
  out.push({ kind: "eof", value: "<eof>", line, col });
  return out;
}
class Parser {
  constructor(tokens) {
    this.t = tokens;
    this.i = 0;
  }
  peek(v) {
    return this.t[this.i].value === v;
  }
  take() {
    return this.t[this.i++];
  }
  need(v) {
    const t = this.take();
    if (t.value !== v) this.err(`Expected '${v}', got '${t.value}'`, t);
    return t;
  }
  ident() {
    const t = this.take();
    if (t.kind !== "id") this.err(`Expected identifier, got '${t.value}'`, t);
    return t.value;
  }
  err(m, t = this.t[this.i]) {
    throw new Error(`Syntax error at ${t.line}:${t.col}: ${m}`);
  }
  type() {
    const t = this.take();
    if (!["i32", "bool", "void"].includes(t.value))
      this.err(
        `Unsupported type '${t.value}' (this build supports i32, bool, void)`,
        t,
      );
    return t.value;
  }
  program() {
    const funcs = [];
    while (!this.peek("<eof>")) funcs.push(this.func());
    if (!funcs.length) this.err("Program must contain a function");
    return { kind: "Program", funcs };
  }
  func() {
    this.need("fn");
    const name = this.ident();
    this.need("(");
    const params = [];
    if (!this.peek(")"))
      do {
        const n = this.ident();
        this.need(":");
        params.push({ name: n, type: this.type() });
        if (!this.peek(",")) break;
        this.take();
      } while (true);
    this.need(")");
    let ret = "void";
    if (this.peek("->")) {
      this.take();
      ret = this.type();
    }
    const body = this.block();
    return { kind: "Function", name, params, ret, body };
  }
  block() {
    this.need("{");
    const body = [];
    while (!this.peek("}")) {
      if (this.peek("<eof>")) this.err("Unclosed block");
      body.push(this.stmt());
    }
    this.take();
    return { kind: "Block", body };
  }
  stmt() {
    if (this.peek("{")) return this.block();
    if (this.peek("let")) {
      this.take();
      const mutable = this.peek("mut") ? (this.take(), true) : false;
      const name = this.ident();
      let type = null;
      if (this.peek(":")) {
        this.take();
        type = this.type();
      }
      let init = null;
      if (this.peek("=")) {
        this.take();
        init = this.expr();
      }
      if (!type && !init) this.err("Inferred declaration needs initializer");
      this.need(";");
      return { kind: "Decl", name, mutable, type, init };
    }
    if (this.peek("if")) {
      this.take();
      this.need("(");
      const cond = this.expr();
      this.need(")");
      const yes = this.stmt();
      let no = null;
      if (this.peek("else")) {
        this.take();
        no = this.stmt();
      }
      return { kind: "If", cond, yes, no };
    }
    if (this.peek("while")) {
      this.take();
      this.need("(");
      const cond = this.expr();
      this.need(")");
      return { kind: "While", cond, body: this.stmt() };
    }
    if (this.peek("for")) {
      this.take();
      this.need("(");
      const name = this.ident();
      this.need("in");
      const start = this.expr();
      this.need("..");
      const end = this.expr();
      this.need(")");
      return { kind: "For", name, start, end, body: this.stmt() };
    }
    if (this.peek("switch")) {
      this.take();
      this.need("(");
      const value = this.expr();
      this.need(")");
      this.need("{");
      const cases = [];
      let def = null;
      while (!this.peek("}")) {
        if (this.peek("case")) {
          this.take();
          const test = this.expr();
          this.need(":");
          const body = [];
          while (!this.peek("case") && !this.peek("default") && !this.peek("}"))
            body.push(this.stmt());
          cases.push({ test, body });
        } else if (this.peek("default")) {
          if (def) this.err("Only one default arm is allowed");
          this.take();
          this.need(":");
          def = [];
          while (!this.peek("case") && !this.peek("}")) def.push(this.stmt());
        } else this.err("Expected case/default in switch");
      }
      this.take();
      return { kind: "Switch", value, cases, def };
    }
    if (this.peek("break") || this.peek("continue")) {
      const kind = this.take().value;
      this.need(";");
      return { kind: kind === "break" ? "Break" : "Continue" };
    }
    if (this.peek("return")) {
      this.take();
      let value = null;
      if (!this.peek(";")) value = this.expr();
      this.need(";");
      return { kind: "Return", value };
    }
    const expr = this.expr();
    if (this.peek("=")) {
      this.take();
      if (expr.kind !== "Name")
        this.err("Assignment target must be a local variable");
      const value = this.expr();
      this.need(";");
      return { kind: "Assign", name: expr.name, value };
    }
    this.need(";");
    return { kind: "ExprStmt", expr };
  }
  expr(min = 0) {
    let left;
    const t = this.take();
    if (t.kind === "int") left = { kind: "Int", value: Number(t.value) };
    else if (t.value === "true" || t.value === "false")
      left = { kind: "Bool", value: t.value === "true" };
    else if (t.kind === "id") {
      if (this.peek("(")) {
        this.take();
        const args = [];
        if (!this.peek(")"))
          do {
            args.push(this.expr());
            if (!this.peek(",")) break;
            this.take();
          } while (true);
        this.need(")");
        left = { kind: "Call", name: t.value, args };
      } else left = { kind: "Name", name: t.value };
    } else if (t.value === "(") {
      left = this.expr();
      this.need(")");
    } else if (["-", "!"].includes(t.value)) {
      left = { kind: "Unary", op: t.value, arg: this.expr(7) };
    } else this.err(`Expected expression, got '${t.value}'`, t);
    const prec = {
      "||": 1,
      "&&": 2,
      "==": 3,
      "!=": 3,
      "<": 4,
      "<=": 4,
      ">": 4,
      ">=": 4,
      "+": 5,
      "-": 5,
      "*": 6,
      "/": 6,
      "%": 6,
    };
    while (prec[this.t[this.i].value] >= min) {
      const op = this.take().value;
      const p = prec[op];
      const right = this.expr(p + 1);
      left = { kind: "Binary", op, left, right };
    }
    return left;
  }
}
const desc = (t) => (t === "void" ? "V" : t === "bool" ? "Z" : "I");
function endsWithReturn(s) {
  if (!s) return false;
  if (s.kind === "Return") return true;
  if (s.kind === "Block")
    return s.body.length > 0 && endsWithReturn(s.body[s.body.length - 1]);
  if (s.kind === "If")
    return !!s.no && endsWithReturn(s.yes) && endsWithReturn(s.no);
  return false;
}
class Jasmin {
  constructor(ast, className = "MiRustProgram") {
    this.ast = ast;
    this.cls = className;
    this.funcs = new Map(ast.funcs.map((f) => [f.name, f]));
    this.lines = [];
    this.stack = 0;
    this.maxStack = 0;
    this.locals = 0;
    this.scopes = [];
    this.loops = [];
    this.label = 0;
    this.currentRet = "void";
  }
  emit(s, delta = 0) {
    this.lines.push("        " + s);
    this.stack += delta;
    if (this.stack < 0)
      throw Error("Internal codegen error: operand stack underflow at " + s);
    this.maxStack = Math.max(this.maxStack, this.stack);
  }
  labelAt(s, stack = this.stack) {
    this.stack = stack;
    this.lines.push(s + ":");
  }
  newLabel() {
    return "L" + this.label++;
  }
  pushScope() {
    this.scopes.push(new Map());
  }
  popScope() {
    this.scopes.pop();
  }
  lookup(n) {
    for (let i = this.scopes.length - 1; i >= 0; i--)
      if (this.scopes[i].has(n)) return this.scopes[i].get(n);
    throw Error(`Undeclared local '${n}'`);
  }
  declare(n, t, mut) {
    const scope = this.scopes[this.scopes.length - 1];
    if (scope.has(n)) throw Error(`Redeclared local '${n}'`);
    const slot = this.locals++;
    scope.set(n, { slot, type: t, mut });
    return scope.get(n);
  }
  load(slot) {
    this.emit(slot < 4 ? `iload_${slot}` : `iload ${slot}`, 1);
  }
  store(slot) {
    this.emit(slot < 4 ? `istore_${slot}` : `istore ${slot}`, -1);
  }
  compile() {
    if (this.funcs.size !== this.ast.funcs.length)
      throw Error("Redeclared function name");
    for (const f of this.ast.funcs) {
      const names = new Set();
      for (const p of f.params) {
        if (names.has(p.name))
          throw Error(`Duplicate parameter '${p.name}' in '${f.name}'`);
        names.add(p.name);
        if (p.type === "void") throw Error("Parameter cannot have type void");
      }
    }
    const main = this.funcs.get("main");
    if (!main || main.params.length || main.ret !== "void")
      throw Error(
        "No Entry Error: require fn main() -> void with no parameters",
      );
    for (const f of this.ast.funcs) {
      if (f.name === "main" && (f.params.length || f.ret !== "void"))
        throw Error("Invalid main signature");
      this.compileFunc(f);
    }
    return (this.out || []).join("\n") + "\n";
  }
  compileFunc(f) {
    this.lines = [];
    this.stack = 0;
    this.maxStack = 0;
    this.locals = 0;
    this.scopes = [];
    this.label = 0;
    this.currentRet = f.ret;
    this.pushScope();
    for (const p of f.params) this.declare(p.name, p.type, false);
    this.compileStmt(f.body);
    if (f.ret === "void") this.emit("return");
    else if (!endsWithReturn(f.body))
      throw Error(
        `Function '${f.name}' may fall through without returning a value`,
      );
    const descriptor =
      "(" + f.params.map((p) => desc(p.type)).join("") + ")" + desc(f.ret);
    const jname = f.name === "main" ? "main" : "_" + f.name;
    const header =
      f.name === "main"
        ? ".method public static main([Ljava/lang/String;)V"
        : `.method public static ${jname}${descriptor}`;
    return this.outputFunc(header);
  }
  outputFunc(header) {
    const content = [
      header,
      `    .limit stack ${Math.max(1, this.maxStack)}`,
      `    .limit locals ${Math.max(1, this.locals)}`,
      ...this.lines,
      ".end method",
      "",
    ];
    this.out = (this.out || []).concat(content);
    return content.join("\n");
  }
  compileStmt(s) {
    switch (s.kind) {
      case "Block":
        this.pushScope();
        for (const x of s.body) this.compileStmt(x);
        this.popScope();
        break;
      case "Decl": {
        if (s.type === "void")
          throw Error("Local variable cannot have type void");
        if (!s.init)
          throw Error(
            "Uninitialized local declarations are not supported by this codegen yet",
          );
        const v = this.compileExpr(s.init);
        const type = s.type || v;
        if (type !== v)
          throw Error(
            `Type mismatch in declaration ${s.name}: ${type} <- ${v}`,
          );
        const sym = this.declare(s.name, type, s.mutable);
        this.store(sym.slot);
        break;
      }
      case "Assign": {
        const sym = this.lookup(s.name);
        if (!sym.mut)
          throw Error(`Mutability violation: '${s.name}' is immutable`);
        const v = this.compileExpr(s.value);
        if (v !== sym.type)
          throw Error(`Assignment type mismatch for '${s.name}'`);
        this.store(sym.slot);
        break;
      }
      case "ExprStmt": {
        const t = this.compileExpr(s.expr);
        if (t !== "void") this.emit("pop", -1);
        break;
      }
      case "Return":
        if (s.value) {
          const t = this.compileExpr(s.value);
          if (t !== this.currentRet) throw Error("Return type mismatch");
          this.emit("ireturn", -1);
        } else {
          if (this.currentRet !== "void") throw Error("Missing return value");
          this.emit("return");
        }
        break;
      case "If": {
        this.requireBool(this.compileExpr(s.cond), "if condition");
        const el = this.newLabel(),
          end = this.newLabel();
        this.emit(`ifeq ${el}`, -1);
        this.compileStmt(s.yes);
        if (s.no) {
          this.emit(`goto ${end}`);
          this.labelAt(el, 0);
          this.compileStmt(s.no);
          this.labelAt(end, 0);
        } else this.labelAt(el, 0);
        break;
      }
      case "While": {
        const start = this.newLabel(),
          end = this.newLabel();
        this.labelAt(start, 0);
        this.requireBool(this.compileExpr(s.cond), "while condition");
        this.emit(`ifeq ${end}`, -1);
        this.loops.push({ break: end, continue: start });
        this.compileStmt(s.body);
        this.loops.pop();
        this.emit(`goto ${start}`);
        this.labelAt(end, 0);
        break;
      }
      case "For": {
        const st = this.compileExpr(s.start);
        if (st !== "i32") throw Error("for range start must be i32");
        const startSlot = this.locals++;
        this.store(startSlot);
        const et = this.compileExpr(s.end);
        if (et !== "i32") throw Error("for range end must be i32");
        const endSlot = this.locals++;
        this.store(endSlot);
        this.pushScope();
        const iv = this.declare(s.name, "i32", false);
        this.load(startSlot);
        this.store(iv.slot);
        const head = this.newLabel(),
          step = this.newLabel(),
          end = this.newLabel();
        this.labelAt(head, 0);
        this.load(iv.slot);
        this.load(endSlot);
        this.emit("if_icmpge " + end, -2);
        this.loops.push({ break: end, continue: step });
        this.compileStmt(s.body);
        this.loops.pop();
        this.labelAt(step, 0);
        this.load(iv.slot);
        this.emit("iconst_1", 1);
        this.emit("iadd", -1);
        this.store(iv.slot);
        this.emit("goto " + head);
        this.labelAt(end, 0);
        this.popScope();
        break;
      }
      case "Switch": {
        const vt = this.compileExpr(s.value);
        if (vt !== "i32" && vt !== "bool")
          throw Error("switch value must be i32 or bool");
        const slot = this.locals++;
        this.store(slot);
        const end = this.newLabel();
        const labels = s.cases.map(() => this.newLabel());
        let defaultLabel = s.def ? this.newLabel() : end;
        const seen = new Set();
        for (let i = 0; i < s.cases.length; i++) {
          const c = s.cases[i];
          if (c.test.kind !== "Int" && c.test.kind !== "Bool")
            throw Error(
              "switch case labels must be constant integer/boolean literals",
            );
          if (
            (vt === "i32" && c.test.kind !== "Int") ||
            (vt === "bool" && c.test.kind !== "Bool")
          )
            throw Error("switch case type must match switch value type");
          const k = String(c.test.value);
          if (seen.has(k)) throw Error("Duplicate switch case");
          seen.add(k);
          this.load(slot);
          this.compileExpr(c.test);
          this.emit("if_icmpeq " + labels[i], -2);
        }
        this.emit("goto " + defaultLabel);
        this.pushScope();
        this.loops.push({ break: end, continue: null });
        for (let i = 0; i < s.cases.length; i++) {
          this.labelAt(labels[i], 0);
          for (const st of s.cases[i].body) this.compileStmt(st);
        }
        if (s.def) {
          this.labelAt(defaultLabel, 0);
          for (const st of s.def) this.compileStmt(st);
        }
        this.loops.pop();
        this.popScope();
        this.labelAt(end, 0);
        break;
      }
      case "Break": {
        const c = [...this.loops].reverse().find((x) => x.break);
        if (!c) throw Error("break outside loop/switch");
        this.emit("goto " + c.break);
        break;
      }
      case "Continue": {
        const c = [...this.loops].reverse().find((x) => x.continue);
        if (!c) throw Error("continue outside loop");
        this.emit("goto " + c.continue);
        break;
      }
      default:
        throw Error("Unsupported statement " + s.kind);
    }
  }
  requireBool(t, where) {
    if (t !== "bool") throw Error(`${where} must be bool, got ${t}`);
  }
  compileExpr(e) {
    switch (e.kind) {
      case "Int":
        if (e.value <= 5) this.emit("iconst_" + e.value, 1);
        else if (e.value <= 127) this.emit("bipush " + e.value, 1);
        else this.emit("ldc " + e.value, 1);
        return "i32";
      case "Bool":
        this.emit(e.value ? "iconst_1" : "iconst_0", 1);
        return "bool";
      case "Name": {
        const s = this.lookup(e.name);
        this.load(s.slot);
        return s.type;
      }
      case "Unary": {
        const t = this.compileExpr(e.arg);
        if (e.op === "-") {
          if (t !== "i32") throw Error("Unary - requires i32");
          this.emit("ineg");
          return "i32";
        }
        if (t !== "bool") throw Error("Unary ! requires bool");
        this.emit("iconst_1", 1);
        this.emit("ixor", -1);
        return "bool";
      }
      case "Binary": {
        const a = this.compileExpr(e.left),
          b = this.compileExpr(e.right);
        if (a !== b) throw Error("Binary operand types differ");
        if (["+", "-", "*", "/", "%"].includes(e.op)) {
          if (a !== "i32") throw Error("Arithmetic supports i32 only");
          this.emit(
            { "+": "iadd", "-": "isub", "*": "imul", "/": "idiv", "%": "irem" }[
              e.op
            ],
            -1,
          );
          return "i32";
        }
        if (["==", "!=", "<", "<=", ">", ">="].includes(e.op)) {
          if (a !== "i32" && a !== "bool")
            throw Error("Comparison supports i32/bool");
          const l = this.newLabel(),
            end = this.newLabel();
          this.emit(
            {
              "==": "if_icmpeq",
              "!=": "if_icmpne",
              "<": "if_icmplt",
              "<=": "if_icmple",
              ">": "if_icmpgt",
              ">=": "if_icmpge",
            }[e.op] +
              " " +
              l,
            -2,
          );
          this.emit("iconst_0", 1);
          this.emit("goto " + end);
          this.labelAt(l, 0);
          this.emit("iconst_1", 1);
          this.labelAt(end, 1);
          return "bool";
        }
        if (e.op === "&&" || e.op === "||") {
          this.requireBool(a, "logical operand");
          const branch = e.op === "&&" ? "ifeq" : "ifne";
          const decisive = this.newLabel(),
            end = this.newLabel();
          this.emit(branch + " " + decisive, -1);
          const b = this.compileExpr(e.right);
          this.requireBool(b, "logical operand");
          this.emit(branch + " " + decisive, -1);
          this.emit(e.op === "&&" ? "iconst_1" : "iconst_0", 1);
          this.emit("goto " + end);
          this.labelAt(decisive, 0);
          this.emit(e.op === "&&" ? "iconst_0" : "iconst_1", 1);
          this.labelAt(end, 1);
          return "bool";
        }
        throw Error("Unsupported operator " + e.op);
      }
      case "Call": {
        if (["print_i32", "println_i32"].includes(e.name)) {
          if (e.args.length !== 1)
            throw Error(`${e.name} expects one argument`);
          if (this.compileExpr(e.args[0]) !== "i32")
            throw Error(`${e.name} expects i32`);
          this.emit("getstatic java/lang/System/out Ljava/io/PrintStream;", 1);
          this.emit("swap");
          this.emit(
            "invokevirtual java/io/PrintStream/" +
              (e.name === "print_i32" ? "print" : "println") +
              "(I)V",
            -2,
          );
          return "void";
        }
        if (e.name === "println") {
          if (e.args.length) throw Error("println expects no args");
          this.emit("getstatic java/lang/System/out Ljava/io/PrintStream;", 1);
          this.emit("invokevirtual java/io/PrintStream/println()V", -1);
          return "void";
        }
        const f = this.funcs.get(e.name);
        if (!f) throw Error(`Unknown function '${e.name}'`);
        if (e.args.length !== f.params.length)
          throw Error(`Function '${e.name}' expects ${f.params.length} args`);
        for (let i = 0; i < e.args.length; i++) {
          const t = this.compileExpr(e.args[i]);
          if (t !== f.params[i].type)
            throw Error(`Argument ${i + 1} type mismatch for '${e.name}'`);
        }
        this.emit(
          `invokestatic ${this.cls}/_${e.name}(${f.params.map((p) => desc(p.type)).join("")})${desc(f.ret)}`,
          f.ret === "void" ? -e.args.length : 1 - e.args.length,
        );
        return f.ret;
      }
      default:
        throw Error("Unsupported expression " + e.kind);
    }
  }
}
function compileMiRust(source) {
  const ast = new Parser(lex(source)).program();
  const gen = new Jasmin(ast);
  gen.compile();
  const body = gen.out || [];
  return {
    ast,
    jasmin: [
      ".class public MiRustProgram",
      ".super java/lang/Object",
      "",
      ...body,
    ].join("\n"),
  };
}
