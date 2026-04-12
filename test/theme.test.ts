import { describe, it, expect } from 'bun:test';
import { defaultTheme, createTheme } from '../src/themes/default';

describe('theme', () => {
  it('defaultTheme has all required fields', () => {
    expect(defaultTheme.background).toBeDefined();
    expect(defaultTheme.panel.fill).toBe('#e8e4dc');
    expect(defaultTheme.cable.colors.cv.stroke).toBe('#7bafd4');
    expect(defaultTheme.grid).not.toBeNull();
  });

  it('createTheme with no overrides returns equivalent of default', () => {
    const theme = createTheme({});
    expect(theme.panel.fill).toBe(defaultTheme.panel.fill);
    expect(theme.cable.width).toBe(defaultTheme.cable.width);
  });

  it('createTheme overrides a single nested field', () => {
    const theme = createTheme({ cable: { width: 5 } });
    expect(theme.cable.width).toBe(5);
    expect(theme.cable.colors.cv.stroke).toBe(defaultTheme.cable.colors.cv.stroke);
    expect(theme.panel.fill).toBe(defaultTheme.panel.fill);
  });

  it('createTheme merges deeply (colors preserved)', () => {
    const theme = createTheme({ cable: { colors: { cv: { stroke: '#000' } } as any } });
    expect(theme.cable.colors.cv.stroke).toBe('#000');
    expect(theme.cable.colors.audio.stroke).toBe(defaultTheme.cable.colors.audio.stroke);
  });

  it('createTheme does not mutate defaultTheme', () => {
    const originalFill = defaultTheme.panel.fill;
    createTheme({ panel: { fill: '#000' } });
    expect(defaultTheme.panel.fill).toBe(originalFill);
  });

  it('createTheme can set grid to null', () => {
    const theme = createTheme({ grid: null });
    expect(theme.grid).toBeNull();
  });
});
