import { classifyPackagePlatform } from "./classify-package-platform.js";
import { normalizeFilename } from "./normalize-filename.js";
import { getReactDoctorStringSetting } from "./get-react-doctor-setting.js";
import type { RuleContext } from "./rule-context.js";

// Returns true when ReactLynx rules should be evaluated for `filename`.
// Mirror of `isReactNativeFileActive` — same decision shape, narrowed
// to ReactLynx-aware packages. Used by `wrapReactlynxRule` so every
// `rl-*` rule short-circuits without allocating visitors on non-Lynx
// files.
//
// Decision order (first matching row wins):
//
//   1. Nearest package.json classifies as "reactlynx" → ACTIVE.
//   2. Nearest package.json classifies as anything else (`expo` /
//      `react-native` / `web` / `unknown`) → INACTIVE. Lynx-only,
//      no `.web.tsx` / `.native.tsx`-style file-extension overrides
//      today; we can add them later if real-world Lynx codebases
//      need them.
//   3. Nearest package.json missing or unparseable (`unknown`) → fall
//      back to the project-level framework setting:
//      • `reactlynx` → ACTIVE
//      • any other known framework → INACTIVE
//      • `unknown` or missing → ACTIVE (mirrors `isReactNativeFileActive`
//        — the project-level capability gate in `runOxlint` already
//        prevents `rl-*` rules from loading at all unless the project
//        is Lynx-aware).
//
// `context.filename` may be unavailable in stripped-down test harnesses;
// in that case we keep ReactLynx rules active so the rule body can run.
export const isReactlynxFileActive = (context: RuleContext): boolean => {
  const rawFilename = context.filename;
  if (!rawFilename) return true;
  const filename = normalizeFilename(rawFilename);

  const packagePlatform = classifyPackagePlatform(filename);
  if (packagePlatform === "reactlynx") return true;
  if (packagePlatform !== "unknown") return false;

  const framework = getReactDoctorStringSetting(context.settings, "framework");
  if (framework === "reactlynx") return true;
  if (
    framework === "react-native" ||
    framework === "expo" ||
    framework === "nextjs" ||
    framework === "vite" ||
    framework === "cra" ||
    framework === "remix" ||
    framework === "gatsby" ||
    framework === "tanstack-start" ||
    framework === "preact"
  ) {
    return false;
  }
  return true;
};
