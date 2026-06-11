import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { rlNoOnclickOnBuiltin } from "./rl-no-onclick-on-builtin.js";

describe("rl-no-onclick-on-builtin — flags onClick on Lynx host elements", () => {
  it("flags `<view onClick>`", () => {
    const result = runRule(rlNoOnclickOnBuiltin, `const x = <view onClick={f} />;`);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain("onClick");
    expect(result.diagnostics[0].message).toContain("bindtap");
  });

  it("flags `<text onClick>`", () => {
    const result = runRule(
      rlNoOnclickOnBuiltin,
      `const x = <text onClick={() => setCount(c => c + 1)}>Tap me</text>;`,
    );
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags `<image onClick>`", () => {
    const result = runRule(rlNoOnclickOnBuiltin, `const x = <image onClick={f} src="a" />;`);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags `<scroll-view onClick>` (hyphenated host tag)", () => {
    const result = runRule(rlNoOnclickOnBuiltin, `const x = <scroll-view onClick={f} />;`);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain("scroll-view");
  });

  it("flags `<list-item onClick>`", () => {
    const result = runRule(rlNoOnclickOnBuiltin, `const x = <list-item onClick={f} />;`);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags onClick alongside other valid attributes", () => {
    const result = runRule(
      rlNoOnclickOnBuiltin,
      `const x = <view className="a" onClick={f} style={{ color: "red" }} />;`,
    );
    expect(result.diagnostics).toHaveLength(1);
  });
});

describe("rl-no-onclick-on-builtin — no flag on correct ReactLynx events", () => {
  it("does NOT flag `<view bindtap>`", () => {
    const result = runRule(rlNoOnclickOnBuiltin, `const x = <view bindtap={f} />;`);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag `<view catchtap>`", () => {
    const result = runRule(rlNoOnclickOnBuiltin, `const x = <view catchtap={f} />;`);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a `<view>` with no event handler at all", () => {
    const result = runRule(rlNoOnclickOnBuiltin, `const x = <view className="a" />;`);
    expect(result.diagnostics).toHaveLength(0);
  });
});

describe("rl-no-onclick-on-builtin — no flag on user components", () => {
  it("does NOT flag a capitalized component (`<Button onClick>`)", () => {
    const result = runRule(rlNoOnclickOnBuiltin, `const x = <Button onClick={f} />;`);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a namespaced JSX member tag (`<Foo.Bar onClick>`)", () => {
    const result = runRule(rlNoOnclickOnBuiltin, `const x = <Foo.Bar onClick={f} />;`);
    expect(result.diagnostics).toHaveLength(0);
  });
});

describe("rl-no-onclick-on-builtin — no flag on non-Lynx lowercase tags", () => {
  it("does NOT flag `<div onClick>` (not a Lynx host element)", () => {
    const result = runRule(rlNoOnclickOnBuiltin, `const x = <div onClick={f} />;`);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag `<span onClick>`", () => {
    const result = runRule(rlNoOnclickOnBuiltin, `const x = <span onClick={f} />;`);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag `<button onClick>` (web button, not Lynx host element)", () => {
    const result = runRule(rlNoOnclickOnBuiltin, `const x = <button onClick={f} />;`);
    expect(result.diagnostics).toHaveLength(0);
  });
});
