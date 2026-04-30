export const GREETING_TOKENS = ['firstName', 'lastName', 'fullName', 'email'] as const;
export type GreetingToken = typeof GREETING_TOKENS[number];

// Must stay in sync with the runtime extractors in core/utils/personalize.ts.
// Whitespace inside braces is rejected so {{ firstName }} can't pass validation
// and then fail to substitute at send time.
const TOKEN_REGEX = /\{\{(\w+)\}\}/g;

export function extractGreetingTokens(template: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  TOKEN_REGEX.lastIndex = 0;
  while ((match = TOKEN_REGEX.exec(template)) !== null) {
    found.add(match[1]);
  }
  return Array.from(found);
}

export function findInvalidGreetingTokens(template: string): string[] {
  const allowed = new Set<string>(GREETING_TOKENS);
  return extractGreetingTokens(template).filter((t) => !allowed.has(t));
}
