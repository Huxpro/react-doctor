import type { Metadata } from "next";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const UPSTREAM_SITE_URL = "https://react.doctor";
const EXTENSION_FORK_URL =
  "https://github.com/Huxpro/react-doctor/tree/reactlynx-support";
const RULES_DOC_URL =
  "https://github.com/Huxpro/react-doctor/blob/reactlynx-support/docs/REACTLYNX_RULES.md";

export const metadata: Metadata = {
  title: "ReactLynx rules — React Doctor extension",
  description:
    "Every check the ReactLynx extension adds to react-doctor — 2 project-level checks + 6 static lint rules, with bad/good code samples for each.",
};

type Severity = "error" | "warning";

interface Rule {
  id: string;
  title: string;
  severity: Severity;
  intent: string;
  bad: string;
  good: string;
  notes?: string;
}

interface Category {
  id: string;
  title: string;
  blurb?: string;
  skillRule?: { name: string; impact: string; url: string };
  rules: Rule[];
}

// ────────────────────────────────────────────────────────────────────────────
// Rule data — mirrors docs/REACTLYNX_RULES.md so a reader looking at one
// understands the other. Source of truth still lives in the markdown; this
// is the skimmable, linkable, deployable surface.
// ────────────────────────────────────────────────────────────────────────────

const PROJECT_LEVEL: Category = {
  id: "project-level",
  title: "Project-level checks",
  blurb:
    "Run once per project against the manifest / filesystem. Live under packages/core/src/checks/reactlynx/.",
  rules: [
    {
      id: "rl-engine-versions-mismatch",
      title: "Engine packages ship in lockstep",
      severity: "error",
      intent:
        "The three @lynx-js engine packages must move together. A partial install fails at build or first render with errors that look like config bugs.",
      bad: `{
  "dependencies": { "@lynx-js/react": "^0.121.0" }
}`,
      good: `{
  "dependencies": { "@lynx-js/react": "^0.121.0" },
  "devDependencies": {
    "@lynx-js/rspeedy": "^0.14.0",
    "@lynx-js/react-rsbuild-plugin": "^0.16.0"
  }
}`,
    },
    {
      id: "rl-no-reactlynx-2-residue",
      title: "No ReactLynx 2 residue",
      severity: "error",
      intent:
        "ReactLynx 2 → 3 was a hard break. Residue from the RL2 stack (lepus.js, card.json, lynx-speedy) silently degrades RL3 diagnostics or breaks the build.",
      bad: `project/
├── lepus.js              # RL2 entry point
├── src/lepus.js          # ditto, src layout
├── card.json             # RL2 card manifest
└── package.json
    └── { "dependencies": { "lynx-speedy": "^2.0.0" } }`,
      good: `project/
└── package.json    # clean RL3 install, no residue above`,
      notes:
        "Fix path: the migrax-planner-rl3 migration skill at lynx-community/skills.",
    },
  ],
};

const BACKGROUND_ONLY: Category = {
  id: "background-only-api-guarding",
  title: "Background-only API guarding",
  skillRule: {
    name: "detect-background-only",
    impact: "CRITICAL",
    url: "https://github.com/lynx-community/skills/blob/main/reactlynx-best-practices/rules/detect-background-only.md",
  },
  rules: [
    {
      id: "rl-no-background-only-api-in-render",
      title: "No background-only API in render scope",
      severity: "error",
      intent:
        "lynx.getJSModule(...) and NativeModules.* only work on the background thread. Calling them from render scope (component body, helpers reachable from render, top-level module code) is a silent no-op at best and a thread-context violation at worst.",
      bad: `export function App() {
  const module = lynx.getJSModule('SomeModule'); // ❌
  NativeModules.Analytics.track('view');         // ❌
  return <view />;
}`,
      good: `export function App() {
  useEffect(() => {
    lynx.getJSModule('SomeModule').doSomething(); // ✅ inside useEffect
  }, []);

  return (
    <view bindtap={() => NativeModules.Analytics.track('tap')}>  {/* ✅ inline */}
      <text>x</text>
    </view>
  );
}

// Or, opt in with the 'background only' directive:
function doBackgroundWork() {
  'background only';
  return lynx.getJSModule('UserAPI').getUser(); // ✅
}`,
      notes:
        "A main-thread:bindtap handler runs on the main thread by design and is not an escape hatch — calling background-only APIs from there still flags.",
    },
  ],
};

const HOST_ELEMENT: Category = {
  id: "host-element-conventions",
  title: "Host-element conventions",
  skillRule: {
    name: "proper-event-handlers",
    impact: "MEDIUM",
    url: "https://github.com/lynx-community/skills/blob/main/reactlynx-best-practices/rules/proper-event-handlers.md",
  },
  rules: [
    {
      id: "rl-no-onclick-on-builtin",
      title: "No onClick on Lynx built-in elements",
      severity: "error",
      intent:
        "Lynx host elements (<view>, <text>, <list>, <scroll-view>, …) only dispatch bind* / catch* events. onClick silently no-ops on host elements — the handler never fires. Worse than a crash: the user thinks their button works.",
      bad: `<view onClick={handleTap}>Tap me</view>`,
      good: `<view bindtap={handleTap}>Tap me</view>
<view catchtap={handleTap}>Tap me, don't bubble</view>`,
      notes:
        "User components (capitalized tags) and web-DOM tags (<div>, <button>, …) are allowed — they may legitimately accept onClick as a custom prop, or the file may be a web package in a mixed monorepo where the file-level boundary already silences this rule.",
    },
  ],
};

const MAIN_THREAD: Category = {
  id: "main-thread-directive-guarding",
  title: "Main-thread directive guarding",
  blurb:
    "The 'main thread' directive opts a function into ReactLynx's main-thread runtime. The three rules below enforce the constraints that flow from it.",
  skillRule: {
    name: "main-thread-scripts-guide",
    impact: "MEDIUM",
    url: "https://github.com/lynx-community/skills/blob/main/reactlynx-best-practices/rules/main-thread-scripts-guide.md",
  },
  rules: [
    {
      id: "rl-no-async-in-main-thread",
      title: "No async / await / Promise inside 'main thread' functions",
      severity: "error",
      intent:
        "The main thread has no microtask scheduler. async / await / new Promise(...) inside a 'main thread'-tagged function are silently dropped on the floor.",
      bad: `const onTap = async (event) => {
  'main thread';
  await doSomething();              // ❌
  return new Promise((r) => r(1));  // ❌
};`,
      good: `const onTap = (event) => {
  'main thread';
  runOnBackground(async () => {
    await doSomething();          // ✅ runs on background thread
  })();
};`,
    },
    {
      id: "rl-prefer-main-thread-ref",
      title: "Use useMainThreadRef inside 'main thread' functions",
      severity: "error",
      intent:
        "useRef(...) allocates a React state ref on the background thread — a 'main thread'-tagged function reading .current synchronously gets stale (or undefined) data. ReactLynx ships useMainThreadRef for refs that live in main-thread scope.",
      bad: `function App() {
  const ref = useRef(null);
  const onTap = () => {
    'main thread';
    ref.current?.setStyleProperty('background-color', 'red'); // ❌ background ref
  };
  return <view main-thread:bindtap={onTap}><text ref={ref}>x</text></view>;
}`,
      good: `import { useMainThreadRef } from '@lynx-js/react';

function App() {
  const ref = useMainThreadRef(null);
  const onTap = () => {
    'main thread';
    ref.current?.setStyleProperty('background-color', 'red'); // ✅ main-thread ref
  };
  return <view main-thread:bindtap={onTap}><text main-thread:ref={ref}>x</text></view>;
}`,
      notes:
        "If you genuinely want the background ref inside a main-thread function, the escape hatch is runOnBackground(() => useRef(...)).",
    },
    {
      id: "rl-main-thread-directive",
      title: "No useState setters called from 'main thread' closures",
      severity: "error",
      intent:
        "useState / useReducer setters mutate background-thread state. Calling them from a 'main thread'-tagged function is a silent no-op — the call returns but the state never updates.",
      bad: `function Counter() {
  const [count, setCount] = useState(0);
  const onTap = () => {
    'main thread';
    setCount(count + 1); // ❌ no state update
  };
  return <view main-thread:bindtap={onTap}>{count}</view>;
}`,
      good: `function Counter() {
  const [count, setCount] = useState(0);
  const onTap = () => {
    'main thread';
    runOnBackground(() => setCount((c) => c + 1))(); // ✅
  };
  return <view main-thread:bindtap={onTap}>{count}</view>;
}`,
    },
  ],
};

const DUAL_THREAD: Category = {
  id: "dual-thread-footguns",
  title: "Dual-thread footguns",
  blurb: "No direct skill counterpart — caught by static analysis only.",
  rules: [
    {
      id: "rl-no-dom-globals",
      title: "No DOM globals",
      severity: "error",
      intent:
        "ReactLynx runs on a non-DOM runtime. window / document / localStorage / sessionStorage / navigator throw ReferenceError at runtime.",
      bad: `function App() {
  const userAgent = navigator.userAgent;          // ❌
  localStorage.setItem('seen', '1');              // ❌
  return <view />;
}`,
      good: `function App({ navigator }) {              // ✅ shadowed param
  const obj = { window: 1 };               // ✅ object-literal key
  if (typeof window !== 'undefined') {     // ✅ canonical feature-detect
    /* never reached on Lynx */
  }

  useEffect(() => {
    const info = lynx.getSystemInfo();              // ✅ replaces navigator
    lynx.setStorage({ key: 'seen', data: '1' });    // ✅ replaces localStorage
  }, []);
  return <view />;
}`,
      notes:
        "The typeof window idiom is recognised and not flagged. Local shadows and property-position accesses are respected.",
    },
  ],
};

const CATEGORIES: Category[] = [
  PROJECT_LEVEL,
  BACKGROUND_ONLY,
  HOST_ELEMENT,
  MAIN_THREAD,
  DUAL_THREAD,
];

// ────────────────────────────────────────────────────────────────────────────
// UI
// ────────────────────────────────────────────────────────────────────────────

const SeverityPill = ({ severity }: { severity: Severity }) => {
  const className =
    severity === "error"
      ? "border-red-400/40 bg-red-400/10 text-red-400"
      : "border-yellow-500/40 bg-yellow-500/10 text-yellow-500";
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${className}`}
    >
      {severity}
    </span>
  );
};

const CodeBlock = ({
  label,
  variant,
  children,
}: {
  label: string;
  variant: "bad" | "good";
  children: string;
}) => {
  const labelClass =
    variant === "bad"
      ? "border-red-400/40 bg-red-400/5 text-red-300"
      : "border-green-400/40 bg-green-400/5 text-green-300";
  return (
    <div className="overflow-hidden rounded border border-white/10">
      <div
        className={`border-b px-3 py-1 text-[11px] font-medium uppercase tracking-wider ${labelClass}`}
      >
        {variant === "bad" ? "✗" : "✓"} {label}
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-neutral-300 sm:text-[13px]">
        <code>{children}</code>
      </pre>
    </div>
  );
};

const RuleCard = ({ rule }: { rule: Rule }) => (
  <article
    id={rule.id}
    className="scroll-mt-8 border-b border-white/5 py-8 first:pt-2 last:border-b-0"
  >
    <header className="mb-4">
      <div className="mb-2 flex items-center gap-2 text-xs">
        <SeverityPill severity={rule.severity} />
        <a
          href={`#${rule.id}`}
          className="font-mono text-neutral-500 transition-colors hover:text-[#38ACDD]"
        >
          react-doctor/{rule.id}
        </a>
      </div>
      <h3 className="mb-2 text-lg font-medium text-neutral-100 sm:text-xl">
        {rule.title}
      </h3>
      <p className="text-sm leading-relaxed text-neutral-400 sm:text-[15px]">
        {rule.intent}
      </p>
    </header>

    <div className="grid gap-3 sm:grid-cols-2">
      <CodeBlock label="Bad" variant="bad">
        {rule.bad}
      </CodeBlock>
      <CodeBlock label="Good" variant="good">
        {rule.good}
      </CodeBlock>
    </div>

    {rule.notes && (
      <p className="mt-3 border-l-2 border-white/10 pl-3 text-xs text-neutral-500 sm:text-[13px]">
        {rule.notes}
      </p>
    )}
  </article>
);

const CategorySection = ({ category }: { category: Category }) => (
  <section
    id={category.id}
    className="scroll-mt-8 border-t border-white/10 pt-10"
  >
    <header className="mb-6">
      <h2 className="mb-2 text-2xl font-medium text-neutral-100 sm:text-3xl">
        {category.title}
      </h2>
      {category.blurb && (
        <p className="text-sm leading-relaxed text-neutral-400 sm:text-base">
          {category.blurb}
        </p>
      )}
      {category.skillRule && (
        <p className="mt-2 text-xs text-neutral-500 sm:text-sm">
          Pairs with skill rule{" "}
          <a
            href={category.skillRule.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-neutral-400 underline-offset-2 hover:text-[#38ACDD] hover:underline"
          >
            {category.skillRule.name}
          </a>{" "}
          <span className="font-mono text-neutral-600">
            ({category.skillRule.impact})
          </span>
        </p>
      )}
    </header>
    <div>
      {category.rules.map((rule) => (
        <RuleCard key={rule.id} rule={rule} />
      ))}
    </div>
  </section>
);

const Rules = () => {
  const totalRules = CATEGORIES.reduce((n, c) => n + c.rules.length, 0);

  return (
    <div className="mx-auto min-h-screen w-full max-w-4xl bg-[#0a0a0a] px-6 pt-6 pb-24 font-mono text-base leading-relaxed text-neutral-300 sm:px-8 sm:pt-8">
      {/* Top strip — same shape as the homepage's so the two pages feel like one site */}
      <div className="-mx-6 mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-6 pb-3 text-xs text-neutral-500 sm:-mx-8 sm:px-8">
        <div>
          <span className="text-[#38ACDD]">✦ ReactLynx extension</span>{" "}
          <span className="text-neutral-600">of</span>{" "}
          <a
            href={UPSTREAM_SITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-400 underline-offset-2 hover:text-white hover:underline"
          >
            react.doctor →
          </a>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={`${BASE_PATH}/`}
            className="text-neutral-500 underline-offset-2 hover:text-white hover:underline"
          >
            home
          </a>
          <a
            href={EXTENSION_FORK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-500 underline-offset-2 hover:text-white hover:underline"
          >
            source
          </a>
        </div>
      </div>

      {/* Header */}
      <header className="mb-10 sm:mb-12">
        <h1 className="mb-3 text-3xl font-medium tracking-tight text-neutral-100 sm:text-4xl">
          ReactLynx rules
        </h1>
        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-neutral-400 sm:text-base">
          Every check this extension adds on top of upstream{" "}
          <a
            href={UPSTREAM_SITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-300 underline-offset-2 hover:text-[#38ACDD] hover:underline"
          >
            react-doctor
          </a>
          . {totalRules} rules across {CATEGORIES.length} categories — auto-engaged
          when <code className="rounded bg-white/5 px-1.5 py-0.5 text-[13px]">@lynx-js/react</code>{" "}
          is found in dependencies.
        </p>
        <p className="text-xs text-neutral-500 sm:text-sm">
          Full reference (with the static-vs-skills appendix){" "}
          <a
            href={RULES_DOC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-400 underline-offset-2 hover:text-[#38ACDD] hover:underline"
          >
            docs/REACTLYNX_RULES.md →
          </a>
        </p>
      </header>

      {/* Background — dual-thread runtime sketch */}
      <section className="mb-10 rounded border border-white/10 bg-white/[0.02] p-5 sm:p-6">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-neutral-500">
          Background
        </h2>
        <p className="mb-3 text-sm leading-relaxed text-neutral-300 sm:text-[15px]">
          ReactLynx splits execution across two runtimes:
        </p>
        <ul className="ml-5 list-disc space-y-1 text-sm leading-relaxed text-neutral-400 sm:text-[15px]">
          <li>
            <span className="text-neutral-200">Main thread</span> — renders JSX, dispatches sync UI updates. No DOM, no microtask scheduler.
          </li>
          <li>
            <span className="text-neutral-200">Background thread</span> — runs effect hooks (
            <code className="rounded bg-white/5 px-1 text-[12px]">useEffect</code>,{" "}
            <code className="rounded bg-white/5 px-1 text-[12px]">useLayoutEffect</code>), event handlers (
            <code className="rounded bg-white/5 px-1 text-[12px]">bindtap</code>,{" "}
            <code className="rounded bg-white/5 px-1 text-[12px]">catchtap</code>), native-module calls.
          </li>
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400 sm:text-[15px]">
          Most ReactLynx footguns are dual-thread boundary errors: code that
          assumed one runtime but executes on the other. The rules below catch them.
        </p>
      </section>

      {/* TOC */}
      <nav className="mb-10 rounded border border-white/10 bg-white/[0.02] p-5 sm:p-6">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-neutral-500">
          Contents
        </h2>
        <ol className="space-y-1.5 text-sm sm:text-[15px]">
          {CATEGORIES.map((category) => (
            <li key={category.id}>
              <a
                href={`#${category.id}`}
                className="text-neutral-300 underline-offset-2 hover:text-[#38ACDD] hover:underline"
              >
                {category.title}
              </a>
              <span className="ml-2 text-xs text-neutral-600">
                {category.rules.length} rule{category.rules.length > 1 ? "s" : ""}
              </span>
            </li>
          ))}
          <li>
            <a
              href="#disabled-on-reactlynx"
              className="text-neutral-300 underline-offset-2 hover:text-[#38ACDD] hover:underline"
            >
              Rules disabled on ReactLynx
            </a>
            <span className="ml-2 text-xs text-neutral-600">37 silenced</span>
          </li>
        </ol>
      </nav>

      {/* Categories */}
      {CATEGORIES.map((category) => (
        <CategorySection key={category.id} category={category} />
      ))}

      {/* Disabled rules */}
      <section
        id="disabled-on-reactlynx"
        className="scroll-mt-8 mt-10 border-t border-white/10 pt-10"
      >
        <h2 className="mb-2 text-2xl font-medium text-neutral-100 sm:text-3xl">
          Rules disabled on ReactLynx
        </h2>
        <p className="text-sm leading-relaxed text-neutral-400 sm:text-base">
          The M2 audit determined that{" "}
          <span className="text-neutral-200">36 a11y/* rules</span> plus{" "}
          <code className="rounded bg-white/5 px-1.5 text-[13px]">
            react-builtins/no-unknown-property
          </code>{" "}
          bake in HTML/ARIA / React-DOM semantics that don't translate to Lynx
          host elements. They're gated off via{" "}
          <code className="rounded bg-white/5 px-1.5 text-[13px]">
            disabledBy: [&quot;reactlynx&quot;]
          </code>{" "}
          and won't fire on Lynx code or in <code className="rounded bg-white/5 px-1.5 text-[13px]">apps/lynx</code>{" "}
          workspaces of a mixed monorepo.
        </p>
        <p className="mt-3 text-sm text-neutral-500">
          Full list and rationale →{" "}
          <a
            href="https://github.com/Huxpro/react-doctor/blob/reactlynx-support/tasks/audit-reactlynx-disabled-rules.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-400 underline-offset-2 hover:text-[#38ACDD] hover:underline"
          >
            tasks/audit-reactlynx-disabled-rules.md
          </a>
        </p>
      </section>

      {/* Footer */}
      <footer className="mt-16 border-t border-white/10 pt-6 text-xs text-neutral-500">
        <p>
          React Doctor{" "}
          <span className="text-neutral-600">(react.doctor)</span>
          {" — "}
          <span className="text-neutral-400">ReactLynx extension</span>{" "}
          <span className="text-neutral-600">(huxpro.github.io/react-doctor)</span>
        </p>
        <p className="mt-1">
          See also:{" "}
          <a
            href={`${BASE_PATH}/`}
            className="text-neutral-400 underline-offset-2 hover:text-[#38ACDD] hover:underline"
          >
            extension homepage
          </a>{" "}
          ·{" "}
          <a
            href={`${BASE_PATH}/deck/`}
            className="text-neutral-400 underline-offset-2 hover:text-[#38ACDD] hover:underline"
          >
            hackathon deck
          </a>{" "}
          ·{" "}
          <a
            href={RULES_DOC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-400 underline-offset-2 hover:text-[#38ACDD] hover:underline"
          >
            full rules markdown
          </a>
        </p>
      </footer>
    </div>
  );
};

export default Rules;
