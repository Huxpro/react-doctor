import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { rlNoBackgroundOnlyApiInRender } from "./rl-no-background-only-api-in-render.js";

describe("rl-no-background-only-api-in-render — render-scope violations", () => {
  it("flags `lynx.getJSModule(...)` called in a component render body", () => {
    const result = runRule(
      rlNoBackgroundOnlyApiInRender,
      `function App() {
        lynx.getJSModule('SomeModule');
        return <view />;
      }`,
    );
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain("lynx.getJSModule");
  });

  it("flags `NativeModules.SomeModule.call()` in a component render body", () => {
    const result = runRule(
      rlNoBackgroundOnlyApiInRender,
      `function App() {
        NativeModules.SomeModule.call();
        return <view />;
      }`,
    );
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain("NativeModules");
  });

  it("flags both APIs in the same render body as separate diagnostics", () => {
    const result = runRule(
      rlNoBackgroundOnlyApiInRender,
      `function App() {
        const module = lynx.getJSModule('SomeModule');
        NativeModules.SomeModule.call();
        return <view />;
      }`,
    );
    expect(result.diagnostics).toHaveLength(2);
  });

  it("flags only the innermost NativeModules MemberExpression on a chained access", () => {
    // NativeModules.A.B.C() parses as a chain of MemberExpressions; the
    // leaf one (NativeModules.A) is what we flag — `.B` and `.C` would
    // double-count otherwise.
    const result = runRule(
      rlNoBackgroundOnlyApiInRender,
      `function App() {
        NativeModules.A.B.C();
        return <view />;
      }`,
    );
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags at module-top-level scope (no enclosing function)", () => {
    const result = runRule(
      rlNoBackgroundOnlyApiInRender,
      `lynx.getJSModule('Boot');`,
    );
    expect(result.diagnostics).toHaveLength(1);
  });
});

describe("rl-no-background-only-api-in-render — useEffect/useLayoutEffect/useImperativeHandle", () => {
  it("does NOT flag inside a useEffect callback", () => {
    const result = runRule(
      rlNoBackgroundOnlyApiInRender,
      `function App() {
        useEffect(() => {
          lynx.getJSModule('SomeModule').doSomething();
        }, []);
        return <view />;
      }`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag inside a useLayoutEffect callback", () => {
    const result = runRule(
      rlNoBackgroundOnlyApiInRender,
      `function App() {
        useLayoutEffect(() => {
          NativeModules.Analytics.track('view');
        }, []);
        return <view />;
      }`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag inside a useImperativeHandle callback", () => {
    const result = runRule(
      rlNoBackgroundOnlyApiInRender,
      `function App() {
        useImperativeHandle(ref, () => ({
          doIt: () => lynx.getJSModule('SomeModule').doIt(),
        }));
        return <view />;
      }`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag through a nested helper called from useEffect", () => {
    const result = runRule(
      rlNoBackgroundOnlyApiInRender,
      `function App() {
        useEffect(() => {
          (() => {
            lynx.getJSModule('SomeModule');
          })();
        }, []);
        return <view />;
      }`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });
});

describe("rl-no-background-only-api-in-render — `'background only'` directive", () => {
  it("does NOT flag inside a `'background only'` arrow function", () => {
    const result = runRule(
      rlNoBackgroundOnlyApiInRender,
      `const fetchUser = () => {
        'background only';
        return lynx.getJSModule('UserAPI').getUser();
      };`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag inside a `'background only'` function declaration", () => {
    const result = runRule(
      rlNoBackgroundOnlyApiInRender,
      `function doWork() {
        'background only';
        NativeModules.Analytics.track('event');
      }`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag when a render-scope call sits lexically inside a `'background only'` outer fn", () => {
    // Even though the inner arrow lacks its own directive, walking the
    // ancestor chain finds the outer `'background only'` fn — the inner
    // body inherits the BG context.
    const result = runRule(
      rlNoBackgroundOnlyApiInRender,
      `function App() {
        const helper = () => {
          'background only';
          const inner = () => {
            lynx.getJSModule('SomeModule');
          };
          inner();
        };
        return <view />;
      }`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("DOES flag when the directive is on a sibling function, not an ancestor", () => {
    const result = runRule(
      rlNoBackgroundOnlyApiInRender,
      `function unrelated() { 'background only'; }
      function App() {
        lynx.getJSModule('SomeModule');
        return <view />;
      }`,
    );
    expect(result.diagnostics).toHaveLength(1);
  });
});

describe("rl-no-background-only-api-in-render — inline event/ref handlers", () => {
  it("does NOT flag inside an inline `bindtap` handler", () => {
    const result = runRule(
      rlNoBackgroundOnlyApiInRender,
      `function App() {
        return <view bindtap={() => { lynx.getJSModule('SomeModule'); }} />;
      }`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag inside an inline `catchtap` handler", () => {
    const result = runRule(
      rlNoBackgroundOnlyApiInRender,
      `function App() {
        return <view catchtap={() => { NativeModules.Foo.bar(); }} />;
      }`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag inside an inline `ref` callback", () => {
    const result = runRule(
      rlNoBackgroundOnlyApiInRender,
      `function App() {
        return <text ref={(node) => { lynx.getJSModule('SomeModule'); }}>x</text>;
      }`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag inside an inline `bindtouchstart` handler (broad bind* prefix)", () => {
    const result = runRule(
      rlNoBackgroundOnlyApiInRender,
      `function App() {
        return <view bindtouchstart={() => { NativeModules.Foo.bar(); }} />;
      }`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });
});

describe("rl-no-background-only-api-in-render — named event handlers", () => {
  it("does NOT flag a named function referenced from a `bindtap` attribute", () => {
    const result = runRule(
      rlNoBackgroundOnlyApiInRender,
      `function App() {
        function handleTap() {
          lynx.getJSModule('SomeModule').track('tap');
        }
        return <view bindtap={handleTap} />;
      }`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a const-arrow handler referenced from `catchtap`", () => {
    const result = runRule(
      rlNoBackgroundOnlyApiInRender,
      `function App() {
        const handleTap = () => {
          NativeModules.Analytics.track('tap');
        };
        return <view catchtap={handleTap} />;
      }`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("DOES flag a named helper that is NOT referenced from any background JSX attribute", () => {
    const result = runRule(
      rlNoBackgroundOnlyApiInRender,
      `function App() {
        function callApi() {
          lynx.getJSModule('SomeModule');
        }
        callApi();
        return <view />;
      }`,
    );
    expect(result.diagnostics).toHaveLength(1);
  });
});

describe("rl-no-background-only-api-in-render — main-thread events (no escape hatch)", () => {
  it("DOES flag inside a `main-thread:bindtap` handler — main-thread events are not BG contexts", () => {
    // `main-thread:` namespaced attributes opt their handler INTO main-
    // thread execution, where background-only APIs are exactly what
    // the rule should catch.
    const result = runRule(
      rlNoBackgroundOnlyApiInRender,
      `function App() {
        return <view main-thread:bindtap={() => { lynx.getJSModule('SomeModule'); }} />;
      }`,
    );
    expect(result.diagnostics).toHaveLength(1);
  });
});

describe("rl-no-background-only-api-in-render — shadowing", () => {
  it("does NOT flag when `NativeModules` is a local binding", () => {
    const result = runRule(
      rlNoBackgroundOnlyApiInRender,
      `function App() {
        const NativeModules = { Foo: { bar: () => null } };
        NativeModules.Foo.bar();
        return <view />;
      }`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag when `lynx` is a local binding", () => {
    const result = runRule(
      rlNoBackgroundOnlyApiInRender,
      `function App() {
        const lynx = { getJSModule: () => null };
        lynx.getJSModule('Test');
        return <view />;
      }`,
    );
    expect(result.diagnostics).toHaveLength(0);
  });
});
