import { LYNX_BUILT_IN_ELEMENT_NAMES } from "../../constants/reactlynx.js";
import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import type { Rule } from "../../utils/rule.js";

// `onClick` on a Lynx built-in host element (`<view>`, `<text>`, …) is
// a silent no-op — the runtime only dispatches `bindtap` / `catchtap` /
// other `bind*` / `catch*` events on host elements, so the handler
// never fires. Worse failure mode than a crash: the user thinks their
// button works.
//
// Capitalized JSX tags are user components and may legitimately accept
// `onClick` as a custom prop (forwarding it to a child, ignoring it,
// etc.), so they're left alone. Web-DOM lowercase tags (`<div>`,
// `<button>`, etc.) aren't in the Lynx host-element set, so they pass
// too — the file-level package boundary (M3) is what stops this rule
// from running in web packages of a mixed monorepo in the first place.
export const rlNoOnclickOnBuiltin = defineRule<Rule>({
  id: "rl-no-onclick-on-builtin",
  title: "`onClick` on Lynx host element is a no-op",
  severity: "error",
  requires: ["reactlynx"],
  recommendation:
    "Replace `onClick` with `bindtap` on the Lynx host element. Use `catchtap` instead when you need to stop the tap from bubbling to an ancestor handler (e.g. an enclosing `<scroll-view>` or long-press parent).",
  create: (context) => ({
    JSXOpeningElement(node: EsTreeNodeOfType<"JSXOpeningElement">) {
      const tagName = node.name;
      // Only flag plain lowercase host tags. JSXMemberExpression
      // (`<foo.bar>`) and JSXNamespacedName (`<svg:rect>`) are not
      // Lynx built-ins and are skipped by virtue of failing the
      // JSXIdentifier shape check.
      if (!isNodeOfType(tagName, "JSXIdentifier")) return;
      if (!LYNX_BUILT_IN_ELEMENT_NAMES.has(tagName.name)) return;

      for (const attribute of node.attributes) {
        if (!isNodeOfType(attribute, "JSXAttribute")) continue;
        const attributeName = attribute.name;
        if (!isNodeOfType(attributeName, "JSXIdentifier")) continue;
        if (attributeName.name !== "onClick") continue;

        context.report({
          node: attribute,
          message: `\`onClick\` on <${tagName.name}> is a silent no-op in ReactLynx — the runtime only fires \`bind*\` / \`catch*\` handlers on host elements. Use \`bindtap\` (or \`catchtap\` if you need to stop propagation).`,
        });
      }
    },
  }),
});
