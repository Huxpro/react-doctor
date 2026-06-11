import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { rlMainThreadDirective } from "./rl-main-thread-directive.js";

describe("rl-main-thread-directive — flags useState setter from main-thread", () => {
  it("flags `setCount(0)` inside a `'main thread'` arrow function", () => {
    const result = runRule(
      rlMainThreadDirective,
      `
      function Component() {
        const [count, setCount] = useState(0);
        const onTap = () => { 'main thread'; setCount(count + 1); };
        return null;
      }
      `,
    );
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain("setCount");
  });

  it("flags `setCount` called from a `'main thread'` function declaration", () => {
    const result = runRule(
      rlMainThreadDirective,
      `
      function Component() {
        const [count, setCount] = useState(0);
        function onTap() { 'main thread'; setCount(count + 1); }
        return null;
      }
      `,
    );
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags multiple setters when each is called from main-thread", () => {
    const result = runRule(
      rlMainThreadDirective,
      `
      function Component() {
        const [a, setA] = useState(0);
        const [b, setB] = useState(0);
        const onTap = () => { 'main thread'; setA(1); setB(2); };
        return null;
      }
      `,
    );
    expect(result.diagnostics).toHaveLength(2);
  });
});

describe("rl-main-thread-directive — useReducer dispatcher", () => {
  it("flags `dispatch` from useReducer called from main-thread", () => {
    const result = runRule(
      rlMainThreadDirective,
      `
      function Component() {
        const [state, dispatch] = useReducer(reducer, initial);
        const onTap = () => { 'main thread'; dispatch({ type: "inc" }); };
        return null;
      }
      `,
    );
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain("dispatch");
  });
});

describe("rl-main-thread-directive — runOnBackground escape hatch", () => {
  it("does NOT flag a setter wrapped in `runOnBackground(...)`", () => {
    const result = runRule(
      rlMainThreadDirective,
      `
      function Component() {
        const [count, setCount] = useState(0);
        const onTap = () => { 'main thread'; runOnBackground(() => setCount(count + 1)); };
        return null;
      }
      `,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a setter passed to `runOnBackground` via a block-body callback", () => {
    const result = runRule(
      rlMainThreadDirective,
      `
      function Component() {
        const [count, setCount] = useState(0);
        const onTap = () => { 'main thread'; runOnBackground(() => { setCount(count + 1); }); };
        return null;
      }
      `,
    );
    expect(result.diagnostics).toHaveLength(0);
  });
});

describe("rl-main-thread-directive — no flag outside main-thread", () => {
  it("does NOT flag a setter called from a normal (non-main-thread) handler", () => {
    const result = runRule(
      rlMainThreadDirective,
      `
      function Component() {
        const [count, setCount] = useState(0);
        const onTap = () => { setCount(count + 1); };
        return null;
      }
      `,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag the useState declarator itself", () => {
    const result = runRule(
      rlMainThreadDirective,
      `
      function Component() {
        const [count, setCount] = useState(0);
        return null;
      }
      `,
    );
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a function-named-setX that wasn't produced by useState/useReducer", () => {
    const result = runRule(
      rlMainThreadDirective,
      `
      function Component() {
        function setCount(value) { return value; }
        const onTap = () => { 'main thread'; setCount(1); };
        return null;
      }
      `,
    );
    // setCount wasn't bound via useState destructure, so the file-scoped
    // setter Set is empty and the call doesn't flag.
    expect(result.diagnostics).toHaveLength(0);
  });
});
