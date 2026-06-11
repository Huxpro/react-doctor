#!/usr/bin/env node
//
// Opt-in runtime smoke check for a ReactLynx app running on a
// connected device. Shells out to the `lynx-devtool` skill's CLI
// (https://github.com/lynx-community/skills) to:
//
//   1. Confirm at least one Lynx client is connected.
//   2. Sample the most recent session's main- and background-thread
//      console for thread-violation patterns that no static rule
//      can surface (e.g. `lynx.getJSModule` returning undefined at
//      runtime, `NativeModules` access throwing in render).
//   3. Print a pass / fail report.
//
// This script is intentionally NOT part of CI. It requires a real
// Lynx device or simulator and an active DevTool session; both are
// user-environment-specific. Add `@byted-lynx/devtool-connector`
// as a dependency if you'd prefer to drive DevTool programmatically.
//
// Usage:
//
//   node scripts/verify-reactlynx-runtime.mjs [--cli <path>]
//   LYNX_DEVTOOL_CLI=/path/to/cli node scripts/verify-reactlynx-runtime.mjs
//
// Default CLI location: `~/.claude/skills/lynx-devtool/scripts/index.mjs`.
//
// Exit codes:
//   0 — no violations sampled OR no device connected (skip).
//   1 — at least one console line matches a thread-violation pattern.
//   2 — CLI not found or unexpected error from the CLI (mis-config).

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const DEFAULT_CLI = path.join(
  homedir(),
  ".claude",
  "skills",
  "lynx-devtool",
  "scripts",
  "index.mjs",
);

// Substrings that strongly suggest a dual-thread footgun at runtime.
// Conservative on purpose — the static rule set already catches the
// cases we can prove from AST; this script is for runtime warnings
// the device emits that the linter can't see.
const VIOLATION_PATTERNS = [
  "is not defined",                      // ReferenceError on window/document/etc.
  "lynx.getJSModule is not a function",  // background-only API on main thread
  "NativeModules",                       // any error mentioning NativeModules
  "main thread",                         // any warning about the main-thread directive
  "background only",                     // any warning about the background-only directive
  "Cross-thread",                        // generic Lynx cross-thread warning prefix
];

const resolveCli = () => {
  const cliArgIndex = process.argv.indexOf("--cli");
  if (cliArgIndex !== -1 && process.argv[cliArgIndex + 1]) return process.argv[cliArgIndex + 1];
  if (process.env.LYNX_DEVTOOL_CLI) return process.env.LYNX_DEVTOOL_CLI;
  return DEFAULT_CLI;
};

const runCli = (cli, args) => {
  const result = spawnSync("node", [cli, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) {
    return { ok: false, error: result.error.message, stdout: "", stderr: "" };
  }
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
};

const parseJsonStream = (raw) => {
  // CLI emits one JSON object per line. Tolerate trailing newlines /
  // blank lines / partial output.
  const entries = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed));
    } catch {
      // Non-JSON line — log lines from `get-console` are JSON,
      // so anything else is informational. Skip.
    }
  }
  return entries;
};

const sampleConsole = (cli, thread) => {
  const result = runCli(cli, [
    "get-console",
    "--level",
    "error,warning",
    "--thread",
    thread,
    "--limit",
    "200",
  ]);
  if (!result.ok) {
    return { thread, lines: [], cliError: result.stderr || result.error || "unknown" };
  }
  return { thread, lines: parseJsonStream(result.stdout) };
};

const matchViolations = (lines) => {
  const hits = [];
  for (const entry of lines) {
    const text = JSON.stringify(entry);
    for (const pattern of VIOLATION_PATTERNS) {
      if (text.includes(pattern)) {
        hits.push({ pattern, entry });
        break;
      }
    }
  }
  return hits;
};

const main = () => {
  const cli = resolveCli();
  if (!existsSync(cli)) {
    process.stderr.write(
      `verify-reactlynx-runtime: lynx-devtool CLI not found at ${cli}.\n` +
        `Pass --cli <path> or set LYNX_DEVTOOL_CLI. See ` +
        `https://github.com/lynx-community/skills for installation.\n`,
    );
    process.exit(2);
  }

  const clients = runCli(cli, ["list-clients"]);
  if (!clients.ok) {
    process.stderr.write(
      `verify-reactlynx-runtime: \`list-clients\` failed (exit ${clients.status}).\n${clients.stderr}\n`,
    );
    process.exit(2);
  }
  const clientEntries = parseJsonStream(clients.stdout);
  if (clientEntries.length === 0) {
    process.stdout.write(
      "verify-reactlynx-runtime: no Lynx clients connected — skipping runtime smoke check.\n",
    );
    process.exit(0);
  }
  process.stdout.write(`verify-reactlynx-runtime: ${clientEntries.length} client(s) connected.\n`);

  const samples = [sampleConsole(cli, "main"), sampleConsole(cli, "background")];
  let totalHits = 0;
  for (const sample of samples) {
    if (sample.cliError) {
      process.stderr.write(
        `verify-reactlynx-runtime: get-console (thread=${sample.thread}) failed: ${sample.cliError}\n`,
      );
      continue;
    }
    const hits = matchViolations(sample.lines);
    process.stdout.write(
      `verify-reactlynx-runtime: thread=${sample.thread} — sampled ${sample.lines.length} entries, ${hits.length} match violation patterns.\n`,
    );
    for (const hit of hits) {
      const message = hit.entry.text ?? hit.entry.message ?? JSON.stringify(hit.entry);
      process.stdout.write(`  [${hit.pattern}] ${message}\n`);
    }
    totalHits += hits.length;
  }

  if (totalHits > 0) {
    process.stdout.write(
      `verify-reactlynx-runtime: FAIL — ${totalHits} thread-violation pattern(s) sampled.\n`,
    );
    process.exit(1);
  }
  process.stdout.write("verify-reactlynx-runtime: PASS — no violation patterns sampled.\n");
  process.exit(0);
};

main();
