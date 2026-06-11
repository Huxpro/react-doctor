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
