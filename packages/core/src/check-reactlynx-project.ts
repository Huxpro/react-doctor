import type { Diagnostic, ProjectInfo } from "./types/index.js";
import { checkReactlynxEngineVersions } from "./checks/reactlynx/check-engine-versions.js";
import { checkRl2Rl3MigrationDebt } from "./checks/reactlynx/check-rl2-rl3-migration-debt.js";

// Project-level checks that apply only to ReactLynx projects — manifest /
// install footguns specific to the @lynx-js engine trio. Gated on
// `framework === "reactlynx"`; mixed monorepos surface here only when the
// root manifest itself is the Lynx project (the workspace-level case is
// covered by the file-level package boundary in M3, not by this
// project-level check). The run-inspect orchestrator skips this whole
// phase in diff/staged mode, mirroring the RN gate.
const isReactLynxProject = (project: ProjectInfo): boolean =>
  project.framework === "reactlynx";

export const checkReactlynxProject = (
  rootDirectory: string,
  project: ProjectInfo,
): Diagnostic[] => {
  if (!isReactLynxProject(project)) return [];
  return [
    ...checkReactlynxEngineVersions(rootDirectory),
    ...checkRl2Rl3MigrationDebt(rootDirectory),
  ];
};
