import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { rlNoDomGlobals } from "./rl-no-dom-globals.js";

describe("rl-no-dom-globals — flags each target global", () => {
  it("flags `window` member access", () => {
    const result = runRule(rlNoDomGlobals, `if (window.innerWidth > 600) {}`);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain("window");
    expect(result.diagnostics[0].message).toContain("lynx");
  });

  it("flags `document` member access", () => {
    const result = runRule(rlNoDomGlobals, `document.querySelector(".foo");`);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain("document");
  });

  it("flags `localStorage` member access", () => {
    const result = runRule(rlNoDomGlobals, `const x = localStorage.getItem("user");`);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain("localStorage");
  });

  it("flags `sessionStorage` member access", () => {
    const result = runRule(rlNoDomGlobals, `sessionStorage.setItem("k", "v");`);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain("sessionStorage");
  });

  it("flags `navigator` member access", () => {
    const result = runRule(rlNoDomGlobals, `const ua = navigator.userAgent;`);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain("navigator");
  });

  it("flags a bare read of `window` (not just member access)", () => {
    const result = runRule(rlNoDomGlobals, `console.log(window);`);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags an assignment to `window.foo`", () => {
    const result = runRule(rlNoDomGlobals, `window.foo = 1;`);
    expect(result.diagnostics).toHaveLength(1);
  });
});

describe("rl-no-dom-globals — no flag on shadowed bindings", () => {
  it("does NOT flag `window` shadowed by a parameter", () => {
    const result = runRule(
      rlNoDomGlobals,
      `function f(window) { return window.x; }`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag `window` shadowed by a `const`", () => {
    const result = runRule(
      rlNoDomGlobals,
      `const window = makeFakeWindow(); console.log(window);`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag `document` shadowed by destructure", () => {
    const result = runRule(
      rlNoDomGlobals,
      `const { document } = props; document.x;`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag `navigator` brought in by `import`", () => {
    const result = runRule(
      rlNoDomGlobals,
      `import { navigator } from "./util"; navigator.foo();`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag `window` shadowed by an arrow-function param", () => {
    const result = runRule(rlNoDomGlobals, `const f = (window) => window.x;`);
    expect(result.diagnostics).toHaveLength(0);
  });
});

describe("rl-no-dom-globals — no flag on property side / unrelated identifiers", () => {
  it("does NOT flag `obj.window` (window is a property here, not the global)", () => {
    const result = runRule(rlNoDomGlobals, `const w = obj.window;`);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag `{ window: 1 }` as an object-literal key", () => {
    const result = runRule(rlNoDomGlobals, `const o = { window: 1 };`);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag identifiers that just happen to contain a target name", () => {
    const result = runRule(rlNoDomGlobals, `const myWindow = make(); myWindow.x;`);
    expect(result.diagnostics).toHaveLength(0);
  });
});

describe("rl-no-dom-globals — runtime-environment guards", () => {
  it("does NOT flag `typeof window` (env-detection idiom)", () => {
    const result = runRule(
      rlNoDomGlobals,
      `if (typeof window !== "undefined") { /* … */ }`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag `typeof document === 'undefined'`", () => {
    const result = runRule(
      rlNoDomGlobals,
      `const isServer = typeof document === "undefined";`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });
});
