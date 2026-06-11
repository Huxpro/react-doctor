import { describe, expect, it } from "vite-plus/test";
import { parseFixture } from "../../test-utils/parse-fixture.js";
import { isMainThreadFunction } from "./reactlynx.js";
import type { EsTreeNode } from "./es-tree-node.js";

const parseAndFindFirstFunction = (
  code: string,
  matcher: (node: EsTreeNode) => boolean = (node) =>
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression",
): EsTreeNode | null => {
  const { program } = parseFixture(code, { filename: "fixture.ts" });
  let found: EsTreeNode | null = null;
  const visit = (node: EsTreeNode | null | undefined): void => {
    if (!node || found) return;
    if (matcher(node)) {
      found = node;
      return;
    }
    for (const key of Object.keys(node)) {
      if (key === "parent") continue;
      const value = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        for (const child of value) visit(child as EsTreeNode);
      } else if (value && typeof value === "object" && "type" in value) {
        visit(value as EsTreeNode);
      }
    }
  };
  visit(program);
  return found;
};

describe("isMainThreadFunction — positive cases", () => {
  it("detects an arrow function with `'main thread'` directive", () => {
    const fn = parseAndFindFirstFunction(
      `const onTap = (event) => { 'main thread'; doSomething(event); };`,
    );
    expect(fn).not.toBeNull();
    expect(isMainThreadFunction(fn!)).toBe(true);
  });

  it("detects a function declaration with `'main thread'` directive", () => {
    const fn = parseAndFindFirstFunction(
      `function onTap(event) { 'main thread'; doSomething(event); }`,
    );
    expect(fn).not.toBeNull();
    expect(isMainThreadFunction(fn!)).toBe(true);
  });

  it("detects a function expression with `'main thread'` directive", () => {
    const fn = parseAndFindFirstFunction(
      `const onTap = function(event) { 'main thread'; doSomething(event); };`,
    );
    expect(fn).not.toBeNull();
    expect(isMainThreadFunction(fn!)).toBe(true);
  });

  it("accepts double-quoted directives", () => {
    const fn = parseAndFindFirstFunction(`const f = () => { "main thread"; };`);
    expect(isMainThreadFunction(fn!)).toBe(true);
  });
});

describe("isMainThreadFunction — negative cases", () => {
  it("rejects an arrow function with no block body (`() => x`)", () => {
    const fn = parseAndFindFirstFunction(`const f = (x) => x + 1;`);
    expect(fn).not.toBeNull();
    expect(isMainThreadFunction(fn!)).toBe(false);
  });

  it("rejects a function with no directive", () => {
    const fn = parseAndFindFirstFunction(`function plain() { return 1; }`);
    expect(isMainThreadFunction(fn!)).toBe(false);
  });

  it("rejects a function with `'use strict'` directive", () => {
    const fn = parseAndFindFirstFunction(`function strict() { 'use strict'; return 1; }`);
    expect(isMainThreadFunction(fn!)).toBe(false);
  });

  // False-positive guard: `console.log('main thread')` as a first statement
  // is NOT a directive prologue (oxc only sets `.directive` for prologue
  // positions), so the helper must distinguish.
  it("does NOT flag `console.log('main thread')` as a first statement", () => {
    const fn = parseAndFindFirstFunction(`function fake() { console.log('main thread'); }`);
    expect(isMainThreadFunction(fn!)).toBe(false);
  });

  it("rejects an empty function body", () => {
    const fn = parseAndFindFirstFunction(`function empty() {}`);
    expect(isMainThreadFunction(fn!)).toBe(false);
  });
});

describe("isMainThreadFunction — nested scopes", () => {
  it("flags only the outer function when the directive sits on the outer", () => {
    const { program } = parseFixture(
      `function outer() { 'main thread'; const inner = () => doSomething(); }`,
      { filename: "fixture.ts" },
    );
    const functions: EsTreeNode[] = [];
    const visit = (node: EsTreeNode | null | undefined): void => {
      if (!node) return;
      if (
        node.type === "FunctionDeclaration" ||
        node.type === "FunctionExpression" ||
        node.type === "ArrowFunctionExpression"
      ) {
        functions.push(node);
      }
      for (const key of Object.keys(node)) {
        if (key === "parent") continue;
        const value = (node as unknown as Record<string, unknown>)[key];
        if (Array.isArray(value)) {
          for (const child of value) visit(child as EsTreeNode);
        } else if (value && typeof value === "object" && "type" in value) {
          visit(value as EsTreeNode);
        }
      }
    };
    visit(program);
    expect(functions).toHaveLength(2);
    // outer (FunctionDeclaration) carries the directive; inner arrow does not.
    expect(isMainThreadFunction(functions[0])).toBe(true);
    expect(isMainThreadFunction(functions[1])).toBe(false);
  });

  it("flags only the inner function when the directive sits on the inner", () => {
    const { program } = parseFixture(
      `function outer() { const inner = () => { 'main thread'; return tap(); }; }`,
      { filename: "fixture.ts" },
    );
    const functions: EsTreeNode[] = [];
    const visit = (node: EsTreeNode | null | undefined): void => {
      if (!node) return;
      if (
        node.type === "FunctionDeclaration" ||
        node.type === "FunctionExpression" ||
        node.type === "ArrowFunctionExpression"
      ) {
        functions.push(node);
      }
      for (const key of Object.keys(node)) {
        if (key === "parent") continue;
        const value = (node as unknown as Record<string, unknown>)[key];
        if (Array.isArray(value)) {
          for (const child of value) visit(child as EsTreeNode);
        } else if (value && typeof value === "object" && "type" in value) {
          visit(value as EsTreeNode);
        }
      }
    };
    visit(program);
    expect(functions).toHaveLength(2);
    expect(isMainThreadFunction(functions[0])).toBe(false);
    expect(isMainThreadFunction(functions[1])).toBe(true);
  });
});

describe("isMainThreadFunction — non-function nodes", () => {
  it("returns false for a Program node", () => {
    const { program } = parseFixture(`'main thread';`, { filename: "fixture.ts" });
    expect(isMainThreadFunction(program)).toBe(false);
  });

  it("returns false for an ExpressionStatement", () => {
    const expr = parseAndFindFirstFunction(`'main thread';`, (node) => node.type === "ExpressionStatement");
    expect(expr).not.toBeNull();
    expect(isMainThreadFunction(expr!)).toBe(false);
  });
});
