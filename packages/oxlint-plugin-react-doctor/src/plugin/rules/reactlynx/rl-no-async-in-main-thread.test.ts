import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { rlNoAsyncInMainThread } from "./rl-no-async-in-main-thread.js";

describe("rl-no-async-in-main-thread — async modifier", () => {
  it("flags `async` on a `'main thread'` arrow function", () => {
    const result = runRule(
      rlNoAsyncInMainThread,
      `const f = async () => { 'main thread'; doSomething(); };`,
    );
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain("async");
  });

  it("flags `async` on a `'main thread'` function declaration", () => {
    const result = runRule(
      rlNoAsyncInMainThread,
      `async function f() { 'main thread'; doSomething(); }`,
    );
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags `async` on a `'main thread'` function expression", () => {
    const result = runRule(
      rlNoAsyncInMainThread,
      `const f = async function() { 'main thread'; doSomething(); };`,
    );
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag `async` on a function without the directive", () => {
    const result = runRule(rlNoAsyncInMainThread, `const f = async () => doSomething();`);
    expect(result.diagnostics).toHaveLength(0);
  });
});

describe("rl-no-async-in-main-thread — await expressions", () => {
  it("flags an `await` inside a `'main thread'` async function (catches both)", () => {
    const result = runRule(
      rlNoAsyncInMainThread,
      `const f = async () => { 'main thread'; await doSomething(); };`,
    );
    // One diagnostic for `async`, one for `await`. The user sees both lines
    // that need to move.
    expect(result.diagnostics).toHaveLength(2);
  });

  it("flags an `await` inside a nested async function lexically inside `'main thread'`", () => {
    const result = runRule(
      rlNoAsyncInMainThread,
      `const outer = () => { 'main thread'; (async () => { await go(); })(); };`,
    );
    // V1: the inner async IIFE itself is not main-thread-tagged, so the
    // async modifier doesn't flag (only async ON a main-thread function
    // does). The `await` is what catches the violation — its nearest
    // main-thread-function ancestor exists (the outer arrow), so the
    // helper walk finds it. Net: 1 diagnostic.
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain("await");
  });

  it("does NOT flag an `await` in a function outside a `'main thread'` scope", () => {
    const result = runRule(
      rlNoAsyncInMainThread,
      `const f = async () => { await doSomething(); };`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });
});

describe("rl-no-async-in-main-thread — new Promise()", () => {
  it("flags `new Promise(...)` inside a `'main thread'` function", () => {
    const result = runRule(
      rlNoAsyncInMainThread,
      `const f = () => { 'main thread'; const p = new Promise((resolve) => resolve(1)); };`,
    );
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain("Promise");
  });

  it("does NOT flag `new Promise(...)` outside a `'main thread'` function", () => {
    const result = runRule(
      rlNoAsyncInMainThread,
      `const f = () => { const p = new Promise((resolve) => resolve(1)); };`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag `new Promise(...)` when `Promise` is shadowed by a local binding", () => {
    const result = runRule(
      rlNoAsyncInMainThread,
      `import { Promise } from "./my-promise"; const f = () => { 'main thread'; const p = new Promise((r) => r(1)); };`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag `Promise.resolve(...)` (only `new Promise` constructor is flagged)", () => {
    const result = runRule(
      rlNoAsyncInMainThread,
      `const f = () => { 'main thread'; Promise.resolve(1); };`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });
});

describe("rl-no-async-in-main-thread — nested scopes", () => {
  it("does NOT flag an `await` inside a non-main-thread sibling function", () => {
    const result = runRule(
      rlNoAsyncInMainThread,
      `
      function mainHandler() { 'main thread'; tap(); }
      async function bgHandler() { await go(); }
      `,
    );
    expect(result.diagnostics).toHaveLength(0);
  });
});
