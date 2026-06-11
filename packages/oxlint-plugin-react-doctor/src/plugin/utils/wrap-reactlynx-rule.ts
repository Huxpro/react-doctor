import { isReactlynxFileActive } from "./is-reactlynx-file.js";
import type { Rule } from "./rule.js";
import type { RuleVisitors } from "./rule-visitors.js";

const EMPTY_VISITORS: RuleVisitors = {};

// Wraps a rule whose `create` should only run on files that belong to a
// ReactLynx package. Mirror of `wrapReactNativeRule` — same
// no-allocation short-circuit semantics — applied at registry load
// time so individual `rl-*` rules don't repeat the file-level check.
export const wrapReactlynxRule = (rule: Rule): Rule => {
  const innerCreate = rule.create.bind(rule);
  return {
    ...rule,
    create: (context) => {
      if (!isReactlynxFileActive(context)) return EMPTY_VISITORS;
      return innerCreate(context);
    },
  };
};
