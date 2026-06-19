"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Copy, Check, ChevronRight, RotateCcw } from "lucide-react";

// next/image with `images.unoptimized: true` does not auto-prepend
// the configured `basePath` to absolute src URLs, so the favicon would
// 404 under GitHub Pages. Build the asset URL by hand.
const FAVICON_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/favicon.svg`;
import { PERFECT_SCORE, RUN_COMMAND } from "@/constants";
import { getDoctorFace } from "@/utils/get-doctor-face";
import { getScoreColorClass } from "@/utils/get-score-color-class";
import { getScoreLabel } from "@/utils/get-score-label";

const COPIED_RESET_DELAY_MS = 2000;
const INITIAL_DELAY_MS = 250;
const TYPING_DELAY_MS = 25;
const POST_COMMAND_DELAY_MS = 350;
const POST_VERSION_DELAY_MS = 250;
const DIAGNOSTIC_MIN_DELAY_MS = 60;
const DIAGNOSTIC_MAX_DELAY_MS = 140;
const SCORE_REVEAL_DELAY_MS = 250;
const SCORE_FRAME_COUNT = 20;
const SCORE_FRAME_DELAY_MS = 30;
const POST_SCORE_DELAY_MS = 300;
const TARGET_SCORE = 23;
const SCORE_BAR_WIDTH_MOBILE = 15;
const SCORE_BAR_WIDTH_DESKTOP = 30;
const TOTAL_ISSUE_COUNT = 21;
const TOTAL_SOURCE_FILE_COUNT = 2;
const AFFECTED_FILE_COUNT = 2;
const ELAPSED_TIME = "7.0s";

const ANIMATION_COMPLETED_KEY = "react-doctor-reactlynx-animation-completed";
// Primary CTA points at the canonical upstream project. The fork is the
// extension's home; the upstream is the home of react-doctor itself.
const GITHUB_URL = "https://github.com/millionco/react-doctor";
const EXTENSION_FORK_URL =
  "https://github.com/Huxpro/react-doctor/tree/reactlynx-support";
const UPSTREAM_SITE_URL = "https://react.doctor";
const GITHUB_ICON_PATH =
  "M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z";

interface RuleDiagnostic {
  ruleKey: string;
  severity: "error" | "warning";
  message: string;
  help: string;
  count: number;
  location: string;
}

const DIAGNOSTICS: RuleDiagnostic[] = [
  {
    ruleKey: "react-doctor/rl-no-async-in-main-thread",
    severity: "error",
    message: "`await` is not available inside a `'main thread'` function — there's no microtask scheduler on the main thread.",
    help: "Drop the directive so the function runs on the background thread, or wrap async work in `runOnBackground(() => { ... })`.",
    count: 3,
    location: "src/app.tsx:14",
  },
  {
    ruleKey: "react-doctor/rl-main-thread-directive",
    severity: "error",
    message: "Main-thread closure over a background-thread state setter — `setCount` was produced by `useState`, calling it from a `'main thread'` function is a silent no-op.",
    help: "Wrap the setter call: `runOnBackground(() => setCount(...))`.",
    count: 1,
    location: "src/app.tsx:9",
  },
  {
    ruleKey: "react-doctor/rl-prefer-main-thread-ref",
    severity: "error",
    message: "`useRef` inside a `'main thread'` function reads from the background thread — the ref never reflects main-thread state.",
    help: "Use `useMainThreadRef` from `@lynx-js/react` instead.",
    count: 1,
    location: "src/app.tsx:10",
  },
  {
    ruleKey: "react-doctor/rl-no-dom-globals",
    severity: "error",
    message: "`window` / `document` / `localStorage` / `navigator` are undefined under Lynx — first access crashes.",
    help: "Use platform-appropriate APIs from `@lynx-js/react` instead of DOM globals.",
    count: 3,
    location: "src/app.tsx:24",
  },
  {
    ruleKey: "react-doctor/rl-no-onclick-on-builtin",
    severity: "error",
    message: "`onClick` on Lynx built-in element `<text>` — host elements use `bindtap` / `catchtap`, the handler never fires.",
    help: "Replace `onClick={...}` with `bindtap={...}` (bubbling) or `catchtap={...}` (stopped).",
    count: 2,
    location: "src/app.tsx:30",
  },
  {
    ruleKey: "react-doctor/rl-engine-versions-mismatch",
    severity: "error",
    message: "Incomplete ReactLynx install: `@lynx-js/react` is present but `@lynx-js/rspeedy`, `@lynx-js/react-rsbuild-plugin` are missing — the three engine packages ship in lockstep.",
    help: "Add the missing packages to your manifest at compatible versions.",
    count: 1,
    location: "package.json",
  },
  {
    ruleKey: "react-doctor/rl-no-reactlynx-2-residue",
    severity: "error",
    message: "ReactLynx 2 residue detected (`lepus.js`, `card.json`, `lynx-speedy`) — RL2 → RL3 was a hard break.",
    help: "Run the `migrax-planner-rl3` skill to migrate to ReactLynx 3 (`@lynx-js/react` + Rspeedy).",
    count: 3,
    location: "lepus.js · card.json · package.json",
  },
];

const easeOutCubic = (progress: number) => 1 - Math.pow(1 - progress, 3);

const sleep = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const timeoutId = setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, milliseconds);
    const handleAbort = () => {
      clearTimeout(timeoutId);
      reject(signal.reason);
    };
    signal.addEventListener("abort", handleAbort, { once: true });
  });

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

const Spacer = () => <div className="min-h-[1.4em]" />;

const FadeIn = ({ children }: { children: React.ReactNode }) => (
  <div className="animate-fade-in">{children}</div>
);

const ScoreBar = ({ score, barWidth }: { score: number; barWidth: number }) => {
  const filledCount = Math.round((score / PERFECT_SCORE) * barWidth);
  const emptyCount = barWidth - filledCount;
  const colorClass = getScoreColorClass(score);

  return (
    <>
      <span className={colorClass}>{"█".repeat(filledCount)}</span>
      <span className="text-neutral-600">{"░".repeat(emptyCount)}</span>
    </>
  );
};

const BOX_TOP = "┌─────┐";
const BOX_BOTTOM = "└─────┘";

const ScoreHeader = ({ score }: { score: number }) => {
  const [eyes, mouth] = getDoctorFace(score);
  const colorClass = getScoreColorClass(score);
  const scoreLabel = getScoreLabel(score);

  return (
    <div>
      <pre className={`${colorClass} leading-tight`}>
        {`  ${BOX_TOP}\n  │ ${eyes} │\n  │ ${mouth} │\n  ${BOX_BOTTOM}`}
      </pre>
      <div className="mt-2 pl-2">
        <div>
          <span className={colorClass}>{score}</span>
          <span className="text-neutral-500">{` / ${PERFECT_SCORE}`}</span>
          {"  "}
          <span className={colorClass}>{scoreLabel}</span>
        </div>
        <div className="my-1 text-xs sm:text-sm">
          <span className="sm:hidden">
            <ScoreBar score={score} barWidth={SCORE_BAR_WIDTH_MOBILE} />
          </span>
          <span className="hidden sm:inline">
            <ScoreBar score={score} barWidth={SCORE_BAR_WIDTH_DESKTOP} />
          </span>
        </div>
        <div>
          React Doctor <span className="text-neutral-500">(https://react.doctor)</span>
        </div>
        <div className="text-neutral-500">
          ReactLynx extension{" "}
          <span className="text-neutral-600">
            (https://huxpro.github.io/react-doctor)
          </span>
        </div>
      </div>
    </div>
  );
};

const DiagnosticItem = ({ diagnostic }: { diagnostic: RuleDiagnostic }) => {
  const [isOpen, setIsOpen] = useState(false);
  const colorClass = diagnostic.severity === "error" ? "text-red-400" : "text-yellow-500";
  const icon = diagnostic.severity === "error" ? "✗" : "⚠";
  const countBadge = diagnostic.count > 1 ? `×${diagnostic.count}` : "";

  return (
    <div className="mb-1">
      <button
        onClick={() => setIsOpen((previous) => !previous)}
        className="inline-flex items-start gap-1 text-left"
      >
        <ChevronRight
          size={16}
          className={`mt-[0.35em] shrink-0 text-neutral-500 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
        />
        <span>
          <span className={colorClass}>{icon} </span>
          <span className={colorClass}>{diagnostic.ruleKey}</span>
          {countBadge && <span className="text-neutral-500">{`\u00A0${countBadge}`}</span>}
        </span>
      </button>
      <div
        className="ml-6 grid text-neutral-500 transition-[grid-template-rows,opacity] duration-200 ease-out"
        style={{
          gridTemplateRows: isOpen ? "1fr" : "0fr",
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="overflow-hidden">
          <div className="mt-1">
            <div>{diagnostic.message}</div>
            <div>→ {diagnostic.help}</div>
            <div>{diagnostic.location}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CopyCommand = () => {
  const [didCopy, setDidCopy] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(RUN_COMMAND);
    setDidCopy(true);
    setTimeout(() => setDidCopy(false), COPIED_RESET_DELAY_MS);
  }, []);

  const IconComponent = didCopy ? Check : Copy;
  const iconClass = didCopy
    ? "shrink-0 text-green-400"
    : "shrink-0 text-white/50 transition-colors group-hover:text-white";

  return (
    <div className="group flex items-center gap-4 border border-white/20 px-3 py-1.5 transition-colors hover:bg-white/5">
      <span className="select-all whitespace-nowrap text-white">{RUN_COMMAND}</span>
      <button onClick={handleCopy}>
        <IconComponent size={16} className={iconClass} />
      </button>
    </div>
  );
};

interface AnimationState {
  typedCommand: string;
  isTyping: boolean;
  showVersion: boolean;
  visibleDiagnosticCount: number;
  score: number | null;
  showCountsSummary: boolean;
  showCta: boolean;
}

const INITIAL_STATE: AnimationState = {
  typedCommand: "",
  isTyping: true,
  showVersion: false,
  visibleDiagnosticCount: 0,
  score: null,
  showCountsSummary: false,
  showCta: false,
};

const COMPLETED_STATE: AnimationState = {
  typedCommand: RUN_COMMAND,
  isTyping: false,
  showVersion: true,
  visibleDiagnosticCount: DIAGNOSTICS.length,
  score: TARGET_SCORE,
  showCountsSummary: true,
  showCta: true,
};

const didAnimationComplete = () => {
  try {
    return localStorage.getItem(ANIMATION_COMPLETED_KEY) === "true";
  } catch {
    return false;
  }
};

const markAnimationCompleted = () => {
  try {
    localStorage.setItem(ANIMATION_COMPLETED_KEY, "true");
  } catch {}
};

const Terminal = () => {
  const [state, setState] = useState<AnimationState>(INITIAL_STATE);

  useEffect(() => {
    if (didAnimationComplete()) {
      setState(COMPLETED_STATE);
      return;
    }

    const abortController = new AbortController();
    const { signal } = abortController;

    const update = (patch: Partial<AnimationState>) => {
      if (signal.aborted) return;
      setState((previous) => ({ ...previous, ...patch }));
    };

    const run = async () => {
      await sleep(INITIAL_DELAY_MS, signal);

      for (let index = 0; index <= RUN_COMMAND.length; index++) {
        update({ typedCommand: RUN_COMMAND.slice(0, index) });
        await sleep(TYPING_DELAY_MS, signal);
      }

      update({ isTyping: false });
      await sleep(POST_COMMAND_DELAY_MS, signal);

      update({ showVersion: true });
      await sleep(POST_VERSION_DELAY_MS, signal);

      for (let index = 0; index < DIAGNOSTICS.length; index++) {
        update({ visibleDiagnosticCount: index + 1 });
        const jitteredDelay =
          DIAGNOSTIC_MIN_DELAY_MS +
          Math.random() * (DIAGNOSTIC_MAX_DELAY_MS - DIAGNOSTIC_MIN_DELAY_MS);
        await sleep(jitteredDelay, signal);
      }

      await sleep(SCORE_REVEAL_DELAY_MS, signal);

      for (let frame = 0; frame <= SCORE_FRAME_COUNT; frame++) {
        update({ score: Math.round(easeOutCubic(frame / SCORE_FRAME_COUNT) * TARGET_SCORE) });
        await sleep(SCORE_FRAME_DELAY_MS, signal);
      }

      await sleep(POST_SCORE_DELAY_MS, signal);
      update({ showCountsSummary: true });

      await sleep(POST_SCORE_DELAY_MS, signal);
      update({ showCta: true });
      markAnimationCompleted();
    };

    run().catch((error) => {
      if (!isAbortError(error)) throw error;
    });

    return () => abortController.abort();
  }, []);

  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl bg-[#0a0a0a] p-6 pb-32 font-mono text-base leading-relaxed text-neutral-300 sm:p-8 sm:pb-40 sm:text-lg">
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
            href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/rules/`}
            className="text-neutral-500 underline-offset-2 hover:text-white hover:underline"
          >
            rules
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
      <div>
        <span className="text-neutral-500">$ </span>
        <span>{state.typedCommand}</span>
        {state.isTyping && <span>▋</span>}
      </div>

      {state.showVersion && (
        <FadeIn>
          <Spacer />
          <div className="flex items-center gap-2">
            <Image src={FAVICON_URL} alt="React Doctor" width={24} height={24} unoptimized />
            react-doctor
          </div>
          <div className="text-neutral-500">Your agent writes bad React, this catches it.</div>
          <Spacer />
          <div className="text-neutral-500">
            Works with Next.js, Vite, and React Native.
          </div>
          <div className="text-neutral-500">
            <span className="text-[#38ACDD]">+ ReactLynx</span>{" "}
            <span className="text-neutral-600">
              (this site — see{" "}
              <a
                href="https://react.doctor"
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:underline"
              >
                react.doctor
              </a>{" "}
              for the canonical project)
            </span>
          </div>
          <Spacer />
        </FadeIn>
      )}

      {state.visibleDiagnosticCount > 0 && (
        <div>
          {DIAGNOSTICS.slice(0, state.visibleDiagnosticCount).map((diagnostic) => (
            <FadeIn key={diagnostic.ruleKey}>
              <DiagnosticItem diagnostic={diagnostic} />
            </FadeIn>
          ))}
        </div>
      )}

      {state.score !== null && (
        <FadeIn>
          <ScoreHeader score={state.score} />
          <Spacer />
        </FadeIn>
      )}

      {state.showCountsSummary && (
        <FadeIn>
          <div>
            <span className="text-neutral-500">{"  "}</span>
            <span className="text-red-400">{TOTAL_ISSUE_COUNT} issues</span>
            <span className="text-neutral-500">
              {`  across ${AFFECTED_FILE_COUNT}/${TOTAL_SOURCE_FILE_COUNT} files  in ${ELAPSED_TIME}`}
            </span>
          </div>
          <Spacer />
        </FadeIn>
      )}

      {state.showCta && (
        <FadeIn>
          <div className="text-neutral-500">Run it on your codebase:</div>
          <Spacer />
          <div className="flex flex-wrap items-center gap-3">
            <CopyCommand />
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap border border-white/20 bg-white px-3 py-1.5 text-black transition-all hover:bg-white/90 active:scale-[0.98]"
            >
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d={GITHUB_ICON_PATH} />
              </svg>
              Star react-doctor
            </a>
            <a
              href={EXTENSION_FORK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap border border-white/20 px-3 py-1.5 text-neutral-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              ✦ ReactLynx extension →
            </a>
          </div>
        </FadeIn>
      )}

      {state.showCta && (
        <div className="mt-8">
          <button
            onClick={() => {
              try {
                localStorage.removeItem(ANIMATION_COMPLETED_KEY);
              } catch {}
              location.reload();
            }}
            className="inline-flex items-center gap-1.5 text-xs text-neutral-600 transition-colors hover:text-neutral-400"
          >
            <RotateCcw size={12} />
            Restart demo
          </button>
        </div>
      )}
    </div>
  );
};

export default Terminal;
