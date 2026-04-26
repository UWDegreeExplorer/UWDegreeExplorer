import { ASTNode, LogicalNode, CourseNode } from "../types/ast";
import { Token, TokenType } from "./lexer";

export class CourseParser {
  private tokens: Token[];
  private pos: number = 0;
  private lastSubject: string = "UNKNOWN_SUBJ";

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | null {
    return this.tokens[this.pos] || null;
  }

  private consume(): Token | null {
    return this.tokens[this.pos++] || null;
  }

  parse(): ASTNode | null {
    try {
      const ast = this.parseOr();
      if (this.peek()) return null; // Unconsumed tokens
      return ast;
    } catch (e) {
      return null;
    }
  }

  private parseOr(): ASTNode {
    const nodes = [this.parseAnd()];
    while (this.peek()?.type === TokenType.OR || this.peek()?.type === TokenType.SLASH) {
      this.consume();
      nodes.push(this.parseAnd());
    }
    return nodes.length === 1 ? nodes[0] : { type: 'OR', children: nodes };
  }

  private parseAnd(): ASTNode {
    const nodes = [this.parsePrimary()];
    while (this.peek()?.type === TokenType.AND || this.peek()?.type === TokenType.COMMA) {
      this.consume();
      nodes.push(this.parsePrimary());
    }
    return nodes.length === 1 ? nodes[0] : { type: 'AND', children: nodes };
  }

  private parsePrimary(): ASTNode {
    const t = this.peek();
    if (!t) throw new Error("Unexpected EOF");

    if (t.type === TokenType.LPAREN) {
      this.consume();
      const node = this.parseOr();
      if (this.peek()?.type === TokenType.RPAREN) {
        this.consume();
      }
      return node;
    }

    return this.parseCourse();
  }

  private parseCourse(): ASTNode {
    const t = this.peek();
    if (!t) throw new Error("Unexpected EOF");

    const subjects: string[] = [];

    if (t.type === TokenType.SUBJECT) {
      this.lastSubject = t.value;
      this.consume();
      subjects.push(this.lastSubject);

      while (this.peek()?.type === TokenType.SLASH) {
        if (this.tokens[this.pos + 1]?.type === TokenType.SUBJECT) {
          this.consume(); // SLASH
          const nextSub = this.consume();
          if (nextSub) {
            this.lastSubject = nextSub.value;
            subjects.push(this.lastSubject);
          }
        } else {
          break;
        }
      }

      if (this.peek()?.type === TokenType.CATALOG) {
        const cat = this.consume()!.value;
        if (subjects.length === 1) {
          return { type: 'COURSE', subject: subjects[0], catalog: cat };
        } else {
          return { type: 'OR', children: subjects.map(s => ({ type: 'COURSE', subject: s, catalog: cat })) };
        }
      }
    } else if (t.type === TokenType.CATALOG) {
      const cat = this.consume()!.value;
      return { type: 'COURSE', subject: this.lastSubject, catalog: cat };
    }

    // Fallback if not a course
    const token = this.consume()!;
    return { type: 'RAW_TEXT', text: token.value };
  }
}
