// Lynx built-in element tag names (lowercase, JSX host-element shape).
// Confirmed against https://lynxjs.org/api/elements/built-in/ at PRD-write
// time. Re-verify before each Lynx-major bump; the list changes rarely.
//
// Used by `rl-*` rules that key off "this JSX element is a Lynx host
// element, not a user component" — e.g. `rl-no-onclick-on-builtin`
// distinguishes `<view onClick>` (silent no-op, flag) from
// `<Button onClick>` (user component, may handle the prop in user code).
export const LYNX_BUILT_IN_ELEMENT_NAMES: ReadonlySet<string> = new Set([
  "view",
  "text",
  "image",
  "scroll-view",
  "list",
  "list-item",
  "page",
  "frame",
  "input",
  "textarea",
  "overlay",
  "svg",
  "refresh",
  "title-bar-view",
]);
