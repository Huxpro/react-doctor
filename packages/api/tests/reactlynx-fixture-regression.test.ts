import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { diagnose } from "../src/index.js";

// End-to-end regression for ReactLynx support. Runs `diagnose()` against
// `packages/core/tests/fixtures/reactlynx-app/` — a representative Lynx
// project with `@lynx-js/react` + `@lynx-js/rspeedy` +
// `@lynx-js/react-rsbuild-plugin`, a `lynx.config.ts` invoking
// `pluginReactLynx()`, and a `src/app.tsx` using `<view>` / `<text>` /
// `bindtap`.
//
// This pins the no-false-positive contract for Lynx codebases: any new
// rule that fires here without `disabledBy: ["reactlynx"]` will break
// the test, forcing the author to either fix the rule or add it to the
// M2 audit. Caught the `react-builtins/no-unknown-property` gap during
// PRD implementation; this test would have caught it earlier.

const REACTLYNX_FIXTURE = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "core",
  "tests",
  "fixtures",
  "reactlynx-app",
);

describe("diagnose — reactlynx-app fixture", () => {
  it("classifies the project as ReactLynx with the workspace flag set", async () => {
    const result = await diagnose(REACTLYNX_FIXTURE, { lint: true, deadCode: false });
    expect(result.project.framework).toBe("reactlynx");
    expect(result.project.hasReactLynxWorkspace).toBe(true);
    expect(result.project.hasReactNativeWorkspace).toBe(false);
    expect(result.project.expoVersion).toBeNull();
  });

  it("does NOT emit any React Native or Expo diagnostics", async () => {
    const result = await diagnose(REACTLYNX_FIXTURE, { lint: true, deadCode: false });
    const rnRuleIds = result.diagnostics.filter(
      (diagnostic) =>
        diagnostic.rule.startsWith("rn-") || diagnostic.rule.startsWith("expo-"),
    );
    expect(rnRuleIds).toEqual([]);
  });

  it("does NOT flag Lynx host-element event props (`bindtap`) as unknown DOM properties", async () => {
    // Regression for the M2 audit gap caught by end-to-end fixture verification:
    // `react-builtins/no-unknown-property` was missing `disabledBy: ["reactlynx"]`
    // and flagged `<text bindtap={...}>` as "React ignores this prop."
    const result = await diagnose(REACTLYNX_FIXTURE, { lint: true, deadCode: false });
    const unknownPropertyDiagnostics = result.diagnostics.filter(
      (diagnostic) => diagnostic.rule === "no-unknown-property",
    );
    expect(unknownPropertyDiagnostics).toEqual([]);
  });

  it("does NOT emit any a11y diagnostics on Lynx code", async () => {
    // Per M2 audit, every a11y/* rule carries `disabledBy: ["reactlynx"]`.
    // Lynx host elements don't carry HTML/ARIA semantics, so a11y rules
    // should never fire on Lynx code.
    const result = await diagnose(REACTLYNX_FIXTURE, { lint: true, deadCode: false });
    const a11yDiagnostics = result.diagnostics.filter((diagnostic) =>
      diagnostic.category === "Accessibility",
    );
    expect(a11yDiagnostics).toEqual([]);
  });

  it("emits no engine-versions or migration-debt diagnostics on a clean RL3 install", async () => {
    const result = await diagnose(REACTLYNX_FIXTURE, { lint: true, deadCode: false });
    const projectLevelDiagnostics = result.diagnostics.filter(
      (diagnostic) =>
        diagnostic.rule === "rl-engine-versions-mismatch" ||
        diagnostic.rule === "rl-no-reactlynx-2-residue",
    );
    expect(projectLevelDiagnostics).toEqual([]);
  });

  it("does NOT flag background-only APIs on a clean fixture without `lynx.getJSModule`/`NativeModules`", async () => {
    // Wiring contract for `rl-no-background-only-api-in-render`: the
    // rule (ported from the `reactlynx-best-practices` skill's
    // `detect-background-only`) must reach the fixture through the
    // plugin pipeline AND must not false-positive on a Lynx project
    // that never reaches for those APIs. Positive/negative AST
    // semantics are unit-tested separately.
    const result = await diagnose(REACTLYNX_FIXTURE, { lint: true, deadCode: false });
    const backgroundOnlyDiagnostics = result.diagnostics.filter(
      (diagnostic) => diagnostic.rule === "rl-no-background-only-api-in-render",
    );
    expect(backgroundOnlyDiagnostics).toEqual([]);
  });
});
