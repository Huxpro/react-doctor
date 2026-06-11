// Canonical list of the three ReactLynx engine packages that ship in
// lockstep — `@lynx-js/react` (runtime), `@lynx-js/rspeedy` (build CLI),
// and `@lynx-js/react-rsbuild-plugin` (build plugin). Adding a future
// engine package (e.g. a hypothetical `@lynx-js/web-platform`) is a
// one-line change here and a wire-up in `check-engine-versions`.
//
// Kept local to `@react-doctor/core` (parallel to
// `internal-rn-dependency-names.ts`) so importing discovery helpers
// doesn't pull oxlint-plugin types or its constants into the bundle.
export const REACTLYNX_ENGINE_PACKAGES: ReadonlyArray<string> = [
  "@lynx-js/react",
  "@lynx-js/rspeedy",
  "@lynx-js/react-rsbuild-plugin",
];
