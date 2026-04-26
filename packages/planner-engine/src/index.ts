export * from "./types/ast";
export * from "./parser/lexer";
export * from "./parser/course-parser";
export * from "./interpreter/evaluator";

import { Lexer } from "./parser/lexer";
import { CourseParser } from "./parser/course-parser";
import { ASTNode } from "./types/ast";

/**
 * Utility to parse a prerequisite string into an AST.
 */
export function parsePrerequisite(text: string): ASTNode | null {
  const lexer = new Lexer();
  const tokens = lexer.tokenize(text);
  const parser = new CourseParser(tokens);
  return parser.parse();
}
