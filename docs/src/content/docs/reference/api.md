---
title: API reference
description: Functions exported by @ogabrielluiz/patchflow.
---

Everything documented here is exported from the package root:

```ts
import {
  render,
  parse,
  layout,
  renderSvg,
  createTheme,
  defaultTheme,
  darkTheme,
} from '@ogabrielluiz/patchflow';
```

Types are re-exported too — see the [Types reference](../types/).

---

## `render(notation, options?)`

High-level convenience: parse → layout → render in one call.

```ts
function render(notation: string, options?: RenderOptions): string;
```

- **`notation`** — a patchflow notation string. See [Notation syntax](../../guides/notation/).
- **`options.theme`** — a full `Theme` or a `DeepPartial<Theme>` to merge over
  the default.
- **`options.maxWidth`** · **`options.padding`** · **`options.legend`** —
  reserved for future use; currently ignored.
- **Returns** an SVG string.
- **Throws** `Error` if the parsed graph has zero modules (declared + stub)
  and zero connections (forward + feedback) — in other words, only when
  there's nothing to draw. Ordinary syntax errors are reported as diagnostics
  on the parse result but do *not* throw — `render()` proceeds if any
  renderable content exists.

```ts
const svg = render(notation, { theme: darkTheme });
```

---

## `parse(notation)`

Parse notation into a `PatchGraph`, with structured diagnostics.

```ts
function parse(notation: string): ParseResult;

interface ParseResult {
  graph: PatchGraph;
  errors:   ParseDiagnostic[];
  warnings: ParseDiagnostic[];
}
```

`parse()` never throws. It always returns a graph (possibly empty) plus arrays
of `ParseDiagnostic` describing what went wrong. Each diagnostic has a machine-
readable `code`, a human-readable `message`, and line/column/length pointing to
the offending range.

```ts
const { graph, errors, warnings } = parse(notation);
if (errors.length) {
  for (const err of errors) {
    console.error(`${err.line}:${err.column} ${err.code}: ${err.message}`);
  }
}
```

See [`ErrorCode`](../types/#errorcode) for the full list of codes.

---

## `layout(graph, options?)`

Assign positions to blocks and route cables.

```ts
function layout(graph: PatchGraph, options?: LayoutOptions): LayoutResult;
```

- **`graph`** — a `PatchGraph` (typically from `parse()`).
- **`options`** — see [Layout options](../../guides/layout/).
- **Returns** a `LayoutResult` with positioned blocks, SVG path strings for
  every cable, overall `width`/`height`, and any non-fatal `warnings`.

```ts
const positioned = layout(graph, { direction: 'LR' });
```

---

## `renderSvg(layoutResult, theme)`

Render a positioned layout to an SVG string.

```ts
function renderSvg(layoutResult: LayoutResult, theme: Theme): string;
```

- **`layoutResult`** — the output of `layout()`.
- **`theme`** — a full `Theme` (not a partial). Use `defaultTheme`,
  `darkTheme`, or a result of `createTheme()`.
- **Returns** an SVG string.

```ts
const svg = renderSvg(positioned, darkTheme);
```

---

## `createTheme(overrides)`

Factory that merges a `DeepPartial<Theme>` into `defaultTheme` and returns a
full `Theme`.

```ts
function createTheme(overrides: DeepPartial<Theme>): Theme;
```

`overrides` is required. If you just want a fresh full theme without any
customization, import `defaultTheme` directly. The returned object is a plain
object (not frozen) — treat it as immutable by convention.

```ts
const myTheme = createTheme({
  panel: { fill: '#141414', stroke: '#2a2a2a' },
});
```

---

## `defaultTheme` · `darkTheme`

Ready-made `Theme` values. Import and use directly — they're plain objects,
not factories.

```ts
import { render, darkTheme } from '@ogabrielluiz/patchflow';
render(notation, { theme: darkTheme });
```

Treat them as immutable — don't mutate the exported objects. Use
`createTheme(overrides)` or spread into a new object if you need changes.
