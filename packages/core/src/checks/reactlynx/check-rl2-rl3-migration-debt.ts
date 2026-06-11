import path from "node:path";
import { isFile, readPackageJson } from "../../project-info/index.js";
import type { Diagnostic } from "../../types/index.js";

// Files left over from a ReactLynx 2 (`lynx-speedy`) project — their
// continued presence on disk means the project is either still on RL2
// or stalled mid-migration. The `migrax-planner-rl3` skill in this
// repo does the actual upgrade; this check only surfaces the residue.
const RL2_RESIDUE_FILES: ReadonlyArray<{ readonly relativePath: string; readonly signal: string }> =
  [
    { relativePath: "lepus.js", signal: "lepus.js at project root" },
    { relativePath: "src/lepus.js", signal: "src/lepus.js" },
    { relativePath: "card.json", signal: "card.json at project root" },
  ];

const RL2_BUILD_PACKAGE = "lynx-speedy";

const buildMessage = (signal: string): string =>
  `ReactLynx 2 residue detected (${signal}). Run the \`migrax-planner-rl3\` skill to migrate to ReactLynx 3 (\`@lynx-js/react\` + Rspeedy).`;

const HELP =
  "Open the `migrax-planner-rl3` skill in this repo and follow the migration prompts. It walks you through the package-manager detection, config migration, code migration, and build verification end-to-end.";

export const checkRl2Rl3MigrationDebt = (rootDirectory: string): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];

  for (const { relativePath, signal } of RL2_RESIDUE_FILES) {
    if (isFile(path.join(rootDirectory, relativePath))) {
      diagnostics.push({
        filePath: relativePath,
        plugin: "react-doctor",
        rule: "rl-no-reactlynx-2-residue",
        severity: "error",
        message: buildMessage(signal),
        help: HELP,
        line: 0,
        column: 0,
        category: "Correctness",
      });
    }
  }

  const packageJsonPath = path.join(rootDirectory, "package.json");
  if (isFile(packageJsonPath)) {
    const packageJson = readPackageJson(packageJsonPath);
    const hasLynxSpeedy =
      packageJson.dependencies?.[RL2_BUILD_PACKAGE] !== undefined ||
      packageJson.devDependencies?.[RL2_BUILD_PACKAGE] !== undefined;
    if (hasLynxSpeedy) {
      diagnostics.push({
        filePath: "package.json",
        plugin: "react-doctor",
        rule: "rl-no-reactlynx-2-residue",
        severity: "error",
        message: buildMessage(`\`${RL2_BUILD_PACKAGE}\` dependency`),
        help: HELP,
        line: 0,
        column: 0,
        category: "Correctness",
      });
    }
  }

  return diagnostics;
};
