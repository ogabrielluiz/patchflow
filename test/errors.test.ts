import { describe, it, expect } from 'bun:test';
import { formatDiagnostic, errorMessages, editDistance, sanitizeForSvg } from '../src/errors';
import type { ParseDiagnostic } from '../src/types';

describe('errors', () => {
  it('formatDiagnostic produces a caret-pointer message', () => {
    const diag: ParseDiagnostic = {
      code: 'UNKNOWN_OPERATOR',
      message: 'Unknown operator "=>"',
      line: 4,
      column: 22,
      length: 2,
      severity: 'error',
    };
    const sourceLine = '- MATHS.CH 1 (OUT) => MATHS.CH 2 (In)';
    const formatted = formatDiagnostic(diag, sourceLine);
    expect(formatted).toContain('Line 4, col 22');
    expect(formatted).toContain('Unknown operator "=>"');
    expect(formatted).toContain('^^');
  });

  it('errorMessages.unknownOperator produces a message with the operator', () => {
    const msg = errorMessages.unknownOperator('=>');
    expect(msg).toContain('=>');
    expect(msg).toContain('Expected');
  });

  it('errorMessages.didYouMean produces a suggestion', () => {
    const msg = errorMessages.didYouMean('MATH', 'MATHS');
    expect(msg).toContain('MATH');
    expect(msg).toContain('MATHS');
  });

  it('editDistance computes correct values', () => {
    expect(editDistance('MATHS', 'MATH')).toBe(1);
    expect(editDistance('MATHS', 'MATHS')).toBe(0);
    expect(editDistance('abc', 'xyz')).toBe(3);
    expect(editDistance('', 'abc')).toBe(3);
  });

  it('sanitizeForSvg escapes HTML/XML special characters', () => {
    expect(sanitizeForSvg('<script>')).toBe('&lt;script&gt;');
    expect(sanitizeForSvg('a & b')).toBe('a &amp; b');
    expect(sanitizeForSvg('"hello"')).toBe('&quot;hello&quot;');
    expect(sanitizeForSvg("it's")).toBe("it&#39;s");
  });
});
