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

  it('errorMessages.unclosedParen describes the issue', () => {
    const msg = errorMessages.unclosedParen();
    expect(msg).toContain('Unclosed');
    expect(msg).toContain('paren');
  });

  it('errorMessages.missingPort mentions which side is missing', () => {
    expect(errorMessages.missingPort('source')).toContain('source');
    expect(errorMessages.missingPort('target')).toContain('target');
  });

  it('errorMessages.duplicateModule names the duplicated module', () => {
    const msg = errorMessages.duplicateModule('MATHS');
    expect(msg).toContain('MATHS');
    expect(msg).toContain('more than once');
  });

  it('errorMessages.syntaxError wraps the detail', () => {
    const msg = errorMessages.syntaxError('missing operator');
    expect(msg).toContain('Syntax error');
    expect(msg).toContain('missing operator');
  });

  it('errorMessages.emptyDiagram notes the empty state', () => {
    const msg = errorMessages.emptyDiagram();
    expect(msg.toLowerCase()).toContain('empty');
  });

  it('errorMessages.ambiguousPortDirection names the port and module', () => {
    const msg = errorMessages.ambiguousPortDirection('L', 'FX AID 1U');
    expect(msg).toContain('"L"');
    expect(msg).toContain('FX AID 1U');
    expect(msg).toContain('input');
    expect(msg).toContain('output');
  });
});
