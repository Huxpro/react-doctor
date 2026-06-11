import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import { findVariableInitializer } from "../../utils/find-variable-initializer.js";
import { isMainThreadFunction } from "../../utils/reactlynx.js";
import type { Rule } from "../../utils/rule.js";

// Walks ancestors of `node` looking for the nearest function ancestor.
// Returns it when that ancestor is a `'main thread'` function; null
// otherwise. Used to scope `await` / `new Promise(...)` detection to
// lexically-inside-main-thread positions, no matter how deeply nested.
const findEnclosingMainThreadFunction = (node: EsTreeNode): EsTreeNode | null => {
  let ancestor: EsTreeNode | null | undefined = node.parent;
  while (ancestor) {
    if (
      ancestor.type === "FunctionDeclaration" ||
      ancestor.type === "FunctionExpression" ||
      ancestor.type === "ArrowFunctionExpression"
    ) {
      if (isMainThreadFunction(ancestor)) return ancestor;
    }
    ancestor = ancestor.parent ?? null;
  }
  return null;
};

const MESSAGE_ASYNC_MODIFIER =
  "Main-thread functions cannot be `async`. The `'main thread'` directive runs the body on the main thread, which has no microtask scheduler; the returned Promise is dropped on the floor.";
const MESSAGE_AWAIT =
  "`await` is not available inside a `'main thread'` function — there's no microtask scheduler on the main thread. Move the awaiting code to a background-thread callback (e.g. via `runOnBackground`).";
const MESSAGE_NEW_PROMISE =
  "`new Promise(…)` allocates a microtask-scheduled object that the main thread can't drive. Move Promise construction to a background-thread callback.";

// `async` / `await` / `new Promise(...)` inside a `'main thread'`-tagged
// function are runtime no-ops at best, silent drops at worst — the
// directive moves the body onto the main thread, which has no
// microtask scheduler. Flag each violation separately rather than
// collapsing them into one diagnostic so the user sees every line that
// needs to move.
export const rlNoAsyncInMainThread = defineRule<Rule>({
  id: "rl-no-async-in-main-thread",
  title: "No async work in `'main thread'` functions",
  severity: "error",
  requires: ["reactlynx"],
  recommendation:
    "The `'main thread'` directive opts a function into ReactLynx's main-thread runtime, which has no microtask scheduler. Remove the `async` modifier, the `await` expression, or the `new Promise(...)` call — and if you genuinely need async work, drop the directive (so the function runs on the background thread) or call `runOnBackground(() => { /* async stuff */ })` from the main-thread body.",
  create: (context) => ({
    FunctionDeclaration(node: EsTreeNodeOfType<"FunctionDeclaration">) {
      if (isMainThreadFunction(node) && node.async) {
        context.report({ node, message: MESSAGE_ASYNC_MODIFIER });
      }
    },
    FunctionExpression(node: EsTreeNodeOfType<"FunctionExpression">) {
      if (isMainThreadFunction(node) && node.async) {
        context.report({ node, message: MESSAGE_ASYNC_MODIFIER });
      }
    },
    ArrowFunctionExpression(node: EsTreeNodeOfType<"ArrowFunctionExpression">) {
      if (isMainThreadFunction(node) && node.async) {
        context.report({ node, message: MESSAGE_ASYNC_MODIFIER });
      }
    },
    AwaitExpression(node: EsTreeNodeOfType<"AwaitExpression">) {
      if (findEnclosingMainThreadFunction(node) !== null) {
        context.report({ node, message: MESSAGE_AWAIT });
      }
    },
    NewExpression(node: EsTreeNodeOfType<"NewExpression">) {
      const callee = node.callee;
      if (callee.type !== "Identifier" || callee.name !== "Promise") return;
      // Shadowed `Promise` binding (local import / declaration) → not the
      // global Promise constructor we care about.
      if (findVariableInitializer(node, "Promise")) return;
      if (findEnclosingMainThreadFunction(node) === null) return;
      context.report({ node, message: MESSAGE_NEW_PROMISE });
    },
  }),
});
