export enum TokenType {
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  SLASH = 'SLASH',
  COMMA = 'COMMA',
  AND = 'AND',
  OR = 'OR',
  SUBJECT = 'SUBJECT',
  CATALOG = 'CATALOG',
  WHITESPACE = 'WHITESPACE',
  UNKNOWN = 'UNKNOWN'
}

export interface Token {
  type: TokenType;
  value: string;
}

export class Lexer {
  private patterns: [TokenType, RegExp][] = [
    [TokenType.LPAREN, /\(/],
    [TokenType.RPAREN, /\)/],
    [TokenType.SLASH, /\//],
    [TokenType.COMMA, /,/],
    [TokenType.AND, /\band\b/i],
    [TokenType.OR, /\bor\b/i],
    [TokenType.SUBJECT, /\b[A-Z]{2,6}\b/],
    [TokenType.CATALOG, /\b\d{3}[A-Z]?\b/],
    [TokenType.WHITESPACE, /\s+/],
    [TokenType.UNKNOWN, /./]
  ];

  tokenize(text: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    while (i < text.length) {
      let matched = false;
      for (const [type, regex] of this.patterns) {
        const match = text.slice(i).match(new RegExp(`^${regex.source}`, regex.flags));
        if (match) {
          if (type !== TokenType.WHITESPACE && type !== TokenType.UNKNOWN) {
            tokens.push({ type, value: match[0].toUpperCase() });
          }
          i += match[0].length;
          matched = true;
          break;
        }
      }
      if (!matched) i++;
    }
    return tokens;
  }
}
