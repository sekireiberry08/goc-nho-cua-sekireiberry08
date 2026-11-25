# MiRust → Jasmin Compiler Lab v4

Standalone browser app. Open `index.html`; no server or dependencies required.

## Pipeline
- Lexer with source positions
- Recursive-descent parser + Pratt expression parser
- AST (`Program`, `Function`, statement and expression nodes)
- Code generation to JVM Jasmin syntax with stack-height tracking and local slot allocation

## Supported subset
- `fn` functions, `i32`/`bool`/`void`, parameters, calls, recursion
- Local declarations, assignments, lexical block scopes, return
- Integer arithmetic/comparisons, boolean operators
- `if/else`, `while`, `for (i in start..end)`, `switch/case/default`, `break`, `continue`
- `print_i32`, `println_i32`, `println`
- Jasmin class/method headers, JVM descriptors, `.limit stack`, `.limit locals`, local load/store, branches, invocation and arithmetic instructions

## Important limitations
This is not yet a complete MiRust v1.0 implementation. Missing global variables, structs and separate struct classes, aliases, f32/string literals and their I/O, arrays, Box allocation/ownership, complete definite-assignment and ownership checks, all static errors, and automated Jasmin assembly/JVM execution tests. The supported subset uses i32/bool/void. Some grammar/static semantics are intentionally restricted; unsupported constructs should be treated as not implemented.

Jasmin output is real Jasmin syntax intended for assembly with a Jasmin assembler, but this artifact has not bundled or run an assembler/JVM. Test assembled output in the target Java runtime before relying on it.
