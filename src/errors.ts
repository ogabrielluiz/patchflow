import type { ParseDiagnostic } from './types';

export const errorMessages = {
  unknownOperator: (op: string) =>
    `Unknown operator "${op}". Expected ->, >>, p>, g>, t>, or c>.`,

  unclosedParen: () =>
    `Unclosed parenthesis in port name.`,

  missingPort: (side: 'source' | 'target') =>
    `Missing port name on ${side} side of connection.`,

  duplicateModule: (name: string) =>
    `Module "${name}" declared more than once.`,

  didYouMean: (got: string, suggestion: string) =>
    `Module "${got}" is not declared. Did you mean "${suggestion}"?`,

  syntaxError: (detail: string) =>
    `Syntax error: ${detail}`,

  emptyDiagram: () =>
    `Diagram is empty — no connections found.`,

  ambiguousPortDirection: (port: string, module: string) =>
    `Port "${port}" on module "${module}" is used as both input and output. Use distinct names like "In ${port}"/"Out ${port}" to disambiguate.`,
};

export function formatDiagnostic(diag: ParseDiagnostic, sourceLine: string): string {
  const prefix = `Line ${diag.line}, col ${diag.column}: ${diag.message}`;
  const caret = ' '.repeat(diag.column - 1) + '^'.repeat(diag.length);
  return `${prefix}\n  ${sourceLine}\n  ${caret}`;
}

export function editDistance(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  const dp: number[][] = Array.from({ length: la + 1 }, () => Array(lb + 1).fill(0));
  for (let i = 0; i <= la; i++) dp[i][0] = i;
  for (let j = 0; j <= lb; j++) dp[0][j] = j;
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[la][lb];
}

export function sanitizeForSvg(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
