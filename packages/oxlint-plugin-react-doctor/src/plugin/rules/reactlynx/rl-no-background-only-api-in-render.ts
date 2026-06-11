import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import { findVariableInitializer } from "../../utils/find-variable-initializer.js";
import { isBackgroundOnlyFunction } from "../../utils/reactlynx.js";
import type { Rule } from "../../utils/rule.js";

// JSX attributes whose value runs in a background-thread context. Both
// `bind*` (bubbling) and `catch*` (non-bubbling) tap / touch / scroll /
// custom events run on the background thread in ReactLynx, so calls to
// background-only APIs from inside their handlers are safe. `ref` is
// included separately because ref callbacks also fire on the background
// thread. `main-thread:bindtap` and other namespaced attributes use
// JSXNamespacedName instead of JSXIdentifier and so naturally fail the
// startsWith check — that's correct: their handlers run on the main
// thread and SHOULD be flagged when they reach for background APIs.
const isBackgroundEventAttributeName = (name: string): boolean =>
  name === "ref" || name.startsWith("bind") || name.startsWith("catch");

// Returns the closest ancestor that is the value of a JSX attribute
// matching `isBackgroundEventAttributeName`, walking through any
// intervening JSXExpressionContainer. Used to detect inline event /
// ref handler functions like `<view bindtap={(e) => { ... }} />`.
const isInsideInlineBackgroundHandler = (node: EsTreeNode): boolean => {
  let ancestor: EsTreeNode | null | undefined = node.parent;
  while (ancestor) {
    if (ancestor.type === "JSXExpressionContainer") {
      const jsxAttr = ancestor.parent;
      if (jsxAttr && jsxAttr.type === "JSXAttribute") {
        const attrName = (jsxAttr as { name?: { type?: string; name?: string } }).name;
        if (
          attrName?.type === "JSXIdentifier" &&
          typeof attrName.name === "string" &&
          isBackgroundEventAttributeName(attrName.name)
        ) {
          return true;
        }
      }
    }
    ancestor = ancestor.parent ?? null;
  }
  return false;
};

const REACT_EFFECT_HOOK_NAMES = new Set(["useEffect", "useLayoutEffect", "useImperativeHandle"]);

// Returns true when `node` is anywhere inside the callback argument of
// `useEffect` / `useLayoutEffect` / `useImperativeHandle`. The skill's
// `detect-background-only` reference treats these effect hooks as
// background-thread contexts because ReactLynx runs hook bodies after
// commit on the background thread. Walks the full ancestor chain so
// deeply-nested helper calls under an effect still count.
const isInsideEffectCallback = (node: EsTreeNode): boolean => {
  let ancestor: EsTreeNode | null | undefined = node.parent;
  while (ancestor) {
    if (
      ancestor.type === "CallExpression" &&
      "callee" in ancestor &&
      (ancestor as { callee?: { type?: string; name?: string } }).callee?.type === "Identifier" &&
      typeof (ancestor as { callee?: { type?: string; name?: string } }).callee?.name === "string" &&
      REACT_EFFECT_HOOK_NAMES.has(
        (ancestor as { callee?: { type?: string; name?: string } }).callee!.name as string,
      )
    ) {
      return true;
    }
    ancestor = ancestor.parent ?? null;
  }
  return false;
};

// Returns true when any ancestor is a function declared with a
// `'background only'` prologue directive. The directive is the
// authoritative author-asserted contract for background-thread
// execution — calls to background-only APIs from inside such a
// function are explicitly intended.
const isInsideBackgroundOnlyDirective = (node: EsTreeNode): boolean => {
  let ancestor: EsTreeNode | null | undefined = node.parent;
  while (ancestor) {
    if (
      ancestor.type === "FunctionDeclaration" ||
      ancestor.type === "FunctionExpression" ||
      ancestor.type === "ArrowFunctionExpression"
    ) {
      if (isBackgroundOnlyFunction(ancestor)) return true;
    }
    ancestor = ancestor.parent ?? null;
  }
  return false;
};

// Returns the lexical owning name of `node`'s nearest function ancestor,
// or null when there is no enclosing function or the function has no
// identifiable name. Used to look up against the per-file handler-name
// set collected during the JSX pre-pass.
const getEnclosingFunctionName = (node: EsTreeNode): string | null => {
  let ancestor: EsTreeNode | null | undefined = node.parent;
  while (ancestor) {
    if (ancestor.type === "FunctionDeclaration") {
      const id = (ancestor as { id?: { type?: string; name?: string } }).id;
      if (id?.type === "Identifier" && typeof id.name === "string") return id.name;
      return null;
    }
    if (ancestor.type === "FunctionExpression" || ancestor.type === "ArrowFunctionExpression") {
      const parent = ancestor.parent;
      if (parent?.type === "VariableDeclarator") {
        const id = (parent as { id?: { type?: string; name?: string } }).id;
        if (id?.type === "Identifier" && typeof id.name === "string") return id.name;
      }
      return null;
    }
    ancestor = ancestor.parent ?? null;
  }
  return null;
};

const isNativeModulesRoot = (node: EsTreeNodeOfType<"MemberExpression">): boolean => {
  if (node.object.type !== "Identifier") return false;
  if (node.object.name !== "NativeModules") return false;
  // Only the innermost MemberExpression rooted at `NativeModules` has
  // an Identifier `object`; outer chain links (`NativeModules.A.B`,
  // `NativeModules.A.B.C`) have a MemberExpression `object` and are
  // rejected by the first check above. So this single check is also
  // the dedup that prevents a triple-flag on chained access.
  return true;
};

const isLynxGetJSModuleCall = (node: EsTreeNodeOfType<"CallExpression">): boolean => {
  const callee = node.callee;
  if (callee.type !== "MemberExpression") return false;
  if (callee.object.type !== "Identifier" || callee.object.name !== "lynx") return false;
  if (callee.property.type !== "Identifier" || callee.property.name !== "getJSModule") return false;
  return true;
};

const MESSAGE_PREFIX =
  "Background-only API `";
const MESSAGE_SUFFIX =
  "` reached from a render-scope position. ReactLynx splits execution between a main thread (which runs render bodies and JSX evaluation) and a background thread (which runs effects, event handlers, and native-module calls). `lynx.getJSModule(...)` and `NativeModules.*` only work on the background thread — invoking them during render is at best a no-op and at worst a thread-context violation that blocks the UI.";

// Implements the `detect-background-only` rule from the
// `reactlynx-best-practices` skill — flags `lynx.getJSModule(...)` and
// `NativeModules.*` access outside any background-thread context.
//
// Valid background-thread contexts are:
//   1. Inside a `useEffect` / `useLayoutEffect` / `useImperativeHandle`
//      callback (effects run after commit on the background thread).
//   2. Inside a function carrying a `'background only'` prologue
//      directive (the authoritative author-asserted opt-in).
//   3. Inside an inline JSX event / ref handler — the function value
//      of a `bind*` / `catch*` / `ref` JSX attribute.
//   4. Inside a named function whose name is the identifier value of
//      a `bind*` / `catch*` / `ref` JSX attribute elsewhere in the file.
//
// Anything else (component render body, regular helpers called from
// render, top-level module code) is render-scope and gets flagged.
//
// Order-independence: the JSX-attribute pre-pass must finish before
// candidate violations can be filtered against the resulting
// handler-name set. Since visitors fire during the depth-first walk and
// a function declaration can lexically precede the JSX that names it,
// candidates are buffered during the visit and resolved in
// `Program:exit`. Identifier-shadowing for the `lynx` and
// `NativeModules` globals is handled via `findVariableInitializer` so a
// local `const lynx = ...` correctly silences the rule.
export const rlNoBackgroundOnlyApiInRender = defineRule<Rule>({
  id: "rl-no-background-only-api-in-render",
  title: "Background-only API in render scope",
  severity: "error",
  requires: ["reactlynx"],
  recommendation:
    "Move the call into a `useEffect` / `useLayoutEffect` / `useImperativeHandle` callback, an inline event handler (`<view bindtap={() => ...} />`), a ref callback, or a function carrying a `'background only'` prologue directive. Component render bodies and helpers reachable from render run on the main thread, where `lynx.getJSModule(...)` and `NativeModules.*` are unavailable.",
  create: (context) => {
    const handlerNames = new Set<string>();
    const violations: Array<{ node: EsTreeNode; apiName: string }> = [];

    return {
      JSXAttribute(node: EsTreeNodeOfType<"JSXAttribute">) {
        if (node.name.type !== "JSXIdentifier") return;
        if (!isBackgroundEventAttributeName(node.name.name)) return;
        const value = node.value;
        if (!value || value.type !== "JSXExpressionContainer") return;
        const expression = value.expression;
        if (expression?.type === "Identifier" && typeof expression.name === "string") {
          handlerNames.add(expression.name);
        }
      },
      MemberExpression(node: EsTreeNodeOfType<"MemberExpression">) {
        if (!isNativeModulesRoot(node)) return;
        if (findVariableInitializer(node, "NativeModules")) return;
        violations.push({ node, apiName: "NativeModules" });
      },
      CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
        if (!isLynxGetJSModuleCall(node)) return;
        if (findVariableInitializer(node, "lynx")) return;
        violations.push({ node, apiName: "lynx.getJSModule" });
      },
      "Program:exit"() {
        for (const violation of violations) {
          if (isInsideBackgroundOnlyDirective(violation.node)) continue;
          if (isInsideEffectCallback(violation.node)) continue;
          if (isInsideInlineBackgroundHandler(violation.node)) continue;
          const enclosingName = getEnclosingFunctionName(violation.node);
          if (enclosingName !== null && handlerNames.has(enclosingName)) continue;
          context.report({
            node: violation.node,
            message: `${MESSAGE_PREFIX}${violation.apiName}${MESSAGE_SUFFIX}`,
          });
        }
      },
    };
  },
});
