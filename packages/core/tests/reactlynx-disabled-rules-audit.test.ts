import { describe, expect, it } from "vite-plus/test";
import reactDoctorPlugin, { REACT_DOCTOR_RULES } from "oxlint-plugin-react-doctor";
import { shouldEnableRule } from "@react-doctor/core";

// Per US-2.1 (M2): every `a11y/*` rule must carry `disabledBy: ["reactlynx"]`
// so a ReactLynx project doesn't get a flood of HTML/ARIA false-positives.
// The audit lives in `tasks/audit-reactlynx-disabled-rules.md`; this test
// is the executable enforcement so future rule additions to `a11y/` don't
// silently drop the marker.

const REACTLYNX_CAPABILITIES = new Set(["reactlynx"]);
const NO_IGNORED_TAGS = new Set<string>();

describe("M2 — disabledBy ['reactlynx'] audit", () => {
  it("every a11y/* rule declares disabledBy: ['reactlynx']", () => {
    const offenders: string[] = [];
    for (const registryEntry of REACT_DOCTOR_RULES) {
      const rule = reactDoctorPlugin.rules[registryEntry.id];
      if (!rule) continue;
      if (!registryEntry.key.startsWith("react-doctor/")) continue;
      const ruleId = registryEntry.id;
      // Audit list filters by id-prefix; the codegen sets `framework` from
      // the bucket dir, but `a11y/` collapses into the global bucket so we
      // can't filter on `framework`. Use the diagnostic-id shape instead —
      // every a11y rule's `id` matches the patterns in
      // `audit-reactlynx-disabled-rules.md`.
      const isA11yRule =
        ruleId === "alt-text" ||
        ruleId.startsWith("anchor-") ||
        ruleId.startsWith("aria-") ||
        ruleId.startsWith("autocomplete-") ||
        ruleId === "click-events-have-key-events" ||
        ruleId === "control-has-associated-label" ||
        ruleId === "heading-has-content" ||
        ruleId === "html-has-lang" ||
        ruleId === "iframe-has-title" ||
        ruleId === "img-redundant-alt" ||
        ruleId === "interactive-supports-focus" ||
        ruleId === "label-has-associated-control" ||
        ruleId === "lang" ||
        ruleId === "media-has-caption" ||
        ruleId === "mouse-events-have-key-events" ||
        ruleId.startsWith("no-access-key") ||
        ruleId.startsWith("no-aria-") ||
        ruleId === "no-autofocus" ||
        ruleId === "no-distracting-elements" ||
        ruleId.startsWith("no-interactive-") ||
        ruleId.startsWith("no-noninteractive-") ||
        ruleId === "no-redundant-roles" ||
        ruleId === "no-static-element-interactions" ||
        ruleId === "prefer-tag-over-role" ||
        ruleId === "role-has-required-aria-props" ||
        ruleId === "role-supports-aria-props" ||
        ruleId === "scope" ||
        ruleId === "tabindex-no-positive";
      if (!isA11yRule) continue;
      const disabledBy = rule.disabledBy ?? [];
      if (!disabledBy.includes("reactlynx")) {
        offenders.push(ruleId);
      }
    }
    expect(
      offenders,
      `These a11y rules are missing disabledBy: ["reactlynx"] — see tasks/audit-reactlynx-disabled-rules.md`,
    ).toEqual([]);
  });

  it("shouldEnableRule returns false for a rule with disabledBy ['reactlynx'] when capabilities has reactlynx", () => {
    expect(
      shouldEnableRule(
        undefined,
        ["react-jsx-only"],
        REACTLYNX_CAPABILITIES,
        NO_IGNORED_TAGS,
        ["reactlynx"],
      ),
    ).toBe(false);
  });

  it("shouldEnableRule returns true for the same rule when capabilities does NOT include reactlynx", () => {
    const reactOnlyCapabilities = new Set(["vite", "react:18"]);
    expect(
      shouldEnableRule(
        undefined,
        ["react-jsx-only"],
        reactOnlyCapabilities,
        NO_IGNORED_TAGS,
        ["reactlynx"],
      ),
    ).toBe(true);
  });
});
