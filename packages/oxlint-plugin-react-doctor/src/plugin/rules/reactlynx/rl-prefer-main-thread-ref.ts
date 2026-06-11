import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import { isMainThreadFunction } from "../../utils/reactlynx.js";
import type { Rule } from "../../utils/rule.js";

// Walks `node`'s ancestors looking for two markers:
//   - the nearest function that is `'main thread'`-tagged
//   - a `runOnBackground(...)` CallExpression that lexically encloses
//     the useRef call (i.e. the useRef is inside the runOnBackground's
//     callback argument)
//
// Returns true iff we hit the main-thread function ANCESTOR before
// hitting (or without ever hitting) a `runOnBackground(...)` wrapper.
// `runOnBackground(() => useRef(...))` is the supported escape hatch
// for actually running useRef on the background thread — that call
// shouldn't fire the rule.
const isInsideUnwrappedMainThreadFunction = (node: EsTreeNode): boolean => {
  let ancestor: EsTreeNode | null | undefined = node.parent;
  while (ancestor) {
    if (
      ancestor.type === "CallExpression" &&
      "callee" in ancestor &&
      (ancestor as { callee?: { type?: string; name?: string } }).callee?.type === "Identifier" &&
      (ancestor as { callee?: { type?: string; name?: string } }).callee?.name === "runOnBackground"
    ) {
      return false;
    }
    if (
      ancestor.type === "FunctionDeclaration" ||
      ancestor.type === "FunctionExpression" ||
      ancestor.type === "ArrowFunctionExpression"
    ) {
      if (isMainThreadFunction(ancestor)) return true;
    }
    ancestor = ancestor.parent ?? null;
  }
  return false;
};

const MESSAGE =
  "`useRef` inside a `'main thread'` function reads from the background thread, so the ref returned never reflects the main-thread DOM state you wrote it for. Use `useMainThreadRef` (from `@lynx-js/react`) instead, or wrap the `useRef` call in `runOnBackground(() => useRef(...))` if you genuinely need a background-thread ref.";

export const rlPreferMainThreadRef = defineRule<Rule>({
  id: "rl-prefer-main-thread-ref",
  title: "Use `useMainThreadRef` instead of `useRef` in main-thread code",
  severity: "error",
  requires: ["reactlynx"],
  recommendation:
    "Switch the `useRef` call to `useMainThreadRef` imported from `@lynx-js/react`. The returned `MainThreadRef` exposes the same `.current` API but is initialised and read on the main thread, matching the lifetime of the `'main thread'`-tagged function that owns it. If you actually need a background-thread ref inside a main-thread closure, wrap the call: `runOnBackground(() => useRef(...))`.",
  create: (context) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      if (node.callee.type !== "Identifier" || node.callee.name !== "useRef") return;
      if (!isInsideUnwrappedMainThreadFunction(node)) return;
      context.report({ node, message: MESSAGE });
    },
  }),
});
