# PRD: ReactLynx-aware checks for react-doctor

## Introduction

React Doctor already covers React (web), React Native, and Expo with dedicated project-level checks, lint rules, and capability gates. With M0 shipped, ReactLynx is now a detected framework but receives **no** ReactLynx-specific checks — it inherits the generic React rule set, which both misses Lynx-specific bugs and occasionally false-positives on web-DOM assumptions that don't hold in Lynx.

This PRD scopes the next layers of work to bring ReactLynx coverage to parity with React Native: project-level checks, a new `rl-*` rule bucket, capability-gating refinements, file-level package classification for mixed monorepos, and a JSX-dialect audit. Work is grouped into milestones M1–M5 by ROI.

**Audience:** react-doctor maintainers and contributors implementing the rules. Assumes familiarity with `AGENTS.md` (Effect v4, kebab-case files, interfaces over types, `truffler` for symbol search) and the existing `react-native` / `expo` check + rule patterns under `packages/core/src/checks/{react-native,expo}/` and `packages/oxlint-plugin-react-doctor/src/plugin/rules/react-native/`.

### What ReactLynx is, in one paragraph

ReactLynx = **React semantics** (hooks, render model, JSX) + **custom lowercase host elements** (`<view>`, `<text>`, `<list>`, …) + a **dual-thread runtime** (main thread / background thread) + **custom events** (`bindtap` / `catchtap`, not `onClick`) + a **Lynx CSS subset** + the **Rspeedy** (Rsbuild-based) build toolchain. The runtime ships in `@lynx-js/react`; the build tools ship in `@lynx-js/rspeedy` + `@lynx-js/react-rsbuild-plugin`.

---

## M0 — Done (reference)

Already shipped on the `Huxpro/react-doctor` fork, branch `reactlynx-support` (see References for the current commit + how to refresh):

- `reactlynx` added to the `Framework` union (`packages/core/src/types/project-info.ts`).
- `@lynx-js/react` added to `FRAMEWORK_PACKAGES` and `reactlynx → "ReactLynx"` to display names (`packages/core/src/project-info/detect-framework.ts`).
- `@lynx-js/react` added to `REACT_DEPENDENCY_NAMES` so workspace discovery picks up Lynx sub-projects (`packages/core/src/project-info/has-react-dependency.ts`).
- `buildCapabilities` automatically emits the `reactlynx` capability via the existing `capabilities.add(project.framework)` line — **no code change in `runners/oxlint/capabilities.ts` itself**. Rules can now declare `requires: ["reactlynx"]`.
- `checkReactNativeProject` already returns `[]` for ReactLynx projects with no RN/Expo deps — no Lynx-specific gating was needed.
- Minimal fixture under `packages/core/tests/fixtures/reactlynx-app/`; tests in `discover-project.test.ts`, `build-capabilities.test.ts`, `check-react-native-project.test.ts`; README + changeset updated.

M0 is the foundation every later milestone relies on. Subsequent milestones do **not** revisit framework detection, **with one exception:** M0 did not add `hasReactLynxWorkspace` to `ProjectInfo`, which means a web-rooted monorepo with an `apps/lynx` workspace currently has `framework: "vite"` (or similar) and does not get the `reactlynx` capability. US-3.0 fixes this as a follow-up commit on the same branch. The single-package and Lynx-rooted-monorepo cases work correctly today.

### Implementation progress

- **US-1.0 (codegen / type wiring)** — **implemented locally on this branch, not yet committed.** `RuleFramework` union extended with `"reactlynx"`; four maps updated in `generate-rule-registry.mjs` (`BUCKET_TO_FRAMEWORK`, `BUCKET_TO_AUTO_TAGS`, `BUCKET_TO_DEFAULT_CATEGORY`, `CATEGORY_BUCKET`); `packages/oxlint-plugin-react-doctor/src/plugin/rules/reactlynx/` directory created. Verified via `pnpm -F oxlint-plugin-react-doctor gen` and `pnpm typecheck` (8/8 tasks green).
- **US-1.1 (`rl-no-dom-globals`)** — **implemented locally on this branch, not yet committed.** New rule file `rl-no-dom-globals.ts` + companion `rl-no-dom-globals.test.ts` with 17 tests covering positive cases (each of `window` / `document` / `localStorage` / `sessionStorage` / `navigator` on read + write), shadowing (param / `const` / destructure / `import` / arrow param), property-side (`obj.window`), object-literal keys (`{ window: 1 }`), and `typeof`-guard idioms. Rule registered via codegen (328 → 329 rules). One bug found and fixed during test run: object-literal keys were initially flagged; now correctly skipped via a Property-key parent filter. All 17 tests pass; full plugin suite delta is +1 file / +17 passing tests / 0 new failures (the pre-existing 38 failures in `react-builtins/` carry over unchanged).
- **US-1.2 (`rl-no-onclick-on-builtin`)** — **implemented locally on this branch, not yet committed.** New constants file `plugin/constants/reactlynx.ts` (`LYNX_BUILT_IN_ELEMENT_NAMES`: the 14 confirmed built-in tags), new rule file `rl-no-onclick-on-builtin.ts`, and companion `rl-no-onclick-on-builtin.test.ts` with 14 tests covering positive cases (every common Lynx host tag + hyphenated tag like `<scroll-view>` + `<list-item>` + `onClick` alongside other attributes), correct events (`<view bindtap>`, `<view catchtap>`), user-component skip (`<Button>`, `<Foo.Bar>`), and web-DOM tag skip (`<div>`, `<span>`, `<button>`). Rule registered via codegen (329 → 330 rules). All 14 tests pass first try; full plugin suite delta is +1 file / +14 passing tests / 0 new failures.
- **US-1.3 (`check-engine-versions`)** — **implemented locally on this branch, not yet committed.** New `internal-reactlynx-package-names.ts` exports `REACTLYNX_ENGINE_PACKAGES` (the three @lynx-js engine names) as the centralised constant. New `checks/reactlynx/check-engine-versions.ts` implements v1 behaviour: emits a single `error` diagnostic (`rl-engine-versions-mismatch`, severity `error`, category `Correctness`) when at least one engine package is declared and any other is missing; emits nothing when all three are present or all three are absent. New `check-reactlynx-project.ts` orchestrator returns `[]` unless `project.framework === "reactlynx"`. Wired into `run-inspect.ts` alongside `checkReactNativeProject`, and re-exported from `packages/core/src/index.ts` so tests can import it. Companion `tests/check-reactlynx-project.test.ts` (8 tests) covers: non-Lynx-framework gate, missing manifest, complete install in `dependencies`, complete install in `devDependencies`, one missing, two missing, runtime-only missing, all absent. Full core suite delta: 575 → 583 passing tests (+8), 0 new failures.
- **M1 is functionally complete locally.** All four user stories (US-1.0, US-1.1, US-1.2, US-1.3) implemented and verified end-to-end. Cumulative delta to committed-on-branch state: 5 source files modified (3 plugin, 2 core), 6 new files (3 rules + tests, 1 constants, 1 check, 1 orchestrator, 1 internal package list), 1 test file in core. Net test delta: +39 passing tests (17 + 14 + 8). Pre-existing failures unchanged.
- **US-3.0 (`hasReactLynxWorkspace` M0 follow-up)** — **implemented locally on this branch, not yet committed.** New required field `hasReactLynxWorkspace: boolean` added to `ProjectInfo` with doc comment mirroring `hasReactNativeWorkspace`. New helpers: `project-info/utils/is-package-json-reactlynx-aware.ts` (predicate keyed on `@lynx-js/react` in any of 4 dep sections) and `project-info/has-reactlynx-workspace-anywhere.ts` (workspace walker, mirror of RN). `discover-project.ts` computes the flag as `framework === "reactlynx" || hasReactLynxWorkspaceAnywhere(directory, packageJson)`. `runners/oxlint/capabilities.ts` reads it via a new branch `if (project.hasReactLynxWorkspace) capabilities.add("reactlynx")` that runs alongside the unchanged bulk `capabilities.add(project.framework)`. 28 test files updated to include the new required field (mostly literal `false`; check-react-native-project + regressions/_helpers use computed `framework === "reactlynx"`). New tests added: 1 in `build-capabilities.test.ts` (workspace-on-vite gets `reactlynx` capability), 2 in `discover-project.test.ts` (workspace-on-vite gets `hasReactLynxWorkspace: true`, web-only monorepo gets false). Core suite delta: 583 → 586 tests (+3). `pnpm typecheck` 8/8 green, full core suite 60/60 files passing. Truffler verify shows one declaration site (type), one writer (`discover-project.ts`), one reader (`capabilities.ts`) — clean separation, no duplication.
- **US-3.1 (`classify-package-platform.ts` `reactlynx` class)** — **implemented locally on this branch, not yet committed.** `PackagePlatform` union extended from 4 → 5 variants: `"expo" | "reactlynx" | "react-native" | "web" | "unknown"`, with `reactlynx` slotting between `expo` and `react-native` per the precedence spec. Type-doc comment expanded to document the new variant in the existing prose style. New `isReactLynxAware` helper (plugin-local, parallel to the existing `isReactNativeAware`) checks all four dependency sections for `@lynx-js/react`; `classifyPackagePlatform` now consults it in precedence order `isExpoManaged > isReactLynxAware > isReactNativeAware > isWebFrameworkOnly > unknown`. Existing `isReactNativeFileActive` taught to return `false` when the package platform is `"reactlynx"` so RN rules stop firing in mixed monorepos' `apps/lynx` workspaces. New `is-reactlynx-file.ts` + `wrap-reactlynx-rule.ts` mirror the RN equivalents; `react-doctor-plugin.ts` extends the framework-wrapper chain to apply `wrapReactlynxRule` to every `framework: "reactlynx"` rule. Companion `classify-package-platform.test.ts` with 10 tests: 3 positive (deps/devDeps/peerDeps of `@lynx-js/react`), 2 precedence (Lynx+RN → reactlynx; Expo+Lynx → expo), 2 negative (build-tools-only does NOT classify as reactlynx), 3 regression (existing `web` / `react-native` / `expo` classifications still correct). Codegen unchanged (still 330 rules); full plugin suite delta: +1 file / +10 passing tests / 0 new failures.
- **M3 is functionally complete locally.** US-3.0 + US-3.1 done. Both M1 (4 stories) and M3 (2 stories) shipped end-to-end; M2 / M4 / M5 still pending.
- **US-2.1 (`disabledBy: ["reactlynx"]` audit)** — **implemented locally on this branch, not yet committed.** Wrote `tasks/audit-reactlynx-disabled-rules.md` enumerating all 46 `react-jsx-only`-tagged rules and categorising each: 36 a11y rules → (b) disable on Lynx (every one bakes in HTML/ARIA semantics absent from Lynx host elements); 10 non-a11y rules → (a) stays on (React-semantic concerns like referential equality, render-per-prop, hooks, file size, component composition all apply unchanged under Lynx); 0 → (c) needs separate Lynx variant (deferred to a future PRD once Lynx grows an a11y attribute story). Applied `disabledBy: ["reactlynx"]` to all 36 a11y rules via a `perl -pe` inserted between `tags:` and `severity:` — verified via spot-check that line shape is clean. Added `tests/reactlynx-disabled-rules-audit.test.ts` with 3 tests: (1) iterates `REACT_DOCTOR_RULES` + checks every a11y/* rule's `rule.disabledBy` includes `"reactlynx"`, (2) `shouldEnableRule` returns `false` when capabilities has `reactlynx` and `disabledBy = ["reactlynx"]`, (3) the same rule still fires when capabilities has only `vite`/`react:18`. Plugin codegen unchanged (still 330 rules); workspace typecheck 8/8 green; core suite 61/61 files / 589/589 tests passing (+3); plugin suite unchanged at 38 pre-existing failures / 6783 passing / 49 skipped. Truffler verify shows only three `disabledBy` shapes in the codebase: `["react-compiler"]`, `["react-native"]`, and my new `["reactlynx"]` — same pattern, just a different token; no new shape introduced.
- **M2 is functionally complete locally.** Only had one US (US-2.1) by design.
- **US-4.0 (`isMainThreadFunction` helper)** — **implemented locally on this branch, not yet committed.** Per "Before implementing" rule, verified oxc's `.directive` property via a codebase grep: existing `has-use-server-directive.ts` and `tanstack-start-no-use-server-in-handler.ts` already use `statement.directive === "use server"`, confirming oxc matches the ESTree-canonical shape. New `packages/oxlint-plugin-react-doctor/src/plugin/utils/reactlynx.ts` exports `isMainThreadFunction(node)`: walks `FunctionDeclaration` / `FunctionExpression` / `ArrowFunctionExpression`, returns `true` iff the body is a `BlockStatement` whose `body[0]` is an `ExpressionStatement` with `directive === "main thread"`. Companion `reactlynx.test.ts` (13 tests) using real `parseFixture` so the helper runs against actual oxc AST: function/expression/arrow positive cases, double-quoted directives, all six negative cases (no body, no directive, `'use strict'`, arrow with expression body, empty body, `console.log('main thread')` false-positive guard), nested-scope cases (outer-only main-thread vs inner-only main-thread), and non-function node rejection (Program, ExpressionStatement). All 13 tests pass first try, confirming both the helper and oxc's AST shape.
- **US-4.1 (`rl-no-async-in-main-thread`)** — **implemented locally on this branch, not yet committed.** New rule at `packages/oxlint-plugin-react-doctor/src/plugin/rules/reactlynx/rl-no-async-in-main-thread.ts` with `requires: ["reactlynx"]`, severity `error`. New helper `findEnclosingMainThreadFunction(node)` walks ancestors via `.parent` (same pattern as several existing rules in `zod/`, `react-native/`) and returns the nearest main-thread function ancestor, or null. Three visitors: function decl/expr/arrow flags `node.async === true` when `isMainThreadFunction(node)`; `AwaitExpression` flags when `findEnclosingMainThreadFunction(node)` is non-null; `NewExpression` with `callee.name === "Promise"` + non-shadowed (`findVariableInitializer(node, "Promise")` falsy) + inside main-thread function gets flagged. Companion test (12 tests across 4 describes) covers: async on each function shape, async without directive (no flag), await inside main-thread async (catches both diagnostics), await in nested non-main-thread async-IIFE inside main-thread scope (1 diagnostic — the await's nearest main-thread ancestor is the outer), await outside main-thread (no flag), `new Promise(...)` positive/negative/shadowed-binding, `Promise.resolve(...)` skipped (only constructor flagged), nested-but-sibling case. Rule registered (330 → 331 rules). One test-expectation fix mid-development: my initial "≥2 diagnostics" expectation for the nested-async-IIFE case was wrong (the inner async isn't main-thread-tagged itself, so only the `await` flags), corrected to exact `1` with an explanatory comment.
- Plugin suite delta after US-4.0 + US-4.1: +2 test files / +25 passing tests / 0 new failures (still 38 pre-existing).
- **US-4.2 (`rl-prefer-main-thread-ref`)** — **implemented locally on this branch, not yet committed.** New rule at `packages/oxlint-plugin-react-doctor/src/plugin/rules/reactlynx/rl-prefer-main-thread-ref.ts`. New shared helper `isInsideUnwrappedMainThreadFunction(node)` walks ancestors looking for the nearest function and a `runOnBackground(...)` interceptor — returns `true` iff the nearest function is `'main thread'`-tagged AND no `runOnBackground` was crossed. (Same shape duplicated in US-4.3 below; the duplication is acceptable for V1 but would consolidate cleanly when a 3rd consumer lands.) Single `CallExpression` visitor flags `useRef(...)` calls inside main-thread scope. Companion test (9 tests across 3 describes): positive cases (each function shape, multiple useRefs, nested block); `runOnBackground` escape hatch (block-body and concise-body); negative cases (normal component, sibling function, identifier-only access). Rule registered 331 → 332. All 9 tests pass first try.
- **US-4.3 (`rl-main-thread-directive`)** — **implemented locally on this branch, not yet committed.** New rule at `…/rl-main-thread-directive.ts`. Two-pass approach via shared visitor state: a `VariableDeclarator` visitor recognises `const [_, setter] = useState(...)` and `useReducer(...)` and adds the setter name to a per-file Set; a `CallExpression` visitor flags calls to any tracked setter that lexically sit inside an unwrapped main-thread function (same `isInsideUnwrappedMainThreadFunction` shape as US-4.2). Helper `extractSetterName(node)` keyed off `init.callee.name === "useState"` / `"useReducer"` + the second ArrayPattern element being an Identifier. Documented limitation in the rule comment: per-file name tracking (not lexical scope-aware) means two unrelated `setCount` bindings in the same file would conflate; deferred to a future tightening if false positives emerge. Companion test (9 tests across 4 describes) covers useState setter, useReducer dispatcher, multiple setters, `runOnBackground` escape hatch (concise + block-body), no-flag-outside-main-thread, the useState declarator itself (no false positive on the declaration line), and a function-named-setX that wasn't useState-bound. Rule registered 332 → 333. All 9 tests pass first try.
- **M4 is functionally complete locally.** All four user stories done (US-4.0 helper, US-4.1, US-4.2, US-4.3).
- **US-5.1 (`check-rl2-rl3-migration-debt`)** — **implemented locally on this branch, not yet committed.** New check at `packages/core/src/checks/reactlynx/check-rl2-rl3-migration-debt.ts`. Detects three signals (per decision 4B → `error` severity): `lepus.js` at project root, `src/lepus.js`, `card.json` at project root (file-on-disk checks via `isFile`), and `lynx-speedy` declared in `dependencies` or `devDependencies` (manifest check). Each signal emits its own diagnostic so users see every residue path; all share `rule: "rl-no-reactlynx-2-residue"` and point at the `migrax-planner-rl3` skill in both `message` and `help`. Wired into `check-reactlynx-project.ts` orchestrator after `check-engine-versions`. Added 7 tests to `tests/check-reactlynx-project.test.ts` (8 → 15 total): one per signal individually, one for multiple-signals simultaneously (3 diagnostics), and one for a clean RL3 project (no migration diagnostics). Core suite delta: 589 → 596 passing tests (+7); workspace typecheck 8/8 green.
- **M5 is functionally complete locally.** Only had one US (US-5.1) by design.
- **All five milestones (M1–M5) are now functionally complete locally.** Cumulative scope: 14 user stories, all green end-to-end. Pre-existing 38 plugin test failures unchanged throughout (verified via stash-and-rerun on the M0 base ref during US-1.0).
- **End-to-end fixture run (CLAUDE.md #4) caught one M2 audit gap.** Running the built CLI (`node packages/react-doctor/dist/cli.js packages/core/tests/fixtures/reactlynx-app --json`) against the reactlynx-app fixture revealed:
  - `react-builtins/no-unknown-property` flagging `bindtap` as a phantom DOM-prop — confirmed false positive, fixed by adding `disabledBy: ["reactlynx"]` to the rule. The rule wasn't in M2's audit because it isn't tagged `react-jsx-only`; this is a real audit gap caught only by exercising the binary end-to-end. Audit doc `tasks/audit-reactlynx-disabled-rules.md` updated with an addendum.
  - `rerender-functional-setstate` correctly flagged a legitimate stale-closure bug in the fixture's `setCount(count + 1)` — fixed to `setCount((prev) => prev + 1)`. Real-world signal, not a Lynx issue.
  - `unused-dev-dependency` (× 2) for `@lynx-js/rspeedy` + `@lynx-js/react-rsbuild-plugin` — fixed by adding a realistic `lynx.config.ts` to the fixture that imports both packages (`pluginReactLynx()` from the rsbuild plugin, `defineConfig` from rspeedy).
  - `unused-file` on `src/app.tsx` — fundamental dead-code reachability concern (the fixture has no configured entry), not Lynx-specific. Accepted as fixture-shape noise.
- **Final fixture-run state:** `ok=true`, 1 diagnostic (`unused-file` only — out of scope). Framework correctly classified as `reactlynx`; `hasReactLynxWorkspace: true`; no spurious a11y / DOM / RN false positives.
- **End-to-end regression test pinned.** Added `packages/api/tests/reactlynx-fixture-regression.test.ts` (5 tests) that runs `diagnose()` against the reactlynx-app fixture and asserts the no-false-positive contract: framework correctly classified as `reactlynx`, `hasReactLynxWorkspace: true`, no RN/Expo diagnostics, **no `no-unknown-property` on `bindtap`** (the M2 audit gap I caught this iteration — the test would have caught it earlier), no a11y diagnostics on Lynx code, and no engine-versions / migration-debt diagnostics on a clean RL3 install. Future rule changes that re-introduce any Lynx false positive break this test. api suite delta: 14 → 19 tests (+5). The manual end-to-end check from the previous iteration is now an automated, durable contract.
- **Pre-existing test failures (NOT caused by this work).** `packages/oxlint-plugin-react-doctor` has 38 failing tests across 5 files: `react-builtins/jsx-no-new-array-as-prop.regressions`, `jsx-no-new-function-as-prop`, `jsx-no-new-object-as-prop`, `no-array-index-key`, `no-multi-comp`. Verified pre-existing per CLAUDE.md #3 via stash-then-rerun on the clean base ref (identical 38 failures). Triage left to the maintainers.
- **Commit policy.** Diff is clean and revertible. Commit after maintainer review of the M0 PR and the design choices in US-1.1's helper-skip predicates.

### M6 — borrowed from `lynx-community/skills`

A follow-up integration pass after the M1–M5 milestones landed. The
[lynx-community/skills](https://github.com/lynx-community/skills)
repository publishes two skills that overlap with react-doctor's
ReactLynx coverage:

- `reactlynx-best-practices` — a static-analysis + auto-fix
  workflow with four authored rules (`detect-background-only`,
  `proper-event-handlers`, `main-thread-scripts-guide`,
  `hoist-static-jsx`).
- `lynx-devtool` — a CLI / programmatic connector that speaks
  Chrome DevTools Protocol against real Lynx devices, with
  commands for listing clients/sessions, sampling console,
  sending CDP commands, capturing screenshots, etc.

react-doctor had no CDP / device-side functionality before this
section — the borrowed work is additive, not a replacement.

- **US-6.1 (`rl-no-background-only-api-in-render`).** Ported the
  skill's `detect-background-only` rule (CRITICAL impact per the
  skill's own ranking). The other four `rl-*` rules already in the
  plugin all target `'main thread'`-tagged functions; this is the
  inverse — it catches `lynx.getJSModule(...)` / `NativeModules.*`
  invoked from main-thread render scope without any opt-out
  directive. Implementation differs from the skill (oxc ESTree
  visitor + per-file pre-pass + `Program:exit` resolution vs the
  skill's ast-grep walk) but the semantics match: render-scope is
  flagged, BG contexts (useEffect / `'background only'` / inline
  event/ref handlers / named JSX handlers) are not. Companion test
  also extends `isBackgroundOnlyFunction` coverage in the
  shared helper. Registry: 333 → 334 rules.
- **The other three skill rules were considered and deferred.**
  `proper-event-handlers` and `main-thread-scripts-guide` are doc-
  shaped guidance (`target` vs `currentTarget`, `dataset` patterns,
  `useMainThreadRef` usage); the enforceable subset is already
  covered by `rl-no-onclick-on-builtin` (M1) and the M4 main-thread
  rules. `hoist-static-jsx` is already automated by React Compiler
  on projects where it's enabled and would be a noisy warning on
  projects where it isn't — net negative.
- **US-6.2 (lynx-devtool runtime smoke).** Shipped: a
  `scripts/verify-reactlynx-runtime.mjs` Node script that shells
  out to the `lynx-devtool` CLI. Runs `list-clients` (skips with
  exit 0 when no device connected) then `get-console` on both
  `main` and `background` threads, filtered to error/warning, and
  grep for thread-violation patterns (`is not defined`,
  `lynx.getJSModule is not a function`, `NativeModules`,
  `main thread`, `background only`, `Cross-thread`). Exits 1
  on any sampled hit, 0 on clean. The script accepts `--cli
  <path>` or `LYNX_DEVTOOL_CLI` env var to locate the CLI;
  defaults to the `lynx-community/skills` install path
  (`~/.claude/skills/lynx-devtool/scripts/index.mjs`). NOT in CI
  — invoke manually after building / opening your Lynx app on a
  connected device. Use case: catches the dual-thread footguns
  that no AST-level rule can prove (e.g. a `'background only'`
  function reached from main-thread render via dynamic dispatch).

---

## Goals

- Catch the three most common ReactLynx-newbie mistakes (`window`/`document` use, `onClick` on host elements, version-mismatched Lynx packages) with zero configuration.
- Prevent React-DOM-assuming rules from false-positiving on Lynx code.
- Make a mixed `apps/web` + `apps/mobile` + `apps/lynx` monorepo lint cleanly without manual scope hacks.
- Add main-thread directive semantic checks for the dual-thread runtime.
- Surface ReactLynx 2 → 3 migration debt as a hard error so projects can't silently sit on the deprecated stack.

## Non-Goals

- **No migration work in react-doctor.** RL2 → RL3 transforms live in `migrax-planner-rl3`; react-doctor only detects residue and points at the skill.
- **No ReactLynx-specific score weights or scoring model changes** in this PRD. Score landing comes later, separately.
- **No changes to `action.yml`** or the GitHub Action surface — `rl-*` rules ride the existing action wiring.
- **No new published package.** Per decision 1A, `rl-*` rules ship inside the existing `oxlint-plugin-react-doctor`.
- **No website / docs site changes** other than what the README diff already covers.

---

## Technical Considerations

- **Where rules live.** All `rl-*` oxlint rules go under `packages/oxlint-plugin-react-doctor/src/plugin/rules/reactlynx/` (new directory). Bucket directory drives `framework` + default `category` per the generated rule registry — see the comment at the top of `rule-registry.ts`.
- **Where project checks live.** `packages/core/src/checks/reactlynx/` (new directory), called from a new `check-reactlynx-project.ts` at `packages/core/src/`, paralleling `check-react-native-project.ts`. Wire into `run-inspect.ts` alongside `checkReactNativeProject`.
- **Capability gating.** Every `rl-*` rule declares `requires: ["reactlynx"]`. The `reactlynx` capability is already in the set as of M0. Minor-version gates (`reactlynx:<major>.<minor>`) follow the `react:19.2` pattern in `runners/oxlint/capabilities.ts`.
- **Truffler hygiene.** Before adding a helper / constant, search with `bunx @rayhanadev/truffler "<query>" packages` per AGENTS.md. After completing each milestone, re-search for the symbols added to verify no duplication and delete superseded code.
- **Rule-registry codegen.** The `oxlint-plugin-react-doctor` package owns a `gen` script (`pnpm -F oxlint-plugin-react-doctor gen`, or `pnpm gen` from inside that package directory) that regenerates `src/plugin/rule-registry.ts` by walking the `rules/*/` buckets. **The generator hard-fails on any unknown bucket** (`BUCKET_TO_DEFAULT_CATEGORY` lookup), so adding `rules/reactlynx/` is gated on US-1.0. CI runs `gen:check` (the gen script + `git diff --exit-code` on the registry) — if your local registry drifts from the committed one, CI catches it.

- **Changeset per milestone.** M0 added `.changeset/reactlynx-framework-support.md` as a `minor` release of `react-doctor`. M1–M5 each ship one changeset on their own PR — `patch` for project-check-only milestones (US-1.3 alone, US-5.1) and `minor` for milestones that add user-visible rules to the public oxlint plugin (everything else). `react-doctor` is the only versioned package that changes; the internal `@react-doctor/core` and `oxlint-plugin-react-doctor` ride along.

- **Centralized Lynx package list.** The trio `@lynx-js/react` + `@lynx-js/rspeedy` + `@lynx-js/react-rsbuild-plugin` is referenced in US-1.3 (engine-versions), US-1.0 (auto-tag derivation discussion), and the deferred `check-no-rn-deps-in-lynx-pkg` rationale. Centralize as `REACTLYNX_ENGINE_PACKAGES` in `packages/core/src/project-info/internal-reactlynx-package-names.ts` (parallel to the existing `internal-rn-dependency-names.ts`) and re-export from `packages/core/src/index.ts`, so adding a future engine package (e.g. a hypothetical `@lynx-js/web-platform`) is a one-line change.

- **Rule field conventions.** Every `rl-*` rule MUST set the same fields the existing `rn-*` rules do (`Rule` interface in `packages/oxlint-plugin-react-doctor/src/plugin/utils/rule.ts`; reference implementation `rn-no-panresponder.ts`):
  - `id: "rl-<short-name>"` — public id, what users put in their config (`react-doctor/rl-<short-name>`).
  - `title: "<short headline>"` — few-word noun phrase, no trailing period, surfaced in docs / summary UI.
  - `severity: "error" | "warn"` — required. Floor severity for every M1 + M4 + M5 rule and project check listed in this PRD is `"error"`: each one represents a runtime failure (dropped event, wrong-thread access, broken install, deprecated stack) where shipping silently is worse than the lint noise. `"warn"` is reserved for future style / migration-hint rules.
  - `requires: ["reactlynx", …]` — per FR-4.
  - `recommendation: "<longer fix-guidance prose>"` — surfaced in `--explain` and docs site; describe what to do, not just what's wrong.
  - `create(context)` returns visitors; `context.report({ node, message })` carries the short per-diagnostic message (distinct from `recommendation`).
- **Effect v4.** Project checks return `Diagnostic[]` (sync), same shape as `checkReactNativeMetroBabelPreset`. No Effect-typed services need to be created.
- **Testing convention.** Vitest via `vp test`. Fixtures under `packages/core/tests/fixtures/`. For oxlint rules, follow `packages/oxlint-plugin-react-doctor/src/plugin/rules/react-native/*.test.ts`.

---

## Milestones overview

| Milestone | Theme | Ship size | Risk |
| --- | --- | --- | --- |
| M1 | Three highest-ROI checks: `rl-no-dom-globals`, `rl-no-onclick-on-builtin`, `check-engine-versions` | small | low |
| M2 | `disabledBy: ["reactlynx"]` audit across React-DOM-assuming rules | small | low (no new logic) |
| M3 | `hasReactLynxWorkspace` field (M0 follow-up) + `classify-package-platform.ts` adds `reactlynx` class | medium | low |
| M4 | Main-thread semantic rules (`rl-main-thread-directive`, `rl-no-async-in-main-thread`, `rl-prefer-main-thread-ref`) | large | medium (AST shape of `'main thread'` directive is documented and confirmed — see US-4.0 and References — but oxc's exact `directive` property exposure should be verified against a real parse before US-4.0 lands) |
| M5 | RL2 → RL3 migration-debt detector (hard error) | small | low |

---

## User Stories

Per decision 2C: **one US per item for M1** (the ship-first set), **grouped USes for later milestones** so the bigger investigations aren't fragmented up front.

### M1 — Highest ROI

#### US-1.0: Wire `reactlynx` into the rule infrastructure (prerequisite)
**Description:** As an implementer, I need the rule-registry codegen and the `Rule` type to know about the `reactlynx` bucket before any `rl-*` rule can be authored — otherwise `pnpm gen` hard-fails with "Unknown bucket 'reactlynx'".

**Why this is a separate story:** the rule-registry generator (`packages/oxlint-plugin-react-doctor/scripts/generate-rule-registry.mjs`) enforces an allowlist of bucket directories via `BUCKET_TO_DEFAULT_CATEGORY` and exits non-zero on any unknown bucket. The `RuleFramework` type union in `packages/oxlint-plugin-react-doctor/src/plugin/utils/rule.ts` is also closed. Both must accept `reactlynx` before US-1.1 / US-1.2 / future M4 rules can compile.

**Acceptance Criteria:**
- [ ] `RuleFramework` union in `packages/oxlint-plugin-react-doctor/src/plugin/utils/rule.ts` gains `| "reactlynx"`.
- [ ] In `packages/oxlint-plugin-react-doctor/scripts/generate-rule-registry.mjs`:
  - [ ] Add `reactlynx: "reactlynx"` to `BUCKET_TO_FRAMEWORK`.
  - [ ] Add `reactlynx: "ReactLynx"` (new category name) to `BUCKET_TO_DEFAULT_CATEGORY`.
  - [ ] Add `ReactLynx: "Bugs"` to `CATEGORY_BUCKET` so the user-facing collapse maps to one of the five outcome buckets.
  - [ ] Add `reactlynx: ["reactlynx"]` to `BUCKET_TO_AUTO_TAGS` so every `rl-*` rule auto-inherits the `reactlynx` tag (parallel to how `react-native/` rules auto-get the `react-native` tag — enables `--ignore-tag reactlynx`).
- [ ] Create an empty `packages/oxlint-plugin-react-doctor/src/plugin/rules/reactlynx/` directory (gitkeep or first real rule from US-1.1).
- [ ] `pnpm gen` runs clean (no "Unknown bucket" error, no rules registered yet if the dir is empty).
- [ ] `pnpm typecheck` passes.
- [ ] Truffler verify: search `bunx @rayhanadev/truffler "RuleFramework" packages` confirms only the one declaration site was touched and no consumer hardcodes the old set.

#### US-1.1: Add `rl-no-dom-globals` rule
**Description:** As a ReactLynx developer, I want react-doctor to flag uses of `window` / `document` / `localStorage` / `navigator` so I find Web-only assumptions before runtime crashes them.

**Examples**

```tsx
// FLAG
if (window.innerWidth > 600) { /* … */ }
const stored = localStorage.getItem("user");
document.querySelector(".foo");

// NO FLAG
const { window } = someParam;      // shadowed by destructure
function f(document) { document.x } // shadowed by parameter
import { navigator } from "./util"; // shadowed by import
```

**Acceptance Criteria:**
- [ ] New file: `packages/oxlint-plugin-react-doctor/src/plugin/rules/reactlynx/rl-no-dom-globals.ts`
- [ ] Rule `defineRule({ id: "rl-no-dom-globals", requires: ["reactlynx"], … })`
- [ ] Flags reads/writes of identifiers `window`, `document`, `localStorage`, `sessionStorage`, `navigator` when they resolve to the global (i.e. no local binding shadows them). Use oxlint's scope analysis (`context.sourceCode.getScope?.(node)` or the prevailing pattern in `react-builtins/exhaustive-deps.ts`) rather than name-only matching.
- [ ] Does not flag those identifiers when shadowed by a local variable / parameter / import.
- [ ] Message suggests the `lynx.*` API surface where applicable (e.g. `lynx.getSystemInfo()` for `navigator`-shaped checks); otherwise "This global is not available in the ReactLynx runtime."
- [ ] Companion `.test.ts` covers: positive cases (each global, read and write), shadowing cases (param / destructure / import), property-access case (`window.foo`), `typeof window !== 'undefined'` case (NO flag — this is a runtime-environment guard idiom).
- [ ] `pnpm gen` re-runs the generated rule registry (the generator picks up the new file automatically).
- [ ] `pnpm typecheck` + targeted vitest on the new test pass.

#### US-1.2: Add `rl-no-onclick-on-builtin` rule
**Description:** As a ReactLynx developer, I want `onClick` on lowercase host elements (`<view>`, `<text>`, …) flagged because it's a silent no-op; only `bindtap` / `catchtap` work.

**Examples**

```tsx
// FLAG
<view onClick={handleTap} />
<text onClick={() => setCount(c => c + 1)}>Tap me</text>

// NO FLAG
<view bindtap={handleTap} />        // correct ReactLynx event
<view catchtap={handleTap} />       // also correct (cancellable variant)
<Button onClick={handleTap} />      // capitalized → user component
<div onClick={handleTap} />         // not a Lynx built-in tag
```

**Acceptance Criteria:**
- [ ] New file: `packages/oxlint-plugin-react-doctor/src/plugin/rules/reactlynx/rl-no-onclick-on-builtin.ts`
- [ ] Detects `JSXAttribute name = "onClick"` on `JSXOpeningElement` whose tag is a lowercase identifier matching the Lynx built-in element list centralised in `plugin/constants/reactlynx.ts` (see Design Considerations for the seed list).
- [ ] Suggests `bindtap` (default message) and notes `catchtap` exists for stop-propagation cases — defer the cancelling-vs-bubbling nuance to the message text, not the auto-fix.
- [ ] No flag on capitalized component names (`<Button onClick={…}>`) — those are user components, may handle the prop in user code.
- [ ] No flag on web-DOM lowercase tags (`<div>`, `<span>`, `<button>`) — those aren't Lynx built-ins; the file-level boundary in M3 will eventually skip the rule entirely on non-Lynx files.
- [ ] No auto-fix in M1 (open question #2; ship without, gather signal).
- [ ] Companion `.test.ts` with each example above; assert the rule never reports on `bindtap` / `catchtap`.
- [ ] `pnpm gen` updates the registry; typecheck + test pass.

#### US-1.3: Add `check-engine-versions` project check
**Description:** As a ReactLynx developer, I want react-doctor to flag mismatched majors/minors across `@lynx-js/react`, `@lynx-js/rspeedy`, and `@lynx-js/react-rsbuild-plugin` so I don't ship an install that boots but breaks at runtime.

**Examples**

```jsonc
// FLAG (minor mismatch — runtime fails)
{
  "dependencies": {
    "@lynx-js/react": "^0.121.0",
    "@lynx-js/rspeedy": "^0.14.0",
    "@lynx-js/react-rsbuild-plugin": "^0.15.0" // off by one minor
  }
}

// NO FLAG (aligned)
{
  "dependencies": {
    "@lynx-js/react": "^0.121.0",
    "@lynx-js/rspeedy": "^0.14.0",
    "@lynx-js/react-rsbuild-plugin": "^0.16.0"
  }
}

// NO FLAG (one missing — out of scope; user is mid-install)
{
  "dependencies": { "@lynx-js/react": "^0.121.0" }
}
```

Note: the three packages do **not** share a major/minor — they each track their own. The check pins each package to its own *expected-companion minor* given the others' versions, using a hand-maintained compatibility table seeded from `@lynx-js/react-rsbuild-plugin`'s peer range (see References). Simpler v1 alternative: assert "all three are present" only, and defer the compatibility table to a follow-up if version-skew bug reports come in. Pick the simpler approach for M1.

**Acceptance Criteria:**
- [ ] New file: `packages/core/src/checks/reactlynx/check-engine-versions.ts`
- [ ] Reads each package in `REACTLYNX_ENGINE_PACKAGES` (centralized constant — see Technical Considerations) from `dependencies` / `devDependencies` of the root manifest, resolving catalogs via the existing `resolveCatalogVersion` helper (see `packages/core/src/project-info/resolve-catalog-version.ts`).
- [ ] **v1 behavior:** emits one `error` if at least one of the three is present and any of the others is missing; emits nothing when all three are absent (this isn't a ReactLynx project, gate already filtered) or all three are present.
- [ ] **v2 follow-up (deferred):** version-compatibility-table check across the trio. Out of scope for M1 — file a follow-up issue.
- [ ] Wired into a new `packages/core/src/check-reactlynx-project.ts` that returns `[]` unless the project is a ReactLynx project (mirror of `check-react-native-project.ts`). Gate predicate: `project.framework === "reactlynx"`.
- [ ] `run-inspect.ts` calls `checkReactlynxProject(scanDirectory, project)` alongside `checkReactNativeProject(...)`.
- [ ] Companion `.test.ts` with: aligned trio (no diag), one missing (error), two missing (single error), all three missing (no diag, gate covers it).
- [ ] Typecheck + targeted vitest pass.
- [ ] Truffler search confirms no duplicate version-comparison helper exists; if `getLowestDependencyMajor` or sibling suffices, reuse it.

### M2 — `disabledBy: ["reactlynx"]` audit

Single US (the work is mechanical once the audit list is built).

#### US-2.1: Audit React-DOM-assuming rules and add `disabledBy: ["reactlynx"]`
**Description:** As a ReactLynx developer, I want React-DOM-assuming rules to stay silent on Lynx code so the report focuses on real Lynx bugs, not phantom web-DOM violations.

**Audit surface (concrete, as of PRD-write time):**
- **~46 rules** carry `tags: ["react-jsx-only"]` (verifiable via `grep -rln 'tags.*react-jsx-only' packages/oxlint-plugin-react-doctor/src/plugin/rules/`). These are the primary audit candidates: a `react-jsx-only` tag already bakes in the assumption that JSX semantics are React-flavoured DOM, which is the same assumption that breaks for Lynx host elements.
- **~9 rules** already declare `disabledBy: [<capability>]` (almost all `disabledBy: ["react-compiler"]` for the `jsx-no-new-*-as-prop` family). These are the shape to mirror.

**Acceptance Criteria:**
- [ ] Produce an explicit audit list in `tasks/audit-reactlynx-disabled-rules.md` enumerating every rule under `packages/oxlint-plugin-react-doctor/src/plugin/rules/` that bakes in a `react-dom`-only assumption — starting from the ~46 `react-jsx-only`-tagged rules and expanding outward from any other rule whose `create` references `react-dom`, `window`, ARIA attribute strings, or DOM-specific event names like `onSubmit`.
- [ ] Categorise each as: (a) **stays on** — React semantics, fires correctly under Lynx (e.g. `jsx-no-new-object-as-prop`'s object-equality concern is true under Lynx too); (b) **disable on Lynx** — add `disabledBy: ["reactlynx"]`; (c) **needs separate Lynx variant** — note for a later milestone, don't change yet.
- [ ] Apply `disabledBy: ["reactlynx"]` to every (b)-category rule.
- [ ] For each rule changed, add a one-line test asserting the rule does not fire when `capabilities` includes `reactlynx` (use the existing capabilities-aware test helper if present; otherwise add a `build-capabilities`-style smoke test).
- [ ] Sanity-check candidates (non-exhaustive): `view-transitions/no-flush-sync`, every `a11y/aria-*` rule, `react-builtins/jsx-no-jsx-as-prop` (re-verify React semantics holds), `client/*` rules.
- [ ] `pnpm test` for `oxlint-plugin-react-doctor` stays green.
- [ ] Truffler search for any `disabledBy:` lines added confirms no new shape was introduced.

### M3 — Mixed-monorepo file-level boundary

#### US-3.0: Add `hasReactLynxWorkspace` to `ProjectInfo` (M0 follow-up)
**Description:** As a developer of a web-rooted monorepo (`framework: "vite"` / `"nextjs"`) that contains an `apps/lynx` workspace, I want `rl-*` rules to still load — otherwise the project-level capability gate strips them before file-level boundary code in M3 ever runs.

**Why this is a separate story from M0:** M0 ships framework *detection* (`framework === "reactlynx"` when the root manifest declares `@lynx-js/react`). But for the "Lynx-as-a-workspace-under-a-web-root" shape, the root manifest declares `vite`/`next`/etc. and never sees Lynx — so `project.framework === "vite"` and `capabilities.add(project.framework)` adds `vite`, not `reactlynx`. M0's check-react-native-project equivalent (`hasReactNativeWorkspace`) bridges exactly this gap on the RN side; the Lynx parallel was missed in M0 and surfaces now because M3's file-level classifier presupposes the project-level capability is set.

**Reference precedent:** `capabilities.ts:19-31` and `discover-project.ts:191-194`. The comment at `capabilities.ts:24` ("`hasReactNativeWorkspace` covers the inverted case the file-level gate alone cannot reach…") describes exactly the symmetry to mirror.

**Acceptance Criteria:**
- [ ] `ProjectInfo` interface (`packages/core/src/types/project-info.ts`) gains `hasReactLynxWorkspace: boolean` with a doc comment mirroring the existing `hasReactNativeWorkspace` block.
- [ ] New helper `packages/core/src/project-info/has-reactlynx-workspace-anywhere.ts` paralleling `has-react-native-workspace-anywhere.ts`; uses `someWorkspacePackageJson` + a new `is-package-json-reactlynx-aware.ts` predicate that returns `true` iff the manifest declares `@lynx-js/react` in any dependency section.
- [ ] `discover-project.ts` computes `hasReactLynxWorkspace = framework === "reactlynx" || hasReactlynxWorkspaceAnywhere(directory, packageJson)` and adds it to the constructed `ProjectInfo`.
- [ ] `runners/oxlint/capabilities.ts` swaps `capabilities.add(project.framework)` (which already adds `reactlynx` for the root-is-Lynx case) for an explicit branch: `if (project.framework === "reactlynx" || project.hasReactLynxWorkspace) capabilities.add("reactlynx")`. Keep the bulk `capabilities.add(project.framework)` for the other frameworks unchanged — only Lynx needs the workspace-aware branch (Preact and tanstack don't have a workspace-aware equivalent today).
- [ ] Tests:
  - Extend `discover-project.test.ts` with the case "web-rooted monorepo with `apps/lynx` workspace → `hasReactLynxWorkspace === true`" — paralleling the existing Expo `apps/mobile` workspace test.
  - Extend `build-capabilities.test.ts` with the case "`framework: 'vite'` + `hasReactLynxWorkspace: true` → capabilities has `reactlynx`".
- [ ] Ship as a follow-up commit on the existing `reactlynx-support` branch (not as a separate branch) so M0 lands complete. Adds a new `patch` changeset noting the fix.
- [ ] Truffler verify: search `hasReactLynxWorkspace` across `packages/core` confirms one declaration site (`project-info.ts`), one writer (`discover-project.ts`), and one reader (`capabilities.ts`).

#### US-3.1: Extend `classify-package-platform.ts` with a `reactlynx` class
**Description:** As a developer of a mixed `apps/web` + `apps/mobile` + `apps/lynx` monorepo, I want each package's rules scoped to its platform so rules don't cross-fire and pollute the report.

**Real shape today** (`packages/oxlint-plugin-react-doctor/src/plugin/utils/classify-package-platform.ts`):

```ts
export type PackagePlatform = "expo" | "react-native" | "web" | "unknown";
// precedence: isExpoManaged > isReactNativeAware > isWebFrameworkOnly > unknown
```

**After M3:**

```ts
export type PackagePlatform = "expo" | "reactlynx" | "react-native" | "web" | "unknown";
// precedence: isExpoManaged > isReactLynx > isReactNativeAware > isWebFrameworkOnly > unknown
```

Lynx slots **above** `react-native` because `@lynx-js/react` is a more specific signal than the generic `react-native` field — and because Lynx libraries reuse Metro's top-level `react-native` resolution field, a Lynx-only package could otherwise be mis-classified as RN. Lynx slots **below** `expo` because no real-world package declares both `expo` and `@lynx-js/react`; that combination is almost certainly a mis-install and should still classify as Expo so the user sees the Expo-side checks rather than silently hiding them.

**Acceptance Criteria:**
- [ ] `PackagePlatform` type gains a `"reactlynx"` variant inserted between `"expo"` and `"react-native"` in the union (order matters for review readability — list reflects precedence).
- [ ] Add a new `isReactLynxAware(packageJson)` helper that returns `true` iff `@lynx-js/react` is declared in any of `dependencies` / `devDependencies` / `peerDependencies` / `optionalDependencies` (parallel to the existing `isReactNativeAware`).
- [ ] Update `classifyPackagePlatform` to insert `isReactLynxAware` between `isExpoManaged` and `isReactNativeAware` (precedence above).
- [ ] Update the type-doc comment in the file to document the new variant in the same prose style as the existing four.
- [ ] **File-level gate (concrete wiring):** add `packages/oxlint-plugin-react-doctor/src/plugin/utils/is-reactlynx-file.ts` (parallel to `is-react-native-file.ts`) exporting `isReactlynxFileActive(context)`, and `packages/oxlint-plugin-react-doctor/src/plugin/utils/wrap-reactlynx-rule.ts` (parallel to `wrap-react-native-rule.ts`) exporting `wrapReactlynxRule`. In `packages/oxlint-plugin-react-doctor/src/plugin/react-doctor-plugin.ts`, extend the existing chain:
  ```ts
  const frameworkWrapped = rule.framework === "react-native" ? wrapReactNativeRule(rule)
    : rule.framework === "reactlynx" ? wrapReactlynxRule(rule)
    : rule;
  ```
- [ ] RN rules already gated by `react-native` capability continue to skip files whose package classifies as `reactlynx` (this falls out automatically from `wrapReactNativeRule`'s call to `classifyPackagePlatform` since the new `reactlynx` value isn't `"react-native"` — confirm via the new fixture test).
- [ ] Fixture + test: a synthetic monorepo with four packages (`apps/web`, `apps/mobile`, `apps/lynx`, `apps/expo`) verifying each rule fires only in its bucket.
- [ ] Truffler for `classifyPackagePlatform` / `PackagePlatform` / `isReactLynxAware` to confirm no duplicate classifier and no consumer hardcodes the old four-value union.

### M4 — Main-thread semantic rules

These depend on a written AST shape spike. Bundle as one investigation US plus three implementation USes that can run in parallel afterwards.

#### US-4.0: Implement `isMainThreadFunction` AST helper
**Description:** As an implementer, I need a verified utility for detecting `'main thread'`-tagged functions so M4.1–M4.3 rules share one source of truth.

**Confirmed shape** (from `lynxjs.org/react/main-thread-script.html`): the directive is a plain string literal `'main thread'` at the **first statement** of the function body, identical in shape to `'use strict'`. In ESTree / oxc AST terms:

```
FunctionDeclaration | FunctionExpression | ArrowFunctionExpression
  .body
    BlockStatement
      .body[0]
        ExpressionStatement
          .expression
            Literal { value: "main thread", raw: "'main thread'" | "\"main thread\"" }
          .directive: "main thread"   // ESTree's directive prologue marker
```

The `directive` property on the `ExpressionStatement` is the canonical signal — parsers expose it specifically because directive prologues need to be distinguished from regular string-expression statements. **Use `node.directive === "main thread"`, not a string-equality check on the expression value**, to avoid false positives on e.g. `console.log('main thread')` as the first statement.

**Acceptance Criteria:**
- [ ] New file: `packages/oxlint-plugin-react-doctor/src/plugin/utils/reactlynx.ts` exporting `isMainThreadFunction(node: EsTreeNode): boolean`.
- [ ] Implementation: walks `FunctionDeclaration` / `FunctionExpression` / `ArrowFunctionExpression`; returns `true` iff the body is a `BlockStatement` whose `body[0]` is a directive prologue with `directive === "main thread"`. Arrow functions with expression bodies (no `BlockStatement`) return `false`.
- [ ] **Before implementing:** verify oxc actually exposes the `directive` property on `ExpressionStatement` by parsing a one-line fixture (`(() => { 'main thread'; })()`) and inspecting the resulting AST. If oxc names it differently (`directive` vs `directiveText` vs not at all), adjust the helper. The doc-confirmed shape is ESTree-canonical; oxc usually matches but verify.
- [ ] Cross-check against a real ReactLynx example: clone `https://github.com/lynx-family/lynx-stack`'s `examples/` directory into a throwaway location (or use the npm tarball of `@lynx-js/react`) and confirm at least two real-world `'main thread'` annotations parse correctly under the helper.
- [ ] Companion `.test.ts` covers: function declaration, function expression, arrow function with block body, arrow function with expression body (negative), nested function (only outer is main-thread → inner is not, and vice versa), false-positive guard (`console.log('main thread')` as first statement is NOT a directive).

#### US-4.1: Add `rl-no-async-in-main-thread`
**Description:** As a ReactLynx developer, I want `await` / `new Promise()` inside a `'main thread'` function flagged because async work doesn't survive the main-thread sandbox.

**Acceptance Criteria:**
- [ ] Rule under `…/rules/reactlynx/rl-no-async-in-main-thread.ts` with `requires: ["reactlynx"]`.
- [ ] Uses the `isMainThreadFunction` utility from US-4.0.
- [ ] Detects: function declared `async`, `AwaitExpression` anywhere in the body, `NewExpression { callee.name === "Promise" }`.
- [ ] Negative: `Promise.resolve()` call where `Promise` is locally imported / shadowed (use the same resolve-to-global approach as `rl-no-dom-globals`).
- [ ] Companion `.test.ts`.

#### US-4.2: Add `rl-prefer-main-thread-ref`
**Description:** As a ReactLynx developer, I want `useRef` inside a `'main thread'` function flagged in favor of `useMainThreadRef` so refs read from the correct thread.

**Acceptance Criteria:**
- [ ] Rule under `…/rules/reactlynx/rl-prefer-main-thread-ref.ts` with `requires: ["reactlynx"]`.
- [ ] Detects `useRef` (`CallExpression { callee.name === "useRef" }`) inside a main-thread function unless the call is wrapped in a `runOnBackground(…)` invocation.
- [ ] Fix suggestion text points at `useMainThreadRef` from `@lynx-js/react`.
- [ ] Negative: `useRef` outside a main-thread function (no flag), `runOnBackground(() => useRef(…))` (no flag).
- [ ] Companion `.test.ts`.

#### US-4.3: Add `rl-main-thread-directive` (closure-rule)
**Description:** As a ReactLynx developer, I want a `'main thread'` function that closes over background-thread `useState` setters or other background-only references flagged because the call will silently fail at runtime.

**Acceptance Criteria:**
- [ ] Rule under `…/rules/reactlynx/rl-main-thread-directive.ts` with `requires: ["reactlynx"]`.
- [ ] In a main-thread function body, walk identifier references and flag:
  - calls to a binding produced by `useState`'s second tuple element (setter pattern).
  - calls to a binding produced by `useReducer`'s second tuple element.
- [ ] Negative: setters wrapped in `runOnBackground(() => setX(…))`.
- [ ] Companion `.test.ts`.

### M5 — RL2 → RL3 migration debt

#### US-5.1: Add `check-rl2-rl3-migration-debt`
**Description:** As a maintainer inheriting an old ReactLynx codebase, I want react-doctor to fail loud when ReactLynx 2 residue is present so I can't accidentally ship on the deprecated stack.

**Acceptance Criteria:**
- [ ] New file: `packages/core/src/checks/reactlynx/check-rl2-rl3-migration-debt.ts`
- [ ] Returns `error`-severity diagnostics (per decision 4B — hard error, not warning) when **any** of these signals are present:
  - `lepus.js` at the project root or under `src/`.
  - `card.json` at the project root.
  - `lynx-speedy` declared as a dependency / devDependency.
- [ ] Diagnostic message points at the `migrax-planner-rl3` skill: "ReactLynx 2 residue detected (<signal>). Run the `migrax-planner-rl3` skill to migrate."
- [ ] Wired into `check-reactlynx-project.ts` from US-1.3.
- [ ] Companion `.test.ts` with each signal individually + a clean project (no diag).

---

## Deferred — out of scope for M1–M5

The original brainstorm listed several additional rule ideas that this PRD **consciously defers** rather than drops. Each is captured here so they aren't lost; they should be revisited in a "Lynx runtime semantics audit" follow-up PRD once the M1–M5 work has landed and we have telemetry on which Lynx false-positive patterns are actually hitting real codebases.

- **`rl-no-react-native-imports`** — forbid imports from `react-native` / `react-dom`. Conceptually symmetric with `rl-no-dom-globals` and cheap to implement, but partially redundant once `check-no-rn-deps-in-lynx-pkg` (M5-adjacent) flags the manifest, and once M3's file-level boundary refuses to load `rn-*` rules on Lynx packages. Reconsider after M3.
- **`rl-no-rn-style-shortcuts`** — flag `style={[a, b]}` array form (RN-idiomatic, not first-class in Lynx). Defer until we confirm against the current Lynx style runtime whether arrays actually fail or just silently get the first object.
- **`rl-list-requires-item-key`** — flag `<list-item>` without `item-key`. Defer pending Open Question #6 (does the requirement apply to direct children only, or deeply-nested too?).
- **`rl-no-css-unsupported-prop`** — flag `style` keys not in Lynx's CSS subset. Defer because the subset evolves per Lynx release; without a generated-from-types unsupported list this becomes a maintenance burden.
- **`rl-no-setTimeout-without-cleanup`** — flag uncleaned main-thread timers. Defer until we can confirm against the runtime whether main-thread `setTimeout` actually leaks across threads on unmount; if the runtime cleans up itself, this rule has zero value.
- **`rl-no-bindtap-without-cancellable`** — recommend `catchtap` for long-press / scroll contexts. Defer because "long-press / scroll context" is a heuristic, not a hard rule; needs telemetry to avoid false-positive fatigue.
- **`check-no-rn-deps-in-lynx-pkg`** (from the brainstorm's project-level list) — defer. Overlaps significantly with M3's file-level boundary classification: if `apps/lynx`'s manifest declares `react-native`, M3's classifier returns `reactlynx` (Lynx-first precedence), so `rn-*` rules still don't load on the Lynx package. A separate project-level check on top would be additional protection but not strictly necessary.
- **`check-rspeedy-config`** (from the brainstorm's project-level list) — defer. A ReactLynx project without `pluginReactLynx()` in its rsbuild config can't have built successfully, so the realistic failure mode is "user is mid-setup and hasn't wired the plugin yet" — a developer-experience hint, not a quality-bar finding. Lower ROI than the M1 set.
- **`check-debug-info-output`** (from the brainstorm's project-level list) — defer. Requires running / inspecting a build output, which steps outside react-doctor's static-analysis model. The `debug-info-remapping` skill in this repo handles consumption of `debug-info.json`; producing it is a build-config concern.

## Functional Requirements

**Project-level checks**

- FR-1: A `check-reactlynx-project.ts` orchestrator must short-circuit and return `[]` unless `project.framework === "reactlynx"`. It must be called from `run-inspect.ts` alongside `checkReactNativeProject`.
- FR-2: `check-engine-versions` must read versions from the root manifest's `dependencies` / `devDependencies` and resolve catalog refs via `resolveCatalogVersion`. **v1 behaviour:** emit one `error` listing the missing packages whenever **at least one but not all** of `@lynx-js/react`, `@lynx-js/rspeedy`, `@lynx-js/react-rsbuild-plugin` is present (i.e. partial install). Emit nothing when all three are present or all three are absent. The major/minor compatibility-table check is deferred (US-1.3 v2 follow-up); FR-2 will be tightened then.
- FR-3: `check-rl2-rl3-migration-debt` must emit `error`-severity diagnostics for each detected RL2 signal (`lepus.js`, `card.json`, `lynx-speedy`) and reference the `migrax-planner-rl3` skill in the message.

**Lint rules**

- FR-4: Every rule under `packages/oxlint-plugin-react-doctor/src/plugin/rules/reactlynx/` must declare `requires: ["reactlynx"]`.
- FR-5: `rl-no-dom-globals` must flag reads/writes of `window`, `document`, `localStorage`, `sessionStorage`, `navigator` when resolved to the global, and must skip them when shadowed by a local binding.
- FR-6: `rl-no-onclick-on-builtin` must flag `onClick` JSX attributes on lowercase Lynx built-in element tags and must not flag capitalized component tags or web-DOM lowercase tags.
- FR-7: `rl-no-async-in-main-thread` must flag `async` modifier, `AwaitExpression`, and `new Promise(…)` inside any function detected by `isMainThreadFunction`.
- FR-8: `rl-prefer-main-thread-ref` must flag `useRef(…)` inside a main-thread function unless the call is inside a `runOnBackground(…)` callback.
- FR-9: `rl-main-thread-directive` must flag calls to identifiers that resolve to `useState` / `useReducer` setters inside a main-thread function unless wrapped in `runOnBackground(…)`.

**Capability gating**

- FR-10: A `reactlynx:<major>.<minor>` capability gate may be added in `runners/oxlint/capabilities.ts`, mirroring the `react:19.2` pattern. **Floor is `@lynx-js/react@0.103.0`** (lowest version the current `@lynx-js/react-rsbuild-plugin@0.16.3` accepts as a peer). Capability strings use the `<major>.<minor>` form, e.g. `reactlynx:0.121`; the ladder iterates `EARLIEST_GATED_REACTLYNX_MINOR` through `min(project.reactlynxMinor, LATEST_KNOWN_REACTLYNX_MINOR)` to clamp implausible specs (same clamp rationale as the React and Preact ladders in `capabilities.ts`).
- FR-11: Rules audited in M2 as React-DOM-assuming must declare `disabledBy: ["reactlynx"]`.
- FR-12: The `reactlynx` capability must be set whenever the root project's `framework === "reactlynx"` **OR** the project has at least one workspace package whose manifest declares `@lynx-js/react`. The second branch is gated on a new `ProjectInfo.hasReactLynxWorkspace: boolean` field — required so web-rooted monorepos with an `apps/lynx` workspace still load `rl-*` rules. (Mirrors the existing `hasReactNativeWorkspace` mechanism for the RN side.)

**File-level package boundary**

- FR-13: `classifyPackagePlatform` must return a new `"reactlynx"` value when the package manifest declares `@lynx-js/react` AND declares none of the existing `WEB_FRAMEWORK_DEPENDENCY_NAMES` AND fails `isReactNativeDependencyName` / `isExpoManagedDependencyName`. The file-level gate must use this value to silence non-Lynx rules in Lynx packages and silence `rl-*` rules in non-Lynx packages.

**Surface neutrality**

- FR-14: No new ReactLynx-specific score weights, no changes to `action.yml`, no new published packages.

---

## Design Considerations

- **Message tone.** Match the existing `rn-*` rules — terse problem statement + one concrete migration hint, no apology or hedging. See `rn-no-panresponder.ts` and `rn-prefer-pressable.ts` for the cadence.
- **Auto-fix.** `rl-no-onclick-on-builtin` is the only candidate for a safe rename auto-fix (`onClick` → `bindtap`). Defer to a follow-up unless oxlint's fixer API in this repo is already wired for similar renames — verify before adding.
- **Built-in element list.** Centralise in `packages/oxlint-plugin-react-doctor/src/plugin/constants/reactlynx.ts`. Confirmed against `lynxjs.org/api/elements/built-in/`:
  `view`, `text`, `image`, `scroll-view`, `list`, `list-item`, `page`, `frame`, `input`, `textarea`, `overlay`, `svg`, `refresh`, `title-bar-view`.
  Re-verify before each Lynx major; the list is small enough to maintain by hand.

---

## Success Metrics

- M1 ships behind no new flag and produces ≤0 false positives on a clean reference ReactLynx app (TBD which fixture; one of the official Lynx examples).
- After M2, an `npx react-doctor` run on a ReactLynx project produces zero diagnostics from React-DOM-assuming rules.
- M3 on a synthetic three-package monorepo (`apps/web` + `apps/mobile` + `apps/lynx`) produces only the diagnostics expected in each package's scope — verified by snapshot.
- M4 catches the three canonical main-thread bugs in a hand-written failing fixture and stays silent on the same fixture with the bugs fixed.
- M5 hard-errors on any RL2 signal in the migration fixture and stays silent on a clean RL3 project.

---

## Open Questions

1. ~~**Floor `@lynx-js/react` version.**~~ **Resolved:** `@lynx-js/react@0.103.0`. This is the lowest version the current `@lynx-js/react-rsbuild-plugin@0.16.3` accepts in its peer range (`^0.103.0 || … || ^0.121.0`). Rules requiring newer APIs declare `requires: ["reactlynx:<major>.<minor>"]` per FR-10.
2. **Auto-fix policy for `rl-no-onclick-on-builtin`.** Safe rename to `bindtap` by default, or too risky given the `bindtap` vs `catchtap` semantic split (the user may have wanted the cancelling variant)? Recommendation: ship without auto-fix in M1, revisit once we see real false-fix reports.
3. **Decision 4B (`check-rl2-rl3-migration-debt` = error) revisit.** If the diagnostic fires on actively-being-migrated projects mid-flight, maintainers may want a config opt-out flag. Out of scope for initial implementation, but flag-worthy.
4. ~~**Built-in element list freshness.**~~ **Resolved (for now):** manual sync from `lynxjs.org/api/elements/built-in/` at each Lynx major. The list is short (14 elements) and changes rarely. A generator over `@lynx-js/react`'s emitted JSX types is a possible future improvement but not justified at this volume.
5. **Reanimated-style cross-thread API discovery.** Does the existing `hasReanimated` workspace walk have a Lynx analog (e.g. `hasMainThreadRefs` keyed off `@lynx-js/react` importing `useMainThreadRef`)? If so, gate M4 rules on it for more precision; if not, defer.
6. **`item-key` vs `key`.** For US in a later milestone (rl-list-requires-item-key, deferred from the brainstorm), the doc confirms `item-key` is required on `<list-item>` for recycling. The rule needs to flag a `<list-item>` whose parent `<list>` is in scope and which is missing `item-key`. Worth a separate spike to confirm whether `<list>` requires `item-key` only on direct `<list-item>` children or on any deeply-nested child (Lynx's reconciler walks the subtree differently from React DOM).

---

## Implementation order (recommendation)

Per AGENTS.md "MUST: Always search the codebase, think of many solutions, then implement the most _elegant_ solution," each milestone starts with a truffler search for the symbols about to be added.

1. M1 → US-1.0 first (codegen / type wiring; everything else blocks on it) → US-1.1 + US-1.2 + US-1.3 in parallel
2. M2 → US-2.1 (audit doc first, then mechanical edits)
3. M3 → US-3.0 (M0 follow-up: `hasReactLynxWorkspace`) → US-3.1 (`classify-package-platform.ts`)
4. M4 → US-4.0 helper first (verify oxc's `ExpressionStatement.directive` shape against a real fixture before writing the helper), then US-4.1 + US-4.2 + US-4.3 in parallel on top of the same helper
5. M5 → US-5.1

Each milestone should be its own PR against the `reactlynx-support` branch on the Huxpro fork, then opened upstream against `millionco/react-doctor` once the maintainers have signed off on the M0 framework-detection PR.

---

## References

External references this PRD relies on (verify before each Lynx-major bump):

- Lynx built-in elements: https://lynxjs.org/api/elements/built-in/ (`view`, `text`, `image`, `scroll-view`, `list`, `list-item`, `page`, `frame`, `input`, `textarea`, `overlay`, `svg`, `refresh`, `title-bar-view`).
- Main-thread script directive shape (`'main thread'` as a directive prologue): https://lynxjs.org/react/main-thread-script.html.
- `<list-item>` requires `item-key` for recycling: https://lynxjs.org/api/elements/built-in/list.html.
- Current `@lynx-js/react-rsbuild-plugin@0.16.3` peer range for `@lynx-js/react`: `^0.103.0 || ^0.104.0 || … || ^0.121.0` (from `npm view @lynx-js/react-rsbuild-plugin peerDependencies`, captured at PRD-write time).
- Lynx monorepo (for AST + example fixtures during US-4.0): https://github.com/lynx-family/lynx-stack.
- M0 commit on the Huxpro fork: `Huxpro/react-doctor:reactlynx-support` HEAD (commit `33f2ebf4` at the time this PRD was written; refresh via `git log --oneline upstream/main..origin/reactlynx-support` if the branch has been rebased).

Internal references:

- Project-level check shape: `packages/core/src/check-react-native-project.ts`, `packages/core/src/checks/react-native/`, `packages/core/src/checks/expo/`.
- Oxlint rule shape: `packages/oxlint-plugin-react-doctor/src/plugin/rules/react-native/*.ts`.
- Capability ladder: `packages/core/src/runners/oxlint/capabilities.ts` (look for the `react:<major>` and `preact:<major>` loops as the model for `reactlynx:<minor>`).
- File-level package classification: `packages/oxlint-plugin-react-doctor/src/plugin/utils/classify-package-platform.ts`.
- Code conventions: `AGENTS.md` ("Engineering Principles", "Effect v4 Conventions", "Symbol Search & Deduplication").
