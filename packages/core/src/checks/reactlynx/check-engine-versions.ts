import path from "node:path";
import { isFile, readPackageJson } from "../../project-info/index.js";
import { REACTLYNX_ENGINE_PACKAGES } from "../../project-info/internal-reactlynx-package-names.js";
import { resolveCatalogVersion } from "../../project-info/resolve-catalog-version.js";
import type { Diagnostic, PackageJson } from "../../types/index.js";

// Reads the declared version of `packageName` from the root manifest,
// resolving a `catalog:` spec to the workspace's catalog entry. Returns
// null when the package isn't declared at all (neither runtime nor dev),
// distinguishing "not installed" from "installed at workspace:*".
const readDeclaredVersion = (
  packageJson: PackageJson,
  packageName: string,
  rootDirectory: string,
): string | null => {
  const directVersion =
    packageJson.dependencies?.[packageName] ??
    packageJson.devDependencies?.[packageName] ??
    null;
  if (directVersion === null) return null;
  return resolveCatalogVersion(packageJson, packageName, rootDirectory) ?? directVersion;
};

// v1: flags partial installs of the ReactLynx engine trio. When at
// least one of the three packages is present and any other is
// missing, the install is broken (the rsbuild plugin won't transform,
// or the runtime won't link). v1 does NOT compare versions — that's
// a follow-up once we have a compatibility table seeded from the
// peer-range matrix.
//
// All three absent → no diagnostic; the orchestrator already gates
// on `project.framework === "reactlynx"`, so the all-absent case
// either never reaches here or means the user has just removed
// every Lynx package (their problem to retain, not ours to flag).
export const checkReactlynxEngineVersions = (rootDirectory: string): Diagnostic[] => {
  const packageJsonPath = path.join(rootDirectory, "package.json");
  if (!isFile(packageJsonPath)) return [];

  const packageJson = readPackageJson(packageJsonPath);
  const presence: { name: string; present: boolean }[] = REACTLYNX_ENGINE_PACKAGES.map((name) => ({
    name,
    present: readDeclaredVersion(packageJson, name, rootDirectory) !== null,
  }));

  const presentCount = presence.filter((entry) => entry.present).length;
  if (presentCount === 0 || presentCount === REACTLYNX_ENGINE_PACKAGES.length) return [];

  const missing = presence.filter((entry) => !entry.present).map((entry) => entry.name);
  const present = presence.filter((entry) => entry.present).map((entry) => entry.name);

  return [
    {
      filePath: "package.json",
      plugin: "react-doctor",
      rule: "rl-engine-versions-mismatch",
      severity: "error",
      message: `Incomplete ReactLynx install: ${present.join(", ")} is present but ${missing.join(", ")} is missing. The three @lynx-js engine packages ship in lockstep — a partial install fails at build or first render.`,
      help: `Add the missing package${missing.length === 1 ? "" : "s"} (${missing.join(", ")}) to your manifest at a version compatible with the installed ${present.join(", ")}.`,
      line: 0,
      column: 0,
      category: "Correctness",
    },
  ];
};
