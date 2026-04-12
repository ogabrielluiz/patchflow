// ── Signal Types ──

export type SignalType = 'audio' | 'cv' | 'pitch' | 'gate' | 'trigger' | 'clock';

export const SIGNAL_OPERATORS: Record<string, SignalType> = {
  '->': 'audio',
  '>>': 'cv',
  'p>': 'pitch',
  'g>': 'gate',
  't>': 'trigger',
  'c>': 'clock',
};

// ── Graph Primitives ──

export interface Port {
  id: string;          // normalized key (lowercase, trimmed)
  display: string;     // original form for rendering
  direction: 'in' | 'out';
}

export interface Param {
  key: string;
  value: string;
}

export interface Block {
  id: string;
  label: string;
  subLabel: string | null;
  params: Param[];
  ports: Port[];
  parentModule: string | null;  // null for top-level modules, module name for sections
  voice: string | null;
}

export interface ConnectionEndpoint {
  blockId: string;
  portId: string;       // normalized key
  portDisplay: string;  // original form
}

export interface Connection {
  id: string;
  source: ConnectionEndpoint;
  target: ConnectionEndpoint;
  signalType: SignalType;
  annotation: string | null;
  graphvizExtras: Record<string, string> | null;
}

// ── Patch Graph (Parser Output) ──

export interface PatchGraph {
  declaredBlocks: Block[];
  stubBlocks: Block[];
  connections: Connection[];
  feedbackEdges: Connection[];
  signalTypeStats: Partial<Record<SignalType, number>>;
  voices: string[];
}

// ── Layout Types ──

export interface Point {
  x: number;
  y: number;
}

export interface LayoutPort extends Port {
  position: Point;
  signalType: SignalType | null;
}

export interface LayoutBlock {
  id: string;
  label: string;
  subLabel: string | null;
  params: Param[];
  ports: LayoutPort[];
  parentModule: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutConnection {
  id: string;
  source: ConnectionEndpoint;
  target: ConnectionEndpoint;
  signalType: SignalType;
  annotation: string | null;
  path: string;            // SVG path d attribute
  isFeedback: boolean;
  sourcePoint: Point;
  targetPoint: Point;
}

export interface LayoutResult {
  blocks: LayoutBlock[];
  connections: LayoutConnection[];
  width: number;
  height: number;
  signalTypeStats: Partial<Record<SignalType, number>>;
}

// ── Theme Types ──

export interface CableColor {
  stroke: string;
  plugTip: string;
}

export interface SocketColors {
  bezel: string;
  bezelStroke: string;
  ring: string;
  hole: string;
  pin: string;
}

export interface Theme {
  background: string;
  panel: {
    fill: string;
    stroke: string;
    highlight: string;
    shadow: string;
    cornerRadius: number;
    shadowBlur: number;
    shadowOpacity: number;
    bevelWidth: number;
  };
  label: {
    fontFamily: string;
    color: string;
    subColor: string;
    plateFill: string;
    plateStroke: string;
  };
  param: {
    plateFill: string;
    plateStroke: string;
    textColor: string;
  };
  port: {
    fontFamily: string;
    fontSize: number;
    colors: SocketColors;
    hideSocket: boolean;
    labelColor: string;
    pill: {
      show: boolean;
      fontSize: number;
      textColor: string;
      cornerRadius: number;
    };
  };
  cable: {
    width: number;
    colors: Record<SignalType, CableColor>;
    plugTipRadius: number;
  };
  annotation: {
    fontFamily: string;
    fontSize: number;
    color: string;
    haloColor: string;
  };
  grid: {
    dotColor: string;
    dotRadius: number;
    spacing: number;
    opacity: number;
  } | null;
}

// ── Options ──

export interface RenderOptions {
  theme?: DeepPartial<Theme>;
  maxWidth?: number;
  padding?: number;
  legend?: boolean | 'auto';
}

export interface LayoutOptions {
  direction?: 'LR' | 'TB';
  nodeSep?: number;
  rankSep?: number;
  feedbackSide?: 'top' | 'bottom';
}

// ── Parse Result ──

export type ErrorCode =
  | 'SYNTAX_ERROR'
  | 'UNKNOWN_OPERATOR'
  | 'MISSING_PORT'
  | 'UNCLOSED_PAREN'
  | 'DUPLICATE_MODULE'
  | 'UNKNOWN_MODULE'
  | 'INVALID_PORT';

export type ErrorSeverity = 'error' | 'warning';

export interface ParseDiagnostic {
  code: ErrorCode;
  message: string;
  line: number;
  column: number;
  length: number;
  severity: ErrorSeverity;
}

export interface ParseResult {
  graph: PatchGraph;
  errors: ParseDiagnostic[];
  warnings: ParseDiagnostic[];
}

// ── Utility Types ──

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
