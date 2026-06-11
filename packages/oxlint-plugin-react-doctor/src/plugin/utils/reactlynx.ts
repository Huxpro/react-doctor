import type { EsTreeNode } from "./es-tree-node.js";
import { isNodeOfType } from "./is-node-of-type.js";

const MAIN_THREAD_DIRECTIVE = "main thread";

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
export const isMainThreadFunction = (node: EsTreeNode): boolean => {
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
  return firstStatement.directive === MAIN_THREAD_DIRECTIVE;
};
