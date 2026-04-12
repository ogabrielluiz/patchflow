import { describe, it, expect } from 'bun:test';
import { render, parse, layout, renderSvg, createTheme, defaultTheme } from '../src/index';

describe('public API integration', () => {
  const bouncingBall = [
    'MATHS:',
    '* CH 1: Cycle ON',
    "* CH 2: Attenuverter ~2 o'clock",
    '',
    '- MATHS.CH 1 (OUT) >> MATHS.CH 2 (In)',
    '- MATHS.CH 2 (Out) >> MATHS.CH 1 (Fall CV) // shortens fall each cycle',
  ].join('\n');

  const quadratureLFOs = [
    'MATHS:',
    '* CH 1: Cycle OFF, Rise + Fall matched',
    '* CH 4: Cycle OFF, Rise + Fall matched',
    '',
    '- MATHS.CH 1 (EOR) g> MATHS.CH 4 (Trig)',
    '- MATHS.CH 4 (EOC) g> MATHS.CH 1 (Trig)',
    '- MATHS.CH 1 (OUT) >> Filter (Cutoff)',
    '- MATHS.CH 4 (OUT) >> VCA (CV)',
  ].join('\n');

  it('render() produces SVG from notation string', () => {
    const svg = render(bouncingBall);
    expect(svg).toContain('<svg');
    expect(svg).toContain('CH 1');
    expect(svg).toContain('CH 2');
  });

  it('render() handles multi-module patches', () => {
    const svg = render(quadratureLFOs);
    expect(svg).toContain('<svg');
    expect(svg).toContain('Filter');
    expect(svg).toContain('VCA');
  });

  it('render() accepts theme overrides', () => {
    const svg = render(bouncingBall, {
      theme: { cable: { width: 5 } },
    });
    expect(svg).toContain('stroke-width="5"');
  });

  it('render() throws on totally invalid input', () => {
    expect(() => render('')).toThrow();
  });

  it('three-stage API works independently', () => {
    const parseResult = parse(bouncingBall);
    expect(parseResult.graph).not.toBeNull();

    const layoutResult = layout(parseResult.graph!);
    expect(layoutResult.blocks.length).toBeGreaterThan(0);

    const svg = renderSvg(layoutResult, defaultTheme);
    expect(svg).toContain('<svg');
  });

  it('createTheme is exported and works', () => {
    const theme = createTheme({ panel: { fill: '#000' } });
    expect(theme.panel.fill).toBe('#000');
    expect(theme.panel.stroke).toBe('#cec8be');
  });

  it('SVG output has no NaN values', () => {
    const svg = render(bouncingBall);
    expect(svg).not.toContain('NaN');
  });
});
