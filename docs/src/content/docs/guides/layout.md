---
title: Layout options
description: Tweak the automatic layout — direction and spacing.
---

Under the hood, patchflow uses [dagre](https://github.com/dagrejs/dagre) to
assign block positions, then routes cables with a custom edge router that
handles port geometry, signal-type pills, and feedback lanes.

You can call `layout()` yourself if you need more control than `render()`
exposes.

## Calling layout directly

```ts
import { parse, layout, renderSvg, darkTheme } from '@ogabrielluiz/patchflow';

const { graph } = parse(notation);
const positioned = layout(graph, {
  direction: 'LR',   // 'LR' (default) or 'TB'
  nodeSep: 40,       // px between nodes in the same rank
  rankSep: 120,      // px between ranks
});
const svg = renderSvg(positioned, darkTheme);
```

## LayoutOptions

| Field          | Default | Description                                               |
|----------------|---------|-----------------------------------------------------------|
| `direction`    | `'LR'`  | `'LR'` = left-to-right flow, `'TB'` = top-to-bottom.      |
| `nodeSep`      | `40`    | Horizontal separation between sibling nodes (LR) / vertical (TB). |
| `rankSep`      | `120`   | Separation between successive ranks.                      |
| `feedbackSide` | —       | Reserved on the type; currently ignored. Feedback always routes below the diagram. |

`nodeSep` and `rankSep` are handed straight to dagre; see its docs for the
exact behavior at extreme values.

## Feedback cables

When patchflow detects a cycle (e.g. `A.out → B.in`, `B.out → A.in`), it marks
the cable that closes the loop as a **feedback edge** and routes it along a
dedicated lane **below** the block row. This keeps the main signal flow
readable.

Feedback edges are still rendered with their signal color — the difference is
purely geometric. Forward cables are drawn as smoothstep cubic beziers;
feedback edges are routed as U-shaped polylines under the diagram; self-loops
use a small arc.

## Diagnostics

`layout()` may emit non-fatal `warnings` on the returned `LayoutResult`. They
indicate internal consistency issues (e.g. a block whose computed height
undershoots its actual content). You can ignore them in production but they're
invaluable when debugging a custom theme or renderer extension.

```ts
const positioned = layout(graph);
if (positioned.warnings?.length) {
  console.warn('layout warnings:', positioned.warnings);
}
```
