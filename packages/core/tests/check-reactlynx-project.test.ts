import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vite-plus/test";
import { checkReactlynxProject, clearPackageJsonCache } from "@react-doctor/core";
import type { PackageJson, ProjectInfo } from "@react-doctor/core";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "react-doctor-rl-checks-"));

afterAll(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

let directoryCounter = 0;
const makeProjectDirectory = (): string => {
  const projectDirectory = path.join(tempRoot, `project-${directoryCounter++}`);
  fs.mkdirSync(projectDirectory, { recursive: true });
  return projectDirectory;
};

const writePackageJson = (projectDirectory: string, packageJson: PackageJson): void => {
  fs.writeFileSync(
    path.join(projectDirectory, "package.json"),
    JSON.stringify(packageJson, null, 2),
  );
  clearPackageJsonCache();
};

const buildLynxProject = (
  rootDirectory: string,
  framework: ProjectInfo["framework"] = "reactlynx",
): ProjectInfo => ({
  rootDirectory,
  projectName: "lynx-app",
  reactVersion: "18.3.1",
  reactMajorVersion: 18,
  tailwindVersion: null,
  zodVersion: null,
  zodMajorVersion: null,
  framework,
  hasTypeScript: true,
  hasReactCompiler: false,
  hasTanStackQuery: false,
  hasReactNativeWorkspace: false,
  hasReactLynxWorkspace: false,
  expoVersion: null,
  shopifyFlashListVersion: null,
  shopifyFlashListMajorVersion: null,
  hasReanimated: false,
  preactVersion: null,
  preactMajorVersion: null,
  sourceFileCount: 10,
});

describe("checkReactlynxProject — gating", () => {
  it("emits nothing for a non-ReactLynx project even when Lynx packages are present", () => {
    const projectDirectory = makeProjectDirectory();
    writePackageJson(projectDirectory, {
      name: "web-app",
      dependencies: { "@lynx-js/react": "^0.121.0" },
    });
    expect(
      checkReactlynxProject(projectDirectory, buildLynxProject(projectDirectory, "vite")),
    ).toEqual([]);
  });

  it("emits nothing when the manifest is missing", () => {
    const projectDirectory = makeProjectDirectory();
    expect(
      checkReactlynxProject(projectDirectory, buildLynxProject(projectDirectory)),
    ).toEqual([]);
  });
});

describe("checkReactlynxProject — engine versions: complete install", () => {
  it("does NOT flag when all three engine packages are present", () => {
    const projectDirectory = makeProjectDirectory();
    writePackageJson(projectDirectory, {
      name: "lynx-app",
      dependencies: {
        "@lynx-js/react": "^0.121.0",
      },
      devDependencies: {
        "@lynx-js/rspeedy": "^0.14.0",
        "@lynx-js/react-rsbuild-plugin": "^0.16.0",
      },
    });
    expect(checkReactlynxProject(projectDirectory, buildLynxProject(projectDirectory))).toEqual([]);
  });

  it("does NOT flag when all three are present in devDependencies", () => {
    const projectDirectory = makeProjectDirectory();
    writePackageJson(projectDirectory, {
      name: "lynx-app",
      devDependencies: {
        "@lynx-js/react": "^0.121.0",
        "@lynx-js/rspeedy": "^0.14.0",
        "@lynx-js/react-rsbuild-plugin": "^0.16.0",
      },
    });
    expect(checkReactlynxProject(projectDirectory, buildLynxProject(projectDirectory))).toEqual([]);
  });
});

describe("checkReactlynxProject — engine versions: partial install", () => {
  it("flags one missing package (only @lynx-js/react present)", () => {
    const projectDirectory = makeProjectDirectory();
    writePackageJson(projectDirectory, {
      name: "lynx-app",
      dependencies: { "@lynx-js/react": "^0.121.0" },
    });
    const diagnostics = checkReactlynxProject(projectDirectory, buildLynxProject(projectDirectory));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe("error");
    expect(diagnostics[0].rule).toBe("rl-engine-versions-mismatch");
    expect(diagnostics[0].message).toContain("@lynx-js/rspeedy");
    expect(diagnostics[0].message).toContain("@lynx-js/react-rsbuild-plugin");
  });

  it("flags two missing packages (only @lynx-js/rspeedy present) as a single diagnostic", () => {
    const projectDirectory = makeProjectDirectory();
    writePackageJson(projectDirectory, {
      name: "lynx-app",
      devDependencies: { "@lynx-js/rspeedy": "^0.14.0" },
    });
    const diagnostics = checkReactlynxProject(projectDirectory, buildLynxProject(projectDirectory));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("@lynx-js/react");
    expect(diagnostics[0].message).toContain("@lynx-js/react-rsbuild-plugin");
  });

  it("flags when the runtime is missing but both build packages are present", () => {
    const projectDirectory = makeProjectDirectory();
    writePackageJson(projectDirectory, {
      name: "lynx-app",
      devDependencies: {
        "@lynx-js/rspeedy": "^0.14.0",
        "@lynx-js/react-rsbuild-plugin": "^0.16.0",
      },
    });
    const diagnostics = checkReactlynxProject(projectDirectory, buildLynxProject(projectDirectory));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("@lynx-js/react");
  });
});

describe("checkReactlynxProject — engine versions: all absent", () => {
  it("does NOT flag when no engine package is present (other concerns will surface elsewhere)", () => {
    const projectDirectory = makeProjectDirectory();
    writePackageJson(projectDirectory, {
      name: "lynx-app",
      dependencies: { react: "^18.3.1" },
    });
    expect(checkReactlynxProject(projectDirectory, buildLynxProject(projectDirectory))).toEqual([]);
  });
});

const writeFile = (projectDirectory: string, relativePath: string, contents: string): void => {
  const fullPath = path.join(projectDirectory, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, contents);
};

// Helper: a complete-trio install so the engine-versions check doesn't
// add to the noise during migration-debt tests.
const writeCompleteEngineTrio = (projectDirectory: string): void => {
  writePackageJson(projectDirectory, {
    name: "lynx-app",
    dependencies: {
      "@lynx-js/react": "^0.121.0",
    },
    devDependencies: {
      "@lynx-js/rspeedy": "^0.14.0",
      "@lynx-js/react-rsbuild-plugin": "^0.16.0",
    },
  });
};

describe("checkReactlynxProject — RL2 migration debt", () => {
  it("flags a `lepus.js` at project root", () => {
    const projectDirectory = makeProjectDirectory();
    writeCompleteEngineTrio(projectDirectory);
    writeFile(projectDirectory, "lepus.js", "// rl2 entry\n");
    const diagnostics = checkReactlynxProject(projectDirectory, buildLynxProject(projectDirectory));
    const migrationDiag = diagnostics.find((d) => d.rule === "rl-no-reactlynx-2-residue");
    expect(migrationDiag).toBeDefined();
    expect(migrationDiag?.severity).toBe("error");
    expect(migrationDiag?.message).toContain("lepus.js");
    expect(migrationDiag?.message).toContain("migrax-planner-rl3");
  });

  it("flags a `src/lepus.js`", () => {
    const projectDirectory = makeProjectDirectory();
    writeCompleteEngineTrio(projectDirectory);
    writeFile(projectDirectory, "src/lepus.js", "// rl2 entry\n");
    const diagnostics = checkReactlynxProject(projectDirectory, buildLynxProject(projectDirectory));
    expect(diagnostics.some((d) => d.message.includes("src/lepus.js"))).toBe(true);
  });

  it("flags a `card.json` at project root", () => {
    const projectDirectory = makeProjectDirectory();
    writeCompleteEngineTrio(projectDirectory);
    writeFile(projectDirectory, "card.json", "{}\n");
    const diagnostics = checkReactlynxProject(projectDirectory, buildLynxProject(projectDirectory));
    expect(diagnostics.some((d) => d.message.includes("card.json"))).toBe(true);
  });

  it("flags a `lynx-speedy` dependency in package.json", () => {
    const projectDirectory = makeProjectDirectory();
    writePackageJson(projectDirectory, {
      name: "lynx-app",
      dependencies: {
        "@lynx-js/react": "^0.121.0",
        "lynx-speedy": "^2.0.0",
      },
      devDependencies: {
        "@lynx-js/rspeedy": "^0.14.0",
        "@lynx-js/react-rsbuild-plugin": "^0.16.0",
      },
    });
    const diagnostics = checkReactlynxProject(projectDirectory, buildLynxProject(projectDirectory));
    const migrationDiag = diagnostics.find((d) => d.message.includes("lynx-speedy"));
    expect(migrationDiag).toBeDefined();
    expect(migrationDiag?.severity).toBe("error");
  });

  it("flags a `lynx-speedy` devDependency", () => {
    const projectDirectory = makeProjectDirectory();
    writePackageJson(projectDirectory, {
      name: "lynx-app",
      dependencies: { "@lynx-js/react": "^0.121.0" },
      devDependencies: {
        "@lynx-js/rspeedy": "^0.14.0",
        "@lynx-js/react-rsbuild-plugin": "^0.16.0",
        "lynx-speedy": "^2.0.0",
      },
    });
    const diagnostics = checkReactlynxProject(projectDirectory, buildLynxProject(projectDirectory));
    expect(diagnostics.some((d) => d.message.includes("lynx-speedy"))).toBe(true);
  });

  it("emits one diagnostic per signal when multiple are present", () => {
    const projectDirectory = makeProjectDirectory();
    writePackageJson(projectDirectory, {
      name: "lynx-app",
      dependencies: { "@lynx-js/react": "^0.121.0" },
      devDependencies: {
        "@lynx-js/rspeedy": "^0.14.0",
        "@lynx-js/react-rsbuild-plugin": "^0.16.0",
        "lynx-speedy": "^2.0.0",
      },
    });
    writeFile(projectDirectory, "lepus.js", "// rl2 entry\n");
    writeFile(projectDirectory, "card.json", "{}\n");
    const diagnostics = checkReactlynxProject(projectDirectory, buildLynxProject(projectDirectory));
    const migrationDiags = diagnostics.filter((d) => d.rule === "rl-no-reactlynx-2-residue");
    expect(migrationDiags).toHaveLength(3);
  });

  it("does NOT flag a clean RL3 project", () => {
    const projectDirectory = makeProjectDirectory();
    writeCompleteEngineTrio(projectDirectory);
    const diagnostics = checkReactlynxProject(projectDirectory, buildLynxProject(projectDirectory));
    expect(diagnostics.filter((d) => d.rule === "rl-no-reactlynx-2-residue")).toEqual([]);
  });
});
