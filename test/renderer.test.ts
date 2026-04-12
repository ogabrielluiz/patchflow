import { describe, it, expect } from 'bun:test';
import { parse } from '../src/parser';
import { layout } from '../src/layout';
import { renderSvg } from '../src/renderer';
import { defaultTheme, createTheme } from '../src/themes/default';

function renderFromNotation(input: string): string {
  const parseResult = parse(input);
  if (!parseResult.graph) throw new Error('Parse failed');
  const layoutResult = layout(parseResult.graph);
  return renderSvg(layoutResult, defaultTheme);
}

describe('renderer', () => {
  const basicInput = '- Oscillator (Out) >> Filter (In)';

  it('produces valid SVG with opening and closing tags', () => {
    const svg = renderFromNotation(basicInput);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('viewBox=');
  });

  it('emits layers in correct document order', () => {
    const svg = renderFromNotation(basicInput);
    const bgIdx = svg.indexOf('pf-layer-bg');
    const cablesIdx = svg.indexOf('pf-layer-cables');
    const panelsIdx = svg.indexOf('pf-layer-panels');
    const paramsIdx = svg.indexOf('pf-layer-params');
    const jacksIdx = svg.indexOf('pf-layer-jacks');
    const labelsIdx = svg.indexOf('pf-layer-labels');
    const annotIdx = svg.indexOf('pf-layer-annotations');
    const legendIdx = svg.indexOf('pf-layer-legend');
    expect(bgIdx).toBeGreaterThanOrEqual(0);
    expect(bgIdx).toBeLessThan(cablesIdx);
    expect(cablesIdx).toBeLessThan(panelsIdx);
    expect(panelsIdx).toBeLessThan(paramsIdx);
    expect(paramsIdx).toBeLessThan(jacksIdx);
    expect(jacksIdx).toBeLessThan(labelsIdx);
    expect(labelsIdx).toBeLessThan(annotIdx);
    expect(annotIdx).toBeLessThan(legendIdx);
  });

  it('includes accessibility title and desc', () => {
    const svg = renderFromNotation(basicInput);
    expect(svg).toContain('<title');
    expect(svg).toContain('<desc');
    expect(svg).toContain('role="img"');
  });

  it('includes semantic data attributes', () => {
    const svg = renderFromNotation(basicInput);
    expect(svg).toContain('data-module=');
    expect(svg).toContain('data-signal="cv"');
  });

  it('includes print media query', () => {
    const svg = renderFromNotation(basicInput);
    expect(svg).toContain('@media print');
    expect(svg).toContain('filter: none');
  });

  it('renders width="100%" for responsive sizing', () => {
    const svg = renderFromNotation(basicInput);
    expect(svg).toContain('width="100%"');
  });

  it('uses unique ID prefixes per render call', () => {
    const svg1 = renderFromNotation(basicInput);
    const svg2 = renderFromNotation(basicInput);
    const id1 = svg1.match(/id="(pf-[a-f0-9]{6})-/)?.[1];
    const id2 = svg2.match(/id="(pf-[a-f0-9]{6})-/)?.[1];
    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    const svg3 = renderFromNotation(basicInput);
    const id3 = svg3.match(/id="(pf-[a-f0-9]{6})-/)?.[1];
    const ids = new Set([id1, id2, id3]);
    expect(ids.size).toBeGreaterThanOrEqual(2);
  });

  it('renders jack sockets as concentric circles', () => {
    const svg = renderFromNotation(basicInput);
    const circleCount = (svg.match(/<circle/g) || []).length;
    expect(circleCount).toBeGreaterThanOrEqual(4);
  });

  it('renders cables with signal-type colors', () => {
    const svg = renderFromNotation(basicInput);
    expect(svg).toContain('#7bafd4');
  });

  it('renders legend only for used signal types', () => {
    const svg = renderFromNotation(basicInput);
    const legendSection = svg.slice(svg.indexOf('pf-layer-legend'));
    expect(legendSection).toContain('cv');
  });

  it('renders dot grid background', () => {
    const svg = renderFromNotation(basicInput);
    expect(svg).toContain('pattern');
  });

  it('createTheme overrides merge correctly', () => {
    const customTheme = createTheme({ cable: { width: 5 } });
    expect(customTheme.cable.width).toBe(5);
    expect(customTheme.cable.colors.cv.stroke).toBe('#7bafd4');
    expect(customTheme.panel.fill).toBe('#e8e4dc');
  });

  it('escapes user-supplied text in SVG output', () => {
    const parseResult = parse('- "A<script>" (Out) >> B (In)');
    expect(parseResult.graph).not.toBeNull();
    const layoutResult = layout(parseResult.graph!);
    const svg = renderSvg(layoutResult, defaultTheme);
    expect(svg).not.toContain('<script>');
  });

  it('handles the MATHS bouncing ball patch end-to-end', () => {
    const input = [
      'MATHS:',
      '* CH 1: Cycle ON',
      "* CH 2: Attenuverter ~2 o'clock",
      '',
      '- MATHS.CH 1 (OUT) >> MATHS.CH 2 (In)',
      '- MATHS.CH 2 (Out) >> MATHS.CH 1 (Fall CV) // shortens fall each cycle',
    ].join('\n');
    const svg = renderFromNotation(input);
    expect(svg).toContain('CH 1');
    expect(svg).toContain('CH 2');
    expect(svg).toContain('↻');
    expect(svg).not.toContain('NaN');
  });

  it('respects theme.port.hideSocket', () => {
    const parseResult = parse('- A (Out) >> B (In)');
    const layoutResult = layout(parseResult.graph!);
    const minimalTheme = createTheme({ port: { hideSocket: true } });
    const svg = renderSvg(layoutResult, minimalTheme);
    const circleCount = (svg.match(/<circle/g) || []).length;
    expect(circleCount).toBeLessThanOrEqual(4);
  });

  it('respects theme.grid === null', () => {
    const parseResult = parse('- A (Out) >> B (In)');
    const layoutResult = layout(parseResult.graph!);
    const noGridTheme = createTheme({ grid: null });
    const svg = renderSvg(layoutResult, noGridTheme);
    expect(svg).not.toContain('<pattern');
  });
});
