import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import { findVariableInitializer } from "../../utils/find-variable-initializer.js";
import type { Rule } from "../../utils/rule.js";

// Web globals that don't exist in the ReactLynx runtime. Reading them
// throws a `ReferenceError` once the project actually runs on a Lynx
// engine, but compiles cleanly under TypeScript's web-DOM lib types,
// so the bug is invisible until ship-time.
const TARGET_GLOBALS = new Set([
  "window",
  "document",
  "localStorage",
  "sessionStorage",
  "navigator",
]);

const MESSAGES: Record<string, string> = {
  window:
    "`window` is not available in the ReactLynx runtime. Use a Lynx API or read environment via `lynx.getSystemInfo()`.",
  document:
    "`document` is not available in the ReactLynx runtime. Use ReactLynx host elements and refs instead of DOM queries.",
  localStorage:
    "`localStorage` is not available in the ReactLynx runtime. Use `lynx.getStorage` / `lynx.setStorage`.",
  sessionStorage:
    "`sessionStorage` is not available in the ReactLynx runtime. Use `lynx.getStorage` / `lynx.setStorage`.",
  navigator:
    "`navigator` is not available in the ReactLynx runtime. Use `lynx.getSystemInfo()` for environment / device info.",
};

export const rlNoDomGlobals = defineRule<Rule>({
  id: "rl-no-dom-globals",
  title: "Web globals unavailable in ReactLynx",
  severity: "error",
  requires: ["reactlynx"],
  recommendation:
    "ReactLynx runs on a non-DOM runtime, so `window`, `document`, `localStorage`, `sessionStorage`, and `navigator` throw `ReferenceError` at runtime. Replace them with the equivalent `lynx.*` APIs (e.g. `lynx.getSystemInfo()` for environment info, `lynx.getStorage` / `lynx.setStorage` for persistent storage).",
  create: (context) => ({
    Identifier(node: EsTreeNodeOfType<"Identifier">) {
      if (!TARGET_GLOBALS.has(node.name)) return;

      const parent = node.parent;

      // `obj.window` — `window` is the property, not the global. Computed
      // (`obj[window]`) puts `window` back on the value side, so only
      // skip the non-computed property case.
      if (
        parent?.type === "MemberExpression" &&
        parent.property === node &&
        parent.computed === false
      ) {
        return;
      }

      // `{ window: 1 }` — `window` is a non-shorthand object key, not a
      // value reference. Shorthand `{ window }` is a real read of the
      // local `window` (or, if no local, the global) and falls through.
      // Computed keys put the identifier back on the value side, so
      // only skip the non-computed non-shorthand case.
      if (
        parent?.type === "Property" &&
        parent.key === node &&
        parent.computed === false &&
        parent.shorthand === false
      ) {
        return;
      }

      // Skip binding positions — declaring a local with one of these
      // names is the user's prerogative; the binding is what we WANT to
      // recognise so a later reference doesn't false-positive.
      if (parent?.type === "VariableDeclarator" && parent.id === node) return;
      if (parent?.type === "ImportSpecifier" && parent.local === node) return;
      if (parent?.type === "ImportDefaultSpecifier" && parent.local === node) return;
      if (parent?.type === "ImportNamespaceSpecifier" && parent.local === node) return;
      if (parent?.type === "FunctionDeclaration" && parent.id === node) return;
      if (parent?.type === "FunctionExpression" && parent.id === node) return;
      if (parent?.type === "ClassDeclaration" && parent.id === node) return;
      if (parent?.type === "ClassExpression" && parent.id === node) return;

      // `typeof window === 'undefined'` — runtime-environment guard
      // idiom that's the CORRECT thing to do, not a bug.
      if (parent?.type === "UnaryExpression" && parent.operator === "typeof") return;

      // Shadowed by a local binding (var / let / const / param /
      // destructure / import). `findVariableInitializer` walks the
      // scope chain, so a binding anywhere from this site up to the
      // module root takes precedence over the global.
      if (findVariableInitializer(node, node.name)) return;

      context.report({ node, message: MESSAGES[node.name] });
    },
  }),
});
