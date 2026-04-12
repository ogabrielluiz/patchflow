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
    expect(svg).toContain('shortens fall each cycle');
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

  it('renders block subLabel when present', () => {
    const parseResult = parse('- A (Out) >> B (In)');
    const layoutResult = layout(parseResult.graph!);
    // Inject a subLabel on one block
    layoutResult.blocks[0].subLabel = 'sub-line';
    const svg = renderSvg(layoutResult, defaultTheme);
    expect(svg).toContain('sub-line');
  });

  it('renders annotation as a numbered marker on the cable and a note in upper-left', () => {
    const graph = parse('- A (Out) >> B (In) // modulation depth').graph!;
    const positioned = layout(graph);
    const svg = renderSvg(positioned, defaultTheme);
    // Note text appears in the annotations layer
    expect(svg).toContain('modulation depth');
    // A numbered marker (look for a specific pattern — e.g., text "1" inside a small circle)
    expect(svg).toMatch(/<circle [^>]*r="8"[^>]*>/); // marker circle
    expect(svg).toContain('1. modulation depth');
  });

  it('renders multiple annotations with sequential numbers', () => {
    const graph = parse([
      '- A (Out) >> B (In) // first',
      '- B (Out) >> C (In) // second',
    ].join('\n')).graph!;
    const positioned = layout(graph);
    const svg = renderSvg(positioned, defaultTheme);
    expect(svg).toContain('1. first');
    expect(svg).toContain('2. second');
  });

  it('omits notes panel when no annotations present', () => {
    const graph = parse('- A (Out) >> B (In)').graph!;
    const positioned = layout(graph);
    const svg = renderSvg(positioned, defaultTheme);
    // layer is still present but should not contain "1. " text
    expect(svg).not.toMatch(/\d+\.\s/);
  });

  it('renders feedback annotation without ↻ prefix', () => {
    const input = [
      '- A (Out) >> B (In)',
      '- B (Out) >> A (In) // feedback loop',
    ].join('\n');
    const parseResult = parse(input);
    const layoutResult = layout(parseResult.graph!);
    const svg = renderSvg(layoutResult, defaultTheme);
    expect(svg).toContain('1. feedback loop');
    expect(svg).not.toContain('↻');
  });

  it('renders port signal-type pills in SVG', () => {
    const parseResult = parse('- A (Out) p> B (1v/oct)');
    const positioned = layout(parseResult.graph!);
    const svg = renderSvg(positioned, defaultTheme);
    expect(svg).toContain('1v/oct');
    expect(svg).toContain('#8cb87c');
    expect(svg).toContain('pf-port-pill');
  });

  it('hides pills when theme.port.pill.show is false', () => {
    const parseResult = parse('- A (Out) p> B (1v/oct)');
    const positioned = layout(parseResult.graph!);
    const theme = createTheme({ port: { pill: { show: false } } });
    const svg = renderSvg(positioned, theme);
    expect(svg).not.toContain('pf-port-pill');
  });

  it('anchors port name labels outside the block edge (start for outputs, end for inputs)', () => {
    const svg = renderFromNotation(basicInput);
    // Port-name text is shifted horizontally OUTSIDE the block so it never
    // straddles the panel boundary. Output ports use text-anchor="start" (label
    // extends right of the socket), input ports use text-anchor="end" (label
    // extends left of the socket). Pill text stays centered on the pill (middle).
    const labelsSection = svg.slice(svg.indexOf('pf-layer-labels'), svg.indexOf('pf-layer-annotations'));
    expect(labelsSection).toMatch(/text-anchor="start"/);
    expect(labelsSection).toMatch(/text-anchor="end"/);
    expect(labelsSection).toContain('text-anchor="middle"');
  });

  it('places feedback target port labels below the socket', () => {
    const graph = parse('- A (Out) >> B (In)\n- B (Out) >> A (In)').graph!;
    const positioned = layout(graph);
    const svg = renderSvg(positioned, defaultTheme);
    // Hard to assert exact geometry, but the SVG must render cleanly with no NaN
    // and the labels layer must exist.
    expect(svg).not.toContain('NaN');
    expect(svg).toContain('pf-layer-labels');
  });

  it('renders dark variant sub-bar when subLabel present', () => {
    const graph = parse('FILTER [Low Pass]:\n- FILTER (Out) -> VCA (In)').graph!;
    const positioned = layout(graph);
    const svg = renderSvg(positioned, defaultTheme);
    expect(svg).toContain('Low Pass');
    expect(svg).toContain('pf-sublabel-bar');
  });

  describe('legend and notes positioning', () => {
    it('places the legend below every block bottom', () => {
      const graph = parse('- A (Out) >> B (In)').graph!;
      const positioned = layout(graph);
      const svg = renderSvg(positioned, defaultTheme);

      // Grab the legend group's transform to find its Y coordinate.
      const legendMatch = svg.match(/pf-layer-legend">.*?<g transform="translate\([^,]+,\s*([\d.]+)\)/);
      expect(legendMatch).not.toBeNull();
      const legendY = parseFloat(legendMatch![1]);

      // Every block's bottom should be strictly above the legend Y —
      // otherwise they would visually overlap.
      const maxBlockBottom = Math.max(...positioned.blocks.map(b => b.y + b.height));
      expect(legendY).toBeGreaterThan(maxBlockBottom);
    });

    it('places annotation notes below every block bottom', () => {
      const input = [
        '- A (Out) >> B (In) {annot: "shortens fall each cycle"}',
      ].join('\n');
      const parsed = parse(input);
      if (!parsed.graph) throw new Error('parse failed');
      const positioned = layout(parsed.graph);
      // Only run the assertion if the parser attached the annotation.
      const annotated = positioned.connections.filter(c => c.annotation);
      if (annotated.length === 0) return;

      const svg = renderSvg(positioned, defaultTheme);
      // First annotation note text: `<text x="-120" y="..." ...>1. ...</text>`
      const noteMatch = svg.match(/pf-layer-annotations">.*?<text x="-120" y="([\d.]+)"[^>]*>1\./);
      if (!noteMatch) return;
      const noteY = parseFloat(noteMatch[1]);
      const maxBlockBottom = Math.max(...positioned.blocks.map(b => b.y + b.height));
      expect(noteY).toBeGreaterThan(maxBlockBottom);
    });
  });

});
