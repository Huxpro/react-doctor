import type { EsTreeNode } from "./es-tree-node.js";
import { isNodeOfType } from "./is-node-of-type.js";

const MAIN_THREAD_DIRECTIVE = "main thread";
const BACKGROUND_ONLY_DIRECTIVE = "background only";

const hasDirective = (node: EsTreeNode, directive: string): boolean => {
  if (
    !isNodeOfType(node, "FunctionDeclaration") &&
    !isNodeOfType(node, "FunctionExpression") &&
    !isNodeOfType(node, "ArrowFunctionExpression")
  ) {
    return false;
  }
  if (!isNodeOfType(node.body, "BlockStatement")) return false;
  const firstStatement = node.body.body?.[0];
  if (!firstStatement) return false;
  if (!isNodeOfType(firstStatement, "ExpressionStatement")) return false;
  return firstStatement.directive === directive;
};

// Returns true when `node` is a function declared with a `'main thread'`
// directive prologue (the ReactLynx equivalent of `'use strict'`/
// `'use server'`). Per Lynx docs the directive is a plain string literal
// as the FIRST statement of the function body — identical AST shape to
// `'use strict'`. oxc exposes the prologue marker on
// `ExpressionStatement.directive`, so checking `.directive` (not the
// expression value) avoids the false-positive case where the first
// statement happens to be `console.log('main thread')`.
//
// Mirrors `hasUseServerDirective`; kept in a separate file because the
// `reactlynx.ts` module is the conventional home for the M4 main-thread
// rule helpers.
export const isMainThreadFunction = (node: EsTreeNode): boolean =>
  hasDirective(node, MAIN_THREAD_DIRECTIVE);

// Returns true when `node` is a function declared with a `'background only'`
// directive prologue. The directive opts a function into background-thread
// execution and is treated by the runtime as a hard contract that the body
// only runs off the main thread — so background-only APIs
// (`lynx.getJSModule(...)`, `NativeModules.*`) are safe to call from inside.
//
// Same AST shape and `.directive` accessor as `isMainThreadFunction`; the
// only difference is the directive string. Used by
// `rl-no-background-only-api-in-render` to identify one of the legal
// contexts where the violating APIs may appear.
export const isBackgroundOnlyFunction = (node: EsTreeNode): boolean =>
  hasDirective(node, BACKGROUND_ONLY_DIRECTIVE);
