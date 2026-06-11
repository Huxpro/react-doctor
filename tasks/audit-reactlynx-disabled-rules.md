# Audit — rules to disable on ReactLynx

Per US-2.1, audit the 46 rules tagged `react-jsx-only` and any other rule baking in `react-dom`-only assumptions. Each row is categorised as:

- **(a)** stays on — React semantics, fires correctly under Lynx
- **(b)** disable on Lynx — add `disabledBy: ["reactlynx"]`
- **(c)** needs separate Lynx variant — note for a later milestone, don't change yet

Conservative rule of thumb used: an a11y rule that checks HTML element semantics, ARIA attributes, or DOM event-handler names is (b) because Lynx host elements (`<view>`, `<text>`, `<scroll-view>`, …) don't carry HTML/ARIA semantics. React-semantic concerns (referential equality, render-per-prop, hooks usage, component composition, file size) stay on as (a) because the React render model is identical under Lynx.

## (b) — Disable on ReactLynx (36 rules, all `a11y/*`)

Every rule in the `a11y/` bucket checks HTML / ARIA attributes or DOM-specific event semantics that don't exist for Lynx host elements. False-positive surface on Lynx codebases is high; an empty diagnostic stream is more useful than a noisy one until a Lynx-native a11y rule set is designed (deferred to a follow-up PRD).

- `a11y/alt-text` — `<img alt>` (DOM-only)
- `a11y/anchor-ambiguous-text` — `<a>` link text (DOM-only)
- `a11y/anchor-has-content` — `<a>` accessible label (DOM-only)
- `a11y/anchor-is-valid` — `<a href>` shape (DOM-only)
- `a11y/aria-activedescendant-has-tabindex` — ARIA + tabindex (DOM-only)
- `a11y/aria-props` — ARIA attribute names (DOM-only)
- `a11y/aria-proptypes` — ARIA value types (DOM-only)
- `a11y/aria-role` — ARIA `role=` (DOM-only)
- `a11y/aria-unsupported-elements` — ARIA on bad tags (DOM-only)
- `a11y/autocomplete-valid` — `<input autocomplete>` (DOM-only)
- `a11y/click-events-have-key-events` — `onClick` / `onKeyDown` pairing (DOM event names — Lynx uses `bindtap`)
- `a11y/control-has-associated-label` — HTML form-control labelling (DOM-only)
- `a11y/heading-has-content` — `<h1>`–`<h6>` (DOM-only)
- `a11y/html-has-lang` — `<html lang>` (DOM-only)
- `a11y/iframe-has-title` — `<iframe>` (DOM-only)
- `a11y/img-redundant-alt` — `<img alt>` (DOM-only)
- `a11y/interactive-supports-focus` — DOM tabindex / focus semantics
- `a11y/label-has-associated-control` — `<label for>` (DOM-only)
- `a11y/lang` — `lang` attribute shape (DOM-only)
- `a11y/media-has-caption` — `<video>` / `<audio>` (DOM-only)
- `a11y/mouse-events-have-key-events` — `onMouseOver` / `onFocus` pairing (DOM-only)
- `a11y/no-access-key` — `accesskey` (DOM-only)
- `a11y/no-aria-hidden-on-focusable` — ARIA + focus (DOM-only)
- `a11y/no-autofocus` — `autoFocus` on form controls (DOM-only)
- `a11y/no-distracting-elements` — `<marquee>` / `<blink>` (DOM-only)
- `a11y/no-interactive-element-to-noninteractive-role` — HTML element + ARIA role (DOM-only)
- `a11y/no-noninteractive-element-interactions` — DOM event listeners on HTML elements
- `a11y/no-noninteractive-element-to-interactive-role` — HTML element + ARIA role (DOM-only)
- `a11y/no-noninteractive-tabindex` — `tabindex` (DOM-only)
- `a11y/no-redundant-roles` — implicit HTML element role vs explicit ARIA role (DOM-only)
- `a11y/no-static-element-interactions` — `onClick` on `<div>` / `<span>` (DOM-only)
- `a11y/prefer-tag-over-role` — HTML element vs ARIA role (DOM-only)
- `a11y/role-has-required-aria-props` — ARIA role requirements (DOM-only)
- `a11y/role-supports-aria-props` — ARIA role → allowed attributes (DOM-only)
- `a11y/scope` — `<th scope>` (DOM-only)
- `a11y/tabindex-no-positive` — `tabindex` (DOM-only)

## (a) — Stays on (10 rules)

Every one of these checks a JavaScript / React-semantic concern that is true regardless of host-element flavour. No edit needed.

- `architecture/no-giant-component` — file-LoC threshold; framework-agnostic.
- `architecture/no-many-boolean-props` — component-API shape; framework-agnostic.
- `architecture/no-nested-component-definition` — React render-model concern (new component identity per render); applies under Lynx.
- `design/no-inline-exhaustive-style` — inline-style allocation perf concern; the WHY (new object per render → child re-renders) holds for Lynx, even though the style spec differs.
- `performance/prefer-stable-empty-fallback` — referential equality of fallback values; applies under Lynx.
- `react-builtins/jsx-no-constructed-context-values` — context value identity per render; applies under Lynx.
- `react-builtins/jsx-no-jsx-as-prop` — new JSX subtree per render; applies under Lynx (same render model).
- `react-builtins/jsx-no-new-array-as-prop` — array identity per render; applies under Lynx.
- `react-builtins/jsx-no-new-function-as-prop` — function identity per render; applies under Lynx.
- `react-builtins/jsx-no-new-object-as-prop` — object identity per render; applies under Lynx.

## (c) — Needs separate Lynx variant (deferred)

None at the time of this audit. A future audit can revisit individual a11y rules if Lynx grows an accessibility-attribute story (currently Lynx host elements don't expose ARIA-style metadata, so re-implementing the rules for Lynx is premature).

## Other surfaces audited (no change)

The PRD called out a few non-`react-jsx-only` rules as sanity-check candidates. Their status:

- `view-transitions/no-flush-sync` — already gates on `import { flushSync } from "react-dom"`; under Lynx the import would just not match and the rule is a no-op. No `disabledBy` needed, but adding `disabledBy: ["reactlynx"]` is a cleanliness win (rules that can never fire on a target should be filtered out). **Defer** — not blocking, low value.
- `client/*` — `client-localstorage-no-version` (and siblings) check browser-storage APIs. ReactLynx code that uses `localStorage` is already caught by `rl-no-dom-globals` (M1 US-1.1). Redundant `disabledBy` adds noise. **No change.**
