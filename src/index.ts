export { parse } from './parser';
export { layout } from './layout';
export { renderSvg } from './renderer';
export { createTheme, defaultTheme } from './themes/default';
export { darkTheme } from './themes/dark';

import type { RenderOptions } from './types';
import { parse } from './parser';
import { layout } from './layout';
import { renderSvg } from './renderer';
import { createTheme, defaultTheme } from './themes/default';

// Convenience: full pipeline
export function render(notation: string, options?: RenderOptions): string {
  const parseResult = parse(notation);
  if (!parseResult.graph) {
    const errorMsg = parseResult.errors.map(e => e.message).join('; ');
    throw new Error(`patchflow parse error: ${errorMsg}`);
  }
  const { graph } = parseResult;
  const totalBlocks = graph.declaredBlocks.length + graph.stubBlocks.length;
  const totalConnections = graph.connections.length + graph.feedbackEdges.length;
  if (totalBlocks === 0 && totalConnections === 0) {
    throw new Error('patchflow parse error: empty patch — no modules or connections found');
  }
  const layoutResult = layout(parseResult.graph, {
    direction: 'LR',
  });
  const theme = options?.theme ? createTheme(options.theme) : defaultTheme;
  return renderSvg(layoutResult, theme);
}

// Re-export all types
export type {
  SignalType, Port, Block, Connection, ConnectionEndpoint,
  PatchGraph, Param,
  LayoutBlock, LayoutConnection, LayoutPort, LayoutResult, Point,
  Theme, CableColor, SocketColors,
  RenderOptions, LayoutOptions,
  ParseResult, ParseDiagnostic, ErrorCode, ErrorSeverity,
  DeepPartial,
} from './types';
