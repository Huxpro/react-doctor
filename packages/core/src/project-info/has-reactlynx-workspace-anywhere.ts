import type { PackageJson } from "../types/index.js";
import { someWorkspacePackageJson } from "./some-workspace-package-json.js";
import { isPackageJsonReactLynxAware } from "./utils/is-package-json-reactlynx-aware.js";

// True when the root manifest or any workspace package inside
// `rootDirectory` declares `@lynx-js/react`. Mirror of
// `hasReactNativeWorkspaceAnywhere` — same workspace walker, same
// short-circuit semantics — so a web-rooted monorepo whose
// entry-point `package.json` is Next / Vite / Remix still surfaces a
// project-level `reactlynx` capability when an `apps/lynx` workspace
// targets ReactLynx. The file-level package boundary in
// `oxlint-plugin-react-doctor` (M3 US-3.1) keeps `rl-*` rules silent
// on the web workspaces.
export const hasReactLynxWorkspaceAnywhere = (
  rootDirectory: string,
  rootPackageJson: PackageJson,
): boolean =>
  someWorkspacePackageJson(rootDirectory, rootPackageJson, isPackageJsonReactLynxAware);
