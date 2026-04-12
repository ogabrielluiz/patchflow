import { describe, it, expect } from 'bun:test';
import { parse, layout, renderSvg, darkTheme, defaultTheme } from '../src/index';

describe('darkTheme', () => {
  it('is exported from public API', () => {
    expect(darkTheme).toBeDefined();
    expect(darkTheme.panel.fill).toBe(defaultTheme.panel.fill); // panels unchanged
  });

  it('uses a lighter port label color than default', () => {
    expect(darkTheme.port.labelColor).not.toBe(defaultTheme.port.labelColor);
    expect(darkTheme.port.labelColor).toBe('#e8e4dc');
  });

  it('renders valid SVG', () => {
    const graph = parse('- A (Out) >> B (In)').graph!;
    const positioned = layout(graph);
    const svg = renderSvg(positioned, darkTheme);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('NaN');
    expect(svg).toContain('#e8e4dc'); // dark label color should be in output
  });
});
