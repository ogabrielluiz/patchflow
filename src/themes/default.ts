import type { Theme, DeepPartial } from '../types';

export const defaultTheme: Theme = {
  background: 'transparent',
  panel: {
    fill: '#e8e4dc',
    stroke: '#cec8be',
    highlight: '#f2efe8',
    shadow: '#bdb8ae',
    cornerRadius: 0,
    shadowBlur: 3,
    shadowOpacity: 0.10,
    bevelWidth: 1,
  },
  label: {
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: '#1a1a1a',
    subColor: '#888888',
    plateFill: '#f4f1ea',
    plateStroke: '#c5c0b6',
  },
  param: {
    plateFill: '#f0ede6',
    plateStroke: '#d5d0c6',
    textColor: '#555555',
  },
  port: {
    fontFamily: "'SF Mono', 'Fira Code', Consolas, 'Courier New', monospace",
    fontSize: 9,
    colors: {
      bezel: '#c0bbb2',
      bezelStroke: '#a8a39a',
      ring: '#8a8580',
      hole: '#555555',
      pin: '#333333',
    },
    hideSocket: false,
    labelColor: '#1a1a1a',
    pill: {
      show: true,
      fontSize: 8,
      textColor: '#ffffff',
      cornerRadius: 0,
    },
  },
  cable: {
    width: 3,
    colors: {
      audio:   { stroke: '#e88ca5', plugTip: '#d47a93' },
      cv:      { stroke: '#7bafd4', plugTip: '#6a9ec3' },
      pitch:   { stroke: '#8cb87c', plugTip: '#7ba76b' },
      gate:    { stroke: '#d4a054', plugTip: '#c49244' },
      trigger: { stroke: '#d4a054', plugTip: '#c49244' },
      clock:   { stroke: '#d4a054', plugTip: '#c49244' },
    },
    plugTipRadius: 3.5,
  },
  annotation: {
    fontFamily: "'SF Mono', 'Fira Code', Consolas, 'Courier New', monospace",
    fontSize: 9,
    color: '#888888',
    haloColor: '#f7f5f0',
  },
  grid: {
    dotColor: '#aaaaaa',
    dotRadius: 0.5,
    spacing: 12,
    opacity: 0.3,
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge<T>(target: T, source: DeepPartial<T>): T {
  const result: Record<string, unknown> = { ...(target as Record<string, unknown>) };
  const src = source as Record<string, unknown>;
  const tgt = target as Record<string, unknown>;
  for (const key in src) {
    const sourceVal = src[key];
    const targetVal = tgt[key];
    if (
      sourceVal !== null &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as DeepPartial<Record<string, unknown>>,
      );
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal;
    }
  }
  return result as T;
}

export function createTheme(overrides: DeepPartial<Theme>): Theme {
  return deepMerge(defaultTheme, overrides);
}
