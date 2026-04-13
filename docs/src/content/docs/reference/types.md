---
title: Types
description: Every TypeScript type re-exported from @ogabrielluiz/patchflow, grouped by pipeline stage.
---

All types are re-exported from the package root. You can also import them
from `@ogabrielluiz/patchflow/types` if you only want types and no runtime.

## Signal types

```ts
type SignalType = 'audio' | 'cv' | 'pitch' | 'gate' | 'trigger' | 'clock';
```

## Graph primitives

```ts
interface Port {
  id: string;          // normalized (lowercase, whitespace-collapsed)
  display: string;     // original capitalization for rendering
  direction: 'in' | 'out';
}

interface Param {
  key: string;
  value: string;
}

interface Block {
  id: string;
  label: string;
  subLabel: string | null;
  params: Param[];
  ports: Port[];
  parentModule: string | null;  // null for top-level modules
  voice: string | null;
}

interface ConnectionEndpoint {
  blockId: string;
  portId: string;       // normalized
  portDisplay: string;  // original capitalization
}

interface Connection {
  id: string;
  source: ConnectionEndpoint;
  target: ConnectionEndpoint;
  signalType: SignalType;
  annotation: string | null;
  graphvizExtras: Record<string, string> | null;
}
```

## PatchGraph (parser output)

```ts
interface PatchGraph {
  declaredBlocks: Block[];
  stubBlocks:     Block[];
  connections:    Connection[];
  feedbackEdges:  Connection[];
  signalTypeStats: Partial<Record<SignalType, number>>;
  voices: string[];
}
```

- **`declaredBlocks`** — modules with an explicit header + params.
- **`stubBlocks`** — modules inferred from connections alone.
- **`connections`** — all non-feedback cables.
- **`feedbackEdges`** — cables that close a cycle; routed on their own lane.
- **`signalTypeStats`** — counts keyed by signal type (useful for legends).

## Layout output

```ts
interface Point { x: number; y: number; }

interface LayoutPort extends Port {
  position:   Point;
  signalType: SignalType | null;
}

interface LayoutBlock {
  id: string;
  label: string;
  subLabel: string | null;
  params: Param[];
  ports: LayoutPort[];
  parentModule: string | null;
  x: number;  y: number;
  width: number;  height: number;
}

interface LayoutConnection {
  id: string;
  source: ConnectionEndpoint;
  target: ConnectionEndpoint;
  signalType: SignalType;
  annotation: string | null;
  path: string;           // SVG "d" attribute, ready for <path>
  isFeedback: boolean;
  sourcePoint: Point;
  targetPoint: Point;
}

interface LayoutResult {
  blocks:      LayoutBlock[];
  connections: LayoutConnection[];
  width:  number;
  height: number;
  signalTypeStats: Partial<Record<SignalType, number>>;
  warnings?: string[];
}
```

## Theme

```ts
interface CableColor {
  stroke:  string;
  plugTip: string;
}

interface SocketColors {
  bezel:       string;
  bezelStroke: string;
  ring:        string;
  hole:        string;
  pin:         string;
}

interface Theme {
  background: string;
  panel: {
    fill: string; stroke: string;
    highlight: string; shadow: string;
    cornerRadius: number;
    shadowBlur: number;
    shadowOpacity: number;
    bevelWidth: number;
  };
  label: {
    fontFamily: string;
    color: string; subColor: string;
    plateFill: string; plateStroke: string;
  };
  param: {
    plateFill: string; plateStroke: string; textColor: string;
  };
  port: {
    fontFamily: string; fontSize: number;
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
```

## Options

```ts
interface RenderOptions {
  theme?:    DeepPartial<Theme>;
  maxWidth?: number;
  padding?:  number;
  legend?:   boolean | 'auto';
}

interface LayoutOptions {
  direction?:    'LR' | 'TB';     // default: 'LR'
  nodeSep?:      number;          // default: 40
  rankSep?:      number;          // default: 120
  feedbackSide?: 'top' | 'bottom'; // reserved; currently ignored
}
```

`feedbackSide` is declared for forward compatibility but not read by the
current layout — feedback edges always route below the diagram.

## Diagnostics

```ts
type ErrorCode =
  | 'SYNTAX_ERROR'
  | 'UNKNOWN_OPERATOR'
  | 'MISSING_PORT'
  | 'UNCLOSED_PAREN'
  | 'DUPLICATE_MODULE'
  | 'UNKNOWN_MODULE'
  | 'INVALID_PORT'
  | 'AMBIGUOUS_PORT_DIRECTION';

type ErrorSeverity = 'error' | 'warning';

interface ParseDiagnostic {
  code: ErrorCode;
  message: string;
  line: number;       // 1-based source line, or 0 for graph-level diagnostics
  column: number;     // 1-based
  length: number;     // span length in characters
  severity: ErrorSeverity;
}

interface ParseResult {
  graph: PatchGraph;
  errors:   ParseDiagnostic[];
  warnings: ParseDiagnostic[];
}
```

Only a subset of `ErrorCode` is currently emitted by the parser:

| Code                        | Severity | When                                                   |
|-----------------------------|----------|--------------------------------------------------------|
| `SYNTAX_ERROR`              | error    | Malformed connection line, unparseable endpoint, etc.  |
| `MISSING_PORT`              | error    | Connection endpoint missing a `(PortName)` segment.    |
| `UNKNOWN_MODULE`            | warning  | Stub block name is within edit-distance 2 of a declared module — emitted as "Did you mean …". Uses `line: 0`. |
| `AMBIGUOUS_PORT_DIRECTION`  | warning  | A single port is used as both source and target across the patch. Uses `line: 0`. |

The other codes (`UNKNOWN_OPERATOR`, `UNCLOSED_PAREN`, `DUPLICATE_MODULE`,
`INVALID_PORT`) are declared on the union for forward compatibility but not
emitted yet — don't rely on them firing today.

## Utilities

```ts
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
```
