import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { rlPreferMainThreadRef } from "./rl-prefer-main-thread-ref.js";

describe("rl-prefer-main-thread-ref — flags useRef inside main-thread functions", () => {
  it("flags `useRef(null)` inside a `'main thread'` arrow function", () => {
    const result = runRule(
      rlPreferMainThreadRef,
      `const onTap = () => { 'main thread'; const r = useRef(null); };`,
    );
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain("useMainThreadRef");
  });

  it("flags `useRef(0)` inside a `'main thread'` function declaration", () => {
    const result = runRule(
      rlPreferMainThreadRef,
      `function onTap() { 'main thread'; const r = useRef(0); }`,
    );
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags multiple useRef calls inside the same main-thread function", () => {
    const result = runRule(
      rlPreferMainThreadRef,
      `const onTap = () => { 'main thread'; const a = useRef(0); const b = useRef(null); };`,
    );
    expect(result.diagnostics).toHaveLength(2);
  });

  it("flags `useRef` deep inside a main-thread function body (nested block)", () => {
    const result = runRule(
      rlPreferMainThreadRef,
      `const onTap = () => { 'main thread'; if (true) { const r = useRef(null); } };`,
    );
    expect(result.diagnostics).toHaveLength(1);
  });
});

describe("rl-prefer-main-thread-ref — runOnBackground escape hatch", () => {
  it("does NOT flag `useRef` inside `runOnBackground(() => useRef(...))`", () => {
    const result = runRule(
      rlPreferMainThreadRef,
      `const onTap = () => { 'main thread'; runOnBackground(() => { const r = useRef(null); return r; }); };`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag `useRef` passed directly as a runOnBackground argument", () => {
    const result = runRule(
      rlPreferMainThreadRef,
      `const onTap = () => { 'main thread'; runOnBackground(() => useRef(null)); };`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });
});

describe("rl-prefer-main-thread-ref — no flag outside main-thread scope", () => {
  it("does NOT flag `useRef` at the top of a normal React component", () => {
    const result = runRule(
      rlPreferMainThreadRef,
      `function Component() { const r = useRef(null); return r; }`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag `useRef` in a sibling non-main-thread function", () => {
    const result = runRule(
      rlPreferMainThreadRef,
      `
      function onTap() { 'main thread'; tap(); }
      function Component() { const r = useRef(null); return r; }
      `,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag identifier accesses named `useRef` (only call expressions)", () => {
    const result = runRule(
      rlPreferMainThreadRef,
      `const onTap = () => { 'main thread'; const fn = useRef; };`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });
});
