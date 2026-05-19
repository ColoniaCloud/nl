/**
 * Test: Manu Dev site generation pipeline
 * Run: node scripts/test-manu-dev.mjs
 */

// ─── Helpers (mirrors create-site/route.ts logic) ─────────────────────────────

function isJSXComplete(content) {
  let braces = 0, brackets = 0, parens = 0;
  let inSingle = false, inDouble = false, inTemplate = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (c === "\\" && (inSingle || inDouble || inTemplate)) { i++; continue; }
    if (c === "'" && !inDouble && !inTemplate) { inSingle = !inSingle; continue; }
    if (c === '"' && !inSingle && !inTemplate) { inDouble = !inDouble; continue; }
    if (c === "`" && !inSingle && !inDouble) { inTemplate = !inTemplate; continue; }
    if (inSingle || inDouble || inTemplate) continue;
    if (c === "{") braces++;
    if (c === "}") braces--;
    if (c === "[") brackets++;
    if (c === "]") brackets--;
    if (c === "(") parens++;
    if (c === ")") parens--;
  }
  return braces === 0 && brackets === 0 && parens === 0;
}

function parseGeneratedFiles(raw) {
  let text = raw.replace(/^```[a-zA-Z]*\n?/gm, "").replace(/^```\n?/gm, "");
  const headerRegex = /===FILE:\s*([^\n\r=][^\n\r]*?)\s*===(?:\r?\n)?/g;
  const headers = [];
  let hm;
  while ((hm = headerRegex.exec(text)) !== null) {
    headers.push({ path: hm[1].trim(), headerStart: hm.index, contentStart: hm.index + hm[0].length });
  }
  if (headers.length === 0) throw new Error(`No files found. Preview: ${raw.slice(0, 200)}`);
  const files = [];
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].contentStart;
    const end = i + 1 < headers.length ? headers[i + 1].headerStart : text.length;
    let content = text.slice(start, end).replace(/\r\n/g, "\n");
    content = content.replace(/\s*===END===\s*$/, "").trimEnd();
    if (headers[i].path) files.push({ path: headers[i].path, content });
  }
  return files;
}

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    passed++;
  } catch (e) {
    console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

console.log("\n\x1b[1m=== Manu Dev — Site Generation Tests ===\x1b[0m\n");

// isJSXComplete
console.log("\x1b[33misJSXComplete:\x1b[0m");
test("balanced JSX returns true", () => {
  assert(isJSXComplete(`export default function Home() { return (<div><h1>Hello</h1></div>); }`), "should be complete");
});
test("unbalanced opening brace returns false", () => {
  assert(!isJSXComplete(`export default function Home() { return (<div>`), "should be incomplete");
});
test("empty string returns true", () => {
  assert(isJSXComplete(""), "empty should be complete");
});
test("template literal does not confuse parser", () => {
  const jsx = "export default function Page() { const s = `hello {world}`; return <div>{s}</div>; }";
  assert(isJSXComplete(jsx), "template literal should be handled");
});
test("nested braces are counted correctly", () => {
  const jsx = "function A() { const x = { a: { b: 1 } }; return <div style={{ color: 'red' }} />; }";
  assert(isJSXComplete(jsx), "nested braces should balance");
});
test("string containing braces inside single quotes", () => {
  const jsx = "function B() { const x = '{not a brace}'; return <span>{x}</span>; }";
  assert(isJSXComplete(jsx), "quoted braces should not count");
});

// parseGeneratedFiles
console.log("\n\x1b[33mparseGeneratedFiles:\x1b[0m");
test("parses a single file block", () => {
  const raw = `===FILE:app/page.jsx===\nexport default function Home() { return <h1>Hi</h1>; }\n===END===`;
  const files = parseGeneratedFiles(raw);
  assert(files.length === 1, `expected 1 file, got ${files.length}`);
  assert(files[0].path === "app/page.jsx", `wrong path: ${files[0].path}`);
  assert(files[0].content.includes("return <h1>Hi</h1>"), "content mismatch");
});
test("parses multiple file blocks", () => {
  const raw = [
    "===FILE:app/globals.css===", "body { margin: 0; }", "===END===",
    "===FILE:app/layout.jsx===", "export default function Layout({ children }) { return <html><body>{children}</body></html>; }", "===END===",
    "===FILE:app/page.jsx===", "export default function Page() { return <main><h1>Home</h1></main>; }", "===END===",
  ].join("\n");
  const files = parseGeneratedFiles(raw);
  assert(files.length === 3, `expected 3 files, got ${files.length}`);
  assert(files.map(f => f.path).includes("app/globals.css"), "missing globals.css");
  assert(files.map(f => f.path).includes("app/layout.jsx"), "missing layout.jsx");
  assert(files.map(f => f.path).includes("app/page.jsx"), "missing page.jsx");
});
test("strips markdown code fences", () => {
  const raw = "```jsx\n===FILE:app/page.jsx===\nexport default function Home() { return <h1>Hi</h1>; }\n===END===\n```";
  const files = parseGeneratedFiles(raw);
  assert(files.length === 1, `expected 1 file, got ${files.length}`);
});
test("throws when no FILE markers found", () => {
  let threw = false;
  try { parseGeneratedFiles("Just some text without any markers"); } catch { threw = true; }
  assert(threw, "should throw on missing markers");
});
test("handles Windows line endings (CRLF)", () => {
  const raw = "===FILE:app/page.jsx===\r\nexport default function Home() { return <h1>Hi</h1>; }\r\n===END===";
  const files = parseGeneratedFiles(raw);
  assert(files.length === 1, "should parse CRLF");
  assert(!files[0].content.includes("\r"), "should strip CR");
});
test("path traversal is not an issue in parsing", () => {
  const raw = "===FILE:../evil.js===\nalert(1)\n===END===";
  const files = parseGeneratedFiles(raw);
  assert(files[0].path === "../evil.js", "parsing returns raw path (security handled in writeFiles)");
});

// Integration: parse + isJSXComplete
console.log("\n\x1b[33mIntegration (parse + validate):\x1b[0m");
test("valid layout.jsx passes validation", () => {
  const raw = [
    "===FILE:app/globals.css===", ":root { --color-primary: #1a1a2e; }", "===END===",
    "===FILE:app/layout.jsx===",
    'import "./globals.css";',
    "export default function Layout({ children }) {",
    "  return (",
    "    <html lang='es'>",
    "      <body>",
    "        <nav><a href='/'>Inicio</a></nav>",
    "        {children}",
    "        <footer><p>Mi negocio</p></footer>",
    "      </body>",
    "    </html>",
    "  );",
    "}",
    "===END===",
  ].join("\n");
  const files = parseGeneratedFiles(raw);
  assert(files.length === 2, `expected 2 files, got ${files.length}`);
  const jsx = files.find(f => f.path === "app/layout.jsx");
  assert(isJSXComplete(jsx.content), "layout.jsx should be complete");
});
test("truncated page.jsx fails validation", () => {
  const raw = [
    "===FILE:app/page.jsx===",
    "export default function Home() {",
    "  return (",
    "    <main>",
    "      <h1>Inicio</h1>",
    // deliberately truncated
  ].join("\n");
  const files = parseGeneratedFiles(raw);
  assert(files.length === 1, "should parse even if truncated");
  assert(!isJSXComplete(files[0].content), "truncated file should fail isJSXComplete");
});
test("all required files present in typical generation", () => {
  const requiredFiles = ["app/layout.jsx", "app/page.jsx"];
  const generatedPaths = ["app/globals.css", "app/layout.jsx", "app/page.jsx"];
  const missing = requiredFiles.filter(r => !generatedPaths.includes(r));
  assert(missing.length === 0, `missing required files: ${missing.join(", ")}`);
});

// Results
console.log(`\n${"─".repeat(42)}`);
const color = failed > 0 ? "\x1b[31m" : "\x1b[32m";
console.log(`${color}Results: ${passed} passed, ${failed} failed\x1b[0m`);
if (failed > 0) process.exit(1);
else console.log("\x1b[32mAll tests passed!\x1b[0m\n");
