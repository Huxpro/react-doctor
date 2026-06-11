import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import { isMainThreadFunction } from "../../utils/reactlynx.js";
import type { Rule } from "../../utils/rule.js";

// Walks ancestors of `node` looking for the nearest function. Returns
// `true` iff that ancestor is a main-thread function AND we never crossed
// a `runOnBackground(...)` call expression along the way (which would
// move the inner code back onto the background thread).
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

// Recognises the `const [x, setX] = useState(...) | useReducer(...)`
// shape and returns the setter binding name if present, or null.
// Scoped to the second array-pattern element because that's where
// React puts the setter; ignores anything else.
const extractSetterName = (node: EsTreeNodeOfType<"VariableDeclarator">): string | null => {
  const init = node.init;
  if (!init || init.type !== "CallExpression") return null;
  if (init.callee.type !== "Identifier") return null;
  if (init.callee.name !== "useState" && init.callee.name !== "useReducer") return null;
  const id = node.id;
  if (id.type !== "ArrayPattern") return null;
  const setter = id.elements?.[1];
  if (!setter || setter.type !== "Identifier") return null;
  return setter.name;
};

const MESSAGE_PREFIX = "Main-thread closure over a background-thread state setter: `";
const MESSAGE_SUFFIX =
  "` was produced by `useState` / `useReducer`, which schedules updates on the background thread. Calling the setter from a `'main thread'`-tagged function is a silent no-op at runtime — the call returns but the state never updates. Wrap the call in `runOnBackground(() => setter(...))` to hop back to the background thread before triggering React's render cycle.";

// V1 setter-call detector. Collects every binding produced by
// `useState` / `useReducer` (tracked by name in a per-file Set so a
// `runOnBackground` wrapper at any depth can carry through), then flags
// every CallExpression `<setter>(...)` that lexically sits inside a
// `'main thread'` function without a `runOnBackground` interceptor.
//
// Known limitation: the Set is file-scoped (not lexical scope-tracked),
// so two unrelated `setCount` bindings in the same file would conflate.
// Real codebases rarely shadow setter names; if false positives appear
// in practice we'll tighten to scope-aware tracking.
export const rlMainThreadDirective = defineRule<Rule>({
  id: "rl-main-thread-directive",
  title: "Background-thread state setter called from a `'main thread'` closure",
  severity: "error",
  requires: ["reactlynx"],
  recommendation:
    "Wrap the setter call in `runOnBackground(() => setX(...))` so the React state update runs on the background thread that owns it. If the call is genuinely happening on the wrong thread by design, restructure so the main-thread function calls a background-thread callback instead of holding a direct setter reference.",
  create: (context) => {
    const setterNames = new Set<string>();
    return {
      VariableDeclarator(node: EsTreeNodeOfType<"VariableDeclarator">) {
        const setterName = extractSetterName(node);
        if (setterName !== null) setterNames.add(setterName);
      },
      CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
        if (node.callee.type !== "Identifier") return;
        if (!setterNames.has(node.callee.name)) return;
        if (!isInsideUnwrappedMainThreadFunction(node)) return;
        context.report({
          node,
          message: `${MESSAGE_PREFIX}${node.callee.name}${MESSAGE_SUFFIX}`,
        });
      },
    };
  },
});
