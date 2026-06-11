# ReactLynx Rules Reference

User-facing reference for every ReactLynx-specific check and lint
rule shipped by react-doctor on the `reactlynx-support` branch.
Grouped to match the categories used by the
[`reactlynx-best-practices`](https://github.com/lynx-community/skills/tree/main/reactlynx-best-practices)
skill so the boundary between "lints we enforce" and "guidance the
skill provides" is legible at a glance. Each entry shows a bad
case (what triggers the rule) and a good case (what to do instead).

For the rule-authoring framework itself, see
[`HOW_TO_WRITE_A_RULE.md`](./HOW_TO_WRITE_A_RULE.md).

## Background

ReactLynx splits execution across two runtimes:

- **Main thread** — runs render bodies, evaluates JSX, dispatches
  synchronous UI updates. No DOM, no microtask scheduler.
- **Background thread** — runs effect hooks
  (`useEffect`/`useLayoutEffect`/`useImperativeHandle`), event
  handlers (`bindtap`/`catchtap`/…), and native-module calls.

Most ReactLynx footguns are dual-thread boundary errors: code that
assumed one runtime but executes on the other. Rules below are
gated on the `reactlynx` capability (project framework detected as
`reactlynx`, or any workspace declares `@lynx-js/react`) and on
the package boundary (`apps/lynx` in a mixed monorepo classifies
as `reactlynx`; web siblings don't).

---

## Project-level checks

These run once per project against the manifest / filesystem, not
per file. They live under `packages/core/src/checks/reactlynx/`.

### `rl-engine-versions-mismatch`

Severity: error.

The three `@lynx-js` engine packages ship in lockstep. A partial
install fails at build or first render with errors that look like
config bugs.

**Bad** — `@lynx-js/react` declared without the build packages:

```json
{
  "dependencies": { "@lynx-js/react": "^0.121.0" }
}
```

**Good** — all three present together:

```json
{
  "dependencies": { "@lynx-js/react": "^0.121.0" },
  "devDependencies": {
    "@lynx-js/rspeedy": "^0.14.0",
    "@lynx-js/react-rsbuild-plugin": "^0.16.0"
  }
}
```

### `rl-no-reactlynx-2-residue`

Severity: error.

ReactLynx 2 → 3 was a hard break. Residue from the RL2 stack
(`lepus.js`, `card.json`, `lynx-speedy`) silently degrades RL3
diagnostics or breaks the build. Fix path is the
[`migrax-planner-rl3`](https://github.com/lynx-community/skills)
migration skill.

**Bad** — any of these signals:

```
project/
├── lepus.js              # RL2 entry point
├── src/lepus.js          # ditto, src layout
├── card.json             # RL2 card manifest
└── package.json
    └── { "dependencies": { "lynx-speedy": "^2.0.0" } }
```

**Good** — clean RL3 install, no residue from above.

---

## Static lint rules

Rules grouped by the
[`reactlynx-best-practices`](https://github.com/lynx-community/skills/tree/main/reactlynx-best-practices/rules)
skill category. Each rule's `id` is the public id you put in
`doctor.config.ts`; each is gated `requires: ["reactlynx"]`.

### Category: Background-only API guarding

Skill rule: [`detect-background-only`](https://github.com/lynx-community/skills/blob/main/reactlynx-best-practices/rules/detect-background-only.md)
(CRITICAL).

#### `rl-no-background-only-api-in-render`

Severity: error. Ports the skill rule into oxlint.

`lynx.getJSModule(...)` and `NativeModules.*` only work on the
background thread. Calling them from render scope (component body,
helpers reachable from render, top-level module code) is a
silent no-op at best and a thread-context violation at worst.

**Bad** — called in render scope:

```tsx
export function App() {
  const module = lynx.getJSModule('SomeModule'); // ❌
  NativeModules.Analytics.track('view');         // ❌
  return <view />;
}
```

**Good** — in any of: `useEffect` / `useLayoutEffect` /
`useImperativeHandle`, a `'background only'` function, an inline
event/ref handler, or a named function referenced from a
`bind*`/`catch*`/`ref` JSX attribute:

```tsx
export function App() {
  useEffect(() => {
    lynx.getJSModule('SomeModule').doSomething(); // ✅ inside useEffect
  }, []);

  return (
    <view bindtap={() => NativeModules.Analytics.track('tap')}>  {/* ✅ inline */}
      <text>x</text>
    </view>
  );
}
```

**Good** — `'background only'` directive opt-in:

```tsx
function doBackgroundWork() {
  'background only';
  return lynx.getJSModule('UserAPI').getUser(); // ✅
}
```

Note: a `main-thread:bindtap` handler runs on the main thread by
design and is **not** an escape hatch — calling background-only
APIs from there still flags.

### Category: Host-element conventions

Skill rule: [`proper-event-handlers`](https://github.com/lynx-community/skills/blob/main/reactlynx-best-practices/rules/proper-event-handlers.md)
(MEDIUM).

#### `rl-no-onclick-on-builtin`

Severity: error.

Lynx host elements (`<view>`, `<text>`, `<list>`, `<scroll-view>`, …)
only dispatch `bind*` / `catch*` events. `onClick` silently no-ops
on host elements — the handler never fires. Worse than a crash:
the user thinks their button works.

**Bad**:

```tsx
<view onClick={handleTap}>Tap me</view>
```

**Good** — use `bindtap` (bubbling) or `catchtap` (stops
propagation):

```tsx
<view bindtap={handleTap}>Tap me</view>
<view catchtap={handleTap}>Tap me, don't bubble</view>
```

User components (capitalized tags) and web-DOM tags (`<div>`,
`<button>`, …) are allowed — they may legitimately accept `onClick`
as a custom prop, or the file may be a web package in a mixed
monorepo where the M3 file-level boundary already silences this rule.

### Category: Main-thread directive guarding

Skill rule: [`main-thread-scripts-guide`](https://github.com/lynx-community/skills/blob/main/reactlynx-best-practices/rules/main-thread-scripts-guide.md)
(MEDIUM).

The skill describes the `'main thread'` directive's runtime model;
the three rules below enforce the constraints that flow from it.

#### `rl-no-async-in-main-thread`

Severity: error.

The main thread has no microtask scheduler. `async` / `await` /
`new Promise(...)` inside a `'main thread'`-tagged function are
silently dropped on the floor.

**Bad**:

```tsx
const onTap = async (event) => {
  'main thread';
  await doSomething();              // ❌
  return new Promise((r) => r(1));  // ❌
};
```

**Good** — drop the directive, or hop to background:

```tsx
const onTap = (event) => {
  'main thread';
  runOnBackground(async () => {
    await doSomething();          // ✅ runs on background thread
  })();
};
```

#### `rl-prefer-main-thread-ref`

Severity: error.

`useRef(...)` allocates a React state ref on the background thread
— a `'main thread'`-tagged function reading `.current` synchronously
gets stale (or undefined) data. ReactLynx ships `useMainThreadRef`
for refs that need to live in main-thread scope.

**Bad**:

```tsx
function App() {
  const ref = useRef(null);
  const onTap = () => {
    'main thread';
    ref.current?.setStyleProperty('background-color', 'red'); // ❌ background-ref
  };
  return <view main-thread:bindtap={onTap}><text ref={ref}>x</text></view>;
}
```

**Good**:

```tsx
import { useMainThreadRef } from '@lynx-js/react';

function App() {
  const ref = useMainThreadRef(null);
  const onTap = () => {
    'main thread';
    ref.current?.setStyleProperty('background-color', 'red'); // ✅ main-thread ref
  };
  return <view main-thread:bindtap={onTap}><text main-thread:ref={ref}>x</text></view>;
}
```

If you genuinely want the background ref inside a main-thread
function, the escape hatch is `runOnBackground(() => useRef(...))`.

#### `rl-main-thread-directive`

Severity: error.

`useState` / `useReducer` setters mutate background-thread state.
Calling them from a `'main thread'`-tagged function is a silent
no-op — the call returns but the state never updates.

**Bad**:

```tsx
function Counter() {
  const [count, setCount] = useState(0);
  const onTap = () => {
    'main thread';
    setCount(count + 1); // ❌ no state update
  };
  return <view main-thread:bindtap={onTap}>{count}</view>;
}
```

**Good** — `runOnBackground(...)` to hop back to the thread that
owns the setter:

```tsx
function Counter() {
  const [count, setCount] = useState(0);
  const onTap = () => {
    'main thread';
    runOnBackground(() => setCount((c) => c + 1))(); // ✅
  };
  return <view main-thread:bindtap={onTap}>{count}</view>;
}
```

### Category: Dual-thread footguns (no direct skill counterpart)

#### `rl-no-dom-globals`

Severity: error.

ReactLynx runs on a non-DOM runtime. `window` / `document` /
`localStorage` / `sessionStorage` / `navigator` throw `ReferenceError`
at runtime.

**Bad**:

```tsx
function App() {
  const userAgent = navigator.userAgent;          // ❌
  localStorage.setItem('seen', '1');              // ❌
  if (typeof window !== 'undefined') doStuff();   // ❌ — well, no, this part is fine
  return <view />;
}
```

The `typeof window` idiom is recognised and not flagged (it's the
canonical safe-feature-detect form). Local shadows are also
respected:

**Good** — shadowed or property-position:

```tsx
function App({ navigator }) {              // ✅ shadowed param
  const obj = { window: 1 };               // ✅ object-literal key
  const ua = obj.navigator?.userAgent;     // ✅ property-position
  return <view />;
}
```

**Replace** the real cases with `lynx.*` equivalents:

```tsx
function App() {
  useEffect(() => {
    const info = lynx.getSystemInfo();      // ✅ replaces navigator/window info
    lynx.setStorage({ key: 'seen', data: '1' }); // ✅ replaces localStorage
  }, []);
  return <view />;
}
```

---

## Rules disabled on ReactLynx

The M2 audit determined that 36 `a11y/*` rules plus
`react-builtins/no-unknown-property` carry hard-coded HTML/ARIA /
React-DOM semantics that don't translate to Lynx host elements.
They're gated off via `disabledBy: ["reactlynx"]` and won't fire
on Lynx code or in `apps/lynx` workspaces of a mixed monorepo.
Full list and rationale in
[`tasks/audit-reactlynx-disabled-rules.md`](../tasks/audit-reactlynx-disabled-rules.md).

---

## Enforceable vs. non-enforceable subsets per skill rule

The skill ships four rules. One ports cleanly into oxlint; the
other three have substantial guidance that doesn't lower to AST
patterns without false positives. Below: for each skill rule,
which static check we ship (with the good/bad shape) and what
guidance we leave to the skill / docs because we can't prove it.

### `detect-background-only` (CRITICAL)

| Subset | Status | Reasoning |
|--------|--------|-----------|
| `lynx.getJSModule(...)` / `NativeModules.*` in render scope | **Enforced** by `rl-no-background-only-api-in-render` | Identifier shape + ancestor-walk for BG contexts (useEffect, `'background only'`, inline JSX handlers) is decidable from AST without semantic analysis. |
| BG APIs reachable from render via dynamic dispatch (`const fn = condition ? bgFn : noop; fn();`) | **Not enforced** | Decidable shape would require flow analysis through arbitrary control flow and call graph reasoning across files. Evidence: the skill's reference implementation also stops at lexical ancestry. Runtime smoke (`scripts/verify-reactlynx-runtime.mjs`) is the catch. |
| BG APIs hidden behind a typed proxy (`type Modules = typeof NativeModules; declare const m: Modules; m.X.y()`) | **Not enforced** | Identifier check sees `m`, not `NativeModules`. Type-level alias resolution requires the TS compiler. The skill doesn't catch this either. |

### `proper-event-handlers` (MEDIUM)

| Subset | Status | Reasoning |
|--------|--------|-----------|
| `onClick` on Lynx host elements | **Enforced** by `rl-no-onclick-on-builtin` | JSX attribute name vs lowercase-tag check; zero FP. |
| `target` vs `currentTarget` confusion in handler bodies | **Not enforced** | Distinguishing valid uses (often equal at runtime when no nesting) from bugs requires understanding the JSX tree's nesting depth at the call site — i.e. the same handler may be safe from one parent and wrong from another. Evidence: skill's own doc treats this as guidance, not a rule. |
| `dataset` vs closure capture as a data-passing idiom | **Not enforced** | Both work. The "use dataset" advice is a style preference: closure capture is correct but allocates a fresh handler per render, which is a separate concern handled by `jsx-no-new-function-as-prop` and React Compiler. |
| Function reference vs inline arrow (perf) | **Not enforced here** | Already covered by `jsx-no-new-function-as-prop` in the broader React-builtins rule set; no Lynx-specific variant needed. |
| `event.stopPropagation()` / `stopImmediatePropagation()` only in `'main thread'` | **Not enforced** | Decidable but very low signal: misuse would surface immediately at runtime, and Lynx's typing already segregates `MainThread.ITouchEvent`. Not worth a rule. |

### `main-thread-scripts-guide` (MEDIUM)

| Subset | Status | Reasoning |
|--------|--------|-----------|
| `async` / `await` / `new Promise(...)` in `'main thread'` fns | **Enforced** by `rl-no-async-in-main-thread` | Syntactic shape + ancestor walk. |
| `useRef` in `'main thread'` fns | **Enforced** by `rl-prefer-main-thread-ref` | Identifier check + ancestor walk. |
| `useState`/`useReducer` setters called from `'main thread'` fns | **Enforced** by `rl-main-thread-directive` | Per-file binding tracking + ancestor walk. |
| `main-thread:` event-attribute prefix when sync animation is needed | **Not enforced** | "Needs sync animation" isn't decidable from AST — depends on UX intent and target framerate. The opposite (calling main-thread-only APIs from a non-main-thread handler) is also not directly enforceable; partially covered indirectly via the BG-API rule. |
| Captured-variable JSON-serializability across the thread boundary | **Not enforced** | Requires whole-program type analysis to know which variables can / can't serialize. The skill flags this as a "Rules Summary" item without a detector. |
| "Cannot modify captured variables" inside `'main thread'` fns | **Not enforced** | Decidable as an assignment-to-outer-binding check, but FP-prone on local-scope shadows and destructured patterns. Deferred until a real-world false-negative shows up. |
| "No nested main-thread function definitions" | **Not enforced** | Rare pattern; no clear failure mode beyond confusion. Low signal. |

### `hoist-static-jsx` (LOW)

| Subset | Status | Reasoning |
|--------|--------|-----------|
| Static JSX inside component body that could be hoisted | **Not enforced** | React Compiler does this automatically. Projects with RC: redundant. Projects without RC: would be noisy on every static element ever returned, and "static enough to hoist" is a runtime question (props closed over may look constant but aren't). Evidence: the skill itself doesn't implement a detector for this rule — it only ships the doc. |

---

## Runtime smoke (out-of-band verification)

For the non-enforceable subsets above, the
[`lynx-devtool`](https://github.com/lynx-community/skills/tree/main/lynx-devtool)
skill (CDP CLI for connected Lynx devices) can sample runtime
console output. `scripts/verify-reactlynx-runtime.mjs` is an
opt-in shell-out to that CLI that grep-matches known
thread-violation patterns. It's NOT in CI — invoke manually after
building and loading your Lynx app on a connected device. Catches
the dynamic-dispatch / typed-proxy / runtime-only cases that
static rules can't prove.

---

## Appendix: static rules vs. skills

Working through the four skill rules above forced an explicit
boundary between what oxlint-style static analysis can prove
and what an agent-style skill is better at. Worth writing down,
both for the next contributor weighing a new rule and for the
M7+ planning around how this branch evolves.

### Where each one wins

| Layer | Strength | Weakness |
|-------|----------|----------|
| **Static rules** (`rl-*` in oxlint plugin) | Decidable, deterministic, zero-config, run in CI, no FP budget. One rule scales to every consumer. Caches well in editor LSP. | Bounded by the AST. Can't see runtime state, dynamic dispatch, type aliases, or "did the user actually mean this." |
| **Skills** (`reactlynx-best-practices` etc.) | Carry guidance that doesn't lower to AST (`target` vs `currentTarget`, when to use `'main thread'`). Can ask the user before applying fixes. Compose orchestration (review → refactor) and bring LLM-shaped judgement. | Per-invocation, not per-PR. Run in agent context, not CI. State of the world matters (skill installed where? at which version?). |
| **Runtime smoke** (`lynx-devtool`-backed verification) | Catches things the source can't prove: dynamic dispatch, hot-reload-stale bindings, environment drift. The ground truth for "does this run." | Requires a connected device. No CI signal. Sampling-based — coverage depends on what the device exercised. |

The three are complements, not substitutes. The dual-implementation
tax of `rl-no-background-only-api-in-render` (oxlint plugin) /
`detect-background-only` (skill) is the most concrete example: the
same rule lives in two places because each runtime targets a
different invocation context (CI vs agent), but the semantic
intent is identical. That's a smell worth designing away.

### Today's gaps

1. **Dual sources of truth.** The skill's `detect-background-only`
   and our `rl-no-background-only-api-in-render` are independently
   maintained. A change to the recognized BG-context list (say,
   adding a new effect-hook name) has to land in both. Skill ports
   are not a one-time event; they drift.

2. **`recommendation` is free-text.** Each `rl-*` rule's
   recommendation tells you _what_ to do but doesn't link to an
   executable fixer. A reader has to know the skill exists, find it,
   invoke it. The link from `rl-no-background-only-api-in-render`'s
   diagnostic to `reactlynx-best-practices`'s `refactor` mode (which
   could apply the fix automatically) is implicit — only mentioned
   in this doc, not surfaced in the CLI output.

3. **Asymmetric severity treatment.** A static rule fires at a
   fixed severity (`error` for everything in the rl-* family today).
   A skill running in `review` mode might downgrade severity based
   on runtime context the lint can't see (e.g. "this `useRef` in a
   main-thread function never actually reads `.current` so the
   prefer-main-thread-ref warning is moot"). We have no contract
   for that downgrade signal to flow back.

4. **Skill rules-as-docs orphaned from any verifier.** The skill
   ships four rules but only implements a detector for one. The
   other three are markdown guidance. Nothing prevents drift between
   the prose and reality — if the `main-thread:` attribute syntax
   changes, the doc stays stale until a human notices.

5. **No shared schema for "rule" across surfaces.** A rule today
   exists as: a TypeScript object in the oxlint plugin, a markdown
   file under the skill's `rules/`, optionally an ast-grep query in
   the skill's scripts. They share a name but no structure.

### Evolution directions

These are sketches, not commitments — the goal is to surface where
this could go so future planning has a target.

1. **Structured `recommendation` → skill invocation.** Extend
   the `Rule` interface so `recommendation` can carry a structured
   pointer:
   ```ts
   recommendation: {
     prose: "Move the call into useEffect / 'background only' / …",
     skill: { name: "reactlynx-best-practices", mode: "refactor" },
   }
   ```
   The CLI / GitHub Action surface can then suggest "ask the
   `reactlynx-best-practices` skill to fix this" with a one-shot
   command. Each diagnostic becomes its own auto-fix entry point.

2. **One source of truth for ported rules.** Pull the rule's
   detection contract (recognized patterns, BG-context list,
   message templates) into a shared JSON spec the oxlint rule and
   the skill's ast-grep walk both consume. Updating the list of
   recognized effect hooks in one place propagates to both. The
   work to define the JSON shape is the cost; the saving is no
   drift after that.

3. **Skill mode flows back into severity.** A skill that runs
   `lynx-devtool` during review could attach metadata to the scan
   result: "this rl-prefer-main-thread-ref instance never reads
   `.current` on the runtime path." The next CI run could honor
   that as a per-instance suppression — explicit, traceable, with
   a known origin.

4. **Static rule as triage filter; skill as fix author.** For
   higher-FP rules (the non-enforced subsets in the tables above),
   we could ship a low-severity heuristic rule that defers the
   decision to the skill: "this looks like a `target`/`currentTarget`
   confusion — `reactlynx-best-practices` in review mode will
   confirm or dismiss." The static rule's job becomes "narrow the
   search space," not "make the call."

5. **Skill rules + sample code as auto-test fixtures.** The skill's
   `rules/*.md` already contain "incorrect" / "correct" code blocks.
   A small extractor could compile those into oxlint fixtures
   automatically — so the day a skill rule lands a new bad case,
   the corresponding `rl-*` rule must turn green on it before the
   PR merges. Aligns reality with prose by construction.

6. **Runtime verification as a CI signal.** `scripts/verify-reactlynx-runtime.mjs`
   is opt-in today because no CI has a Lynx device. As Lynx test
   infra matures (simulator-based CI, e.g. via the
   `serve-sim` / `lynx-devtool` chain), the script becomes a real
   build-gate — and the "dynamic dispatch" / "typed proxy" gaps
   in our static rules stop being silent.

7. **Bidirectional invocation.** Editor integration where a static
   rule's diagnostic carries a "Run skill" code-action could close
   the loop: the rule identifies the location, the skill explains
   _why_ (with the rule doc) and offers to apply the fix, the
   editor records the user's choice. Today there are three
   manual hops; tomorrow it's a click.

### The underlying tendency

Static analysis and agent-style skills are converging on
**layered, complementary checks**: static for the decidable
broad strokes, skills for context and judgement, runtime smoke for
the things only execution can prove. The pieces already exist on
this branch in skeletal form; the next architecture move is the
contract between them — schema, severity flow, fixture sharing —
so adding a new ReactLynx footgun is a single coordinated update
across the three layers, not a triple-write across disjoint repos.
