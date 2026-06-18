<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/react-doctor-readme-logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="./assets/react-doctor-readme-logo-light.svg">
  <img alt="React Doctor" src="./assets/react-doctor-readme-logo-light.svg" width="134" height="36">
</picture>

[![version](https://img.shields.io/npm/v/react-doctor?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/react-doctor)
[![downloads](https://img.shields.io/npm/dt/react-doctor.svg?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/react-doctor)

Your agent writes bad React, this catches it.

React Doctor deterministically scans your codebase and finds issues across state & effects, performance, architecture, security, and accessibility.

Works for all React frameworks and libraries - Next.js, Vite, TanStack, React Native, Expo, ReactLynx, you name it.

[Website →](https://react.doctor/docs)

> _Extension branch._ This `reactlynx-support` branch adds a layer of [ReactLynx](https://lynxjs.org)-specific checks on top of upstream react-doctor — see [ReactLynx extension](#reactlynx-extension) below. Everything else is upstream; for the canonical project go to [react.doctor](https://react.doctor) / [millionco/react-doctor](https://github.com/millionco/react-doctor).

## Install

### 1. Quick start

Run this at your project root to get an audit.

```bash
npx react-doctor@latest
```

https://github.com/user-attachments/assets/07cc88d9-9589-44c3-aa73-5d603cb1c570

### 2. Install for agents

Once you have an audit, you can install the skill for your coding agent to learn from the issues and fix them in the future.

```bash
npx react-doctor@latest install
```

Works with Claude Code, Cursor, Codex, OpenCode, and many more.

### 3. Run in CI (GitHub Actions) for your team

[![GitHub Action](https://img.shields.io/badge/GitHub%20Action-React%20Doctor-000000?style=flat&labelColor=000000&logo=githubactions&logoColor=white)](https://github.com/marketplace/actions/react-doctor)

Add the reusable GitHub Action from Marketplace to scan every pull request, show inline annotations, and leave findings where reviewers already look.

```yaml
name: React Doctor

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

permissions:
  contents: read
  pull-requests: write
  issues: write

concurrency:
  group: react-doctor-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  react-doctor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: millionco/react-doctor@v1
```

`@v1` always resolves to the latest `v1.x` release of the Action. For hardened CI — recommended whenever the workflow is granted `pull-requests: write` — pin to a full commit SHA instead and let Dependabot or Renovate keep it current:

```yaml
- uses: millionco/react-doctor@b612664043a9be414166e3c6a69b355e39a8dcf4 # v1.1.1
```

[Add GitHub Action →](https://github.com/marketplace/actions/react-doctor)

### 4. Configure rules in `doctor.config.ts`

Configure with a `doctor.config.ts` (or `.js`, `.mjs`, `.cjs`, `.json`, `.jsonc`) in your project root.

```ts
// doctor.config.ts
import type { ReactDoctorConfig } from "react-doctor/api";

export default {
  lint: true,
  rules: {
    "react-doctor/no-array-index-as-key": "off",
  },
} satisfies ReactDoctorConfig;
```

Prefer JSON? Use `doctor.config.json`:

```jsonc
{
  "$schema": "https://react.doctor/schema/config.json",
  "lint": true,
}
```

## ReactLynx extension

Everything above is upstream react-doctor. This section is the extension this branch adds: first-class detection, lint rules, and project-level checks for [ReactLynx](https://lynxjs.org) — React semantics on a dual-thread runtime, no DOM, custom host elements like `<view>` and `<text>`.

It auto-engages when `@lynx-js/react` is found. The extension adds 7 ReactLynx-specific checks (`rl-*`) and silences 36 DOM-/ARIA-only rules that would false-positive on Lynx host elements. Mixed monorepos work — `apps/lynx` gets the ReactLynx rules; web siblings keep the React-DOM rules.

```bash
npx react-doctor@latest
# → framework: reactlynx · hasReactLynxWorkspace: true
# → no false positives on bindtap, <view>, or the dual-thread runtime
```

What the `rl-*` rules catch — things React tooling can't see but Lynx crashes on:

- `setX(...)` from a `'main thread'` closure — silent no-op, state lives on background thread
- `useRef` from a `'main thread'` function — returns a background-thread ref
- `async` / `await` / `new Promise(...)` inside `'main thread'` code — no microtask scheduler
- `window`, `document`, `localStorage`, `navigator` — undefined under Lynx
- `onClick` on a Lynx built-in element — use `bindtap` / `catchtap`
- A partially-installed `@lynx-js/*` engine trio — must ship in lockstep
- ReactLynx 2 residue — `lepus.js`, `card.json`, `lynx-speedy` deps

Full rule list with good/bad samples → [`docs/REACTLYNX_RULES.md`](../../docs/REACTLYNX_RULES.md). Design narrative (M0–M6 milestones, harness-engineering notes) → [`tasks/prd-reactlynx-checks.md`](../../tasks/prd-reactlynx-checks.md). Hackathon deck for this extension → [`docs/hackathon-presentation/`](../../docs/hackathon-presentation/).

## Telemetry

The CLI reports crashes, basic run traces, and anonymous usage counters to [Sentry](https://sentry.io/) to help us fix bugs and prioritize work.

We collect:

- Environment: CLI version, platform, Node version
- Invocation: which command, package manager, and run context (whether it's local vs. CI vs. coding agent)
- Project shape: framework, React version, TypeScript, project size NO file contents)
- Rules fired: rule names and counts only (e.g. `react-doctor/no-array-index-as-key`) (NO code or specific findings)
- De-minified React Doctor CLI stack traces

To opt out, run: `npx react-doctor@latest --no-telemetry`

## Contributing

[Issues welcome!](https://github.com/millionco/react-doctor/issues) — upstream is the canonical project. For issues specific to the ReactLynx extension on this branch, see [Huxpro/react-doctor/issues](https://github.com/Huxpro/react-doctor/issues).

MIT-licensed
