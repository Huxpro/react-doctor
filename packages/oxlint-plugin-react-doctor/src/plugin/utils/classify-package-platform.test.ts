import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vite-plus/test";
import { classifyPackagePlatform, type PackagePlatform } from "./classify-package-platform.js";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rd-classify-platform-"));

afterAll(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

let directoryCounter = 0;
const setupPackage = (packageJson: Record<string, unknown>): string => {
  const packageDirectory = path.join(tempRoot, `pkg-${directoryCounter++}`);
  fs.mkdirSync(path.join(packageDirectory, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(packageDirectory, "package.json"),
    JSON.stringify(packageJson, null, 2),
  );
  // classifyPackagePlatform looks for the nearest package.json starting
  // from the directory of `filename`, so any file inside the package dir
  // works as the probe.
  const sourceFile = path.join(packageDirectory, "src/index.tsx");
  fs.writeFileSync(sourceFile, "export const x = 1;\n");
  return sourceFile;
};

describe("classifyPackagePlatform — reactlynx variant", () => {
  it("returns `reactlynx` for a package declaring `@lynx-js/react` in dependencies", () => {
    const sourceFile = setupPackage({
      name: "lynx-app",
      dependencies: { "@lynx-js/react": "^0.121.0", react: "^18.3.1" },
    });
    const result: PackagePlatform = classifyPackagePlatform(sourceFile);
    expect(result).toBe("reactlynx");
  });

  it("returns `reactlynx` when the runtime is in devDependencies", () => {
    const sourceFile = setupPackage({
      name: "lynx-app",
      devDependencies: { "@lynx-js/react": "^0.121.0" },
    });
    expect(classifyPackagePlatform(sourceFile)).toBe("reactlynx");
  });

  it("returns `reactlynx` when the runtime is in peerDependencies", () => {
    const sourceFile = setupPackage({
      name: "lynx-lib",
      peerDependencies: { "@lynx-js/react": "^0.121.0" },
    });
    expect(classifyPackagePlatform(sourceFile)).toBe("reactlynx");
  });
});

describe("classifyPackagePlatform — precedence", () => {
  it("classifies a package that declares both `@lynx-js/react` AND `react-native` as `reactlynx`", () => {
    const sourceFile = setupPackage({
      name: "mixed-pkg",
      dependencies: {
        "@lynx-js/react": "^0.121.0",
        "react-native": "0.74.0",
      },
    });
    expect(
      classifyPackagePlatform(sourceFile),
      "Lynx-runtime presence wins over RN — RN field is reused by Lynx libraries",
    ).toBe("reactlynx");
  });

  it("classifies a package that declares both `expo` AND `@lynx-js/react` as `expo`", () => {
    const sourceFile = setupPackage({
      name: "mis-installed",
      dependencies: {
        expo: "~51.0.0",
        "@lynx-js/react": "^0.121.0",
      },
    });
    expect(
      classifyPackagePlatform(sourceFile),
      "Expo + Lynx is almost certainly a mis-install; Expo checks should still fire",
    ).toBe("expo");
  });
});

describe("classifyPackagePlatform — build tools alone do NOT classify as reactlynx", () => {
  it("does NOT classify as `reactlynx` when only `@lynx-js/rspeedy` is declared (no runtime)", () => {
    const sourceFile = setupPackage({
      name: "lynx-tooling",
      devDependencies: { "@lynx-js/rspeedy": "^0.14.0" },
    });
    // Falls through to "unknown" — these are build tools, not a Lynx
    // app. `rl-*` rules should not fire here.
    expect(classifyPackagePlatform(sourceFile)).not.toBe("reactlynx");
  });

  it("does NOT classify as `reactlynx` when only `@lynx-js/react-rsbuild-plugin` is declared", () => {
    const sourceFile = setupPackage({
      name: "lynx-tooling",
      devDependencies: { "@lynx-js/react-rsbuild-plugin": "^0.16.0" },
    });
    expect(classifyPackagePlatform(sourceFile)).not.toBe("reactlynx");
  });
});

describe("classifyPackagePlatform — existing behavior unaffected", () => {
  it("still classifies a Next package as `web`", () => {
    const sourceFile = setupPackage({
      name: "web-app",
      dependencies: { next: "^14.0.0", react: "^18.3.1", "react-dom": "^18.3.1" },
    });
    expect(classifyPackagePlatform(sourceFile)).toBe("web");
  });

  it("still classifies a bare RN package as `react-native`", () => {
    const sourceFile = setupPackage({
      name: "mobile-app",
      dependencies: { "react-native": "0.74.0", react: "^18.3.1" },
    });
    expect(classifyPackagePlatform(sourceFile)).toBe("react-native");
  });

  it("still classifies an Expo package as `expo`", () => {
    const sourceFile = setupPackage({
      name: "expo-app",
      dependencies: { expo: "~51.0.0", "react-native": "0.74.0", react: "^18.3.1" },
    });
    expect(classifyPackagePlatform(sourceFile)).toBe("expo");
  });
});
