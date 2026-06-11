import type { PackageJson } from "../../types/index.js";

const REACTLYNX_RUNTIME_PACKAGE = "@lynx-js/react";

const containsReactLynxRuntime = (section: Record<string, string> | undefined): boolean => {
  if (!section) return false;
  return REACTLYNX_RUNTIME_PACKAGE in section;
};

// True when the manifest declares `@lynx-js/react` — the ReactLynx
// runtime — in any of the four standard dependency sections. Used by
// the workspace walk in `has-reactlynx-workspace-anywhere.ts` to set
// the project-level `reactlynx` capability gate so `rl-*` rules load
// on web-rooted monorepos that contain an `apps/lynx` workspace.
//
// Intentionally narrow: only the runtime package counts here, not the
// build tools (`@lynx-js/rspeedy`, `@lynx-js/react-rsbuild-plugin`).
// A workspace that ships ONLY the build tools without the runtime is
// a build-tooling package, not a Lynx app — surfacing rl-* rules
// there would false-positive.
export const isPackageJsonReactLynxAware = (packageJson: PackageJson): boolean => {
  if (containsReactLynxRuntime(packageJson.dependencies)) return true;
  if (containsReactLynxRuntime(packageJson.devDependencies)) return true;
  if (containsReactLynxRuntime(packageJson.peerDependencies)) return true;
  if (containsReactLynxRuntime(packageJson.optionalDependencies)) return true;
  return false;
};
