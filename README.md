# patchflow

Eurorack patch diagram renderer. Patchbook-compatible notation to skeuomorphic SVG block diagrams.

## Install

```bash
npm install patchflow
```

## Usage

```ts
import { render } from 'patchflow';

const svg = render(`
MATHS:
* CH 1: Cycle ON
* CH 2: Attenuverter ~2 o'clock

- MATHS.CH 1 (OUT) >> MATHS.CH 2 (In)
- MATHS.CH 2 (Out) >> MATHS.CH 1 (Fall CV) // shortens fall each cycle
`);
```

## Signal Operators

| Operator | Signal Type |
|----------|-------------|
| `->` | Audio |
| `>>` | CV |
| `p>` | Pitch / 1V/oct |
| `g>` | Gate |
| `t>` | Trigger |
| `c>` | Clock |

## API

- `render(notation, options?)` — notation to SVG string
- `parse(notation)` — notation to PatchGraph
- `layout(graph, options?)` — PatchGraph to LayoutResult
- `renderSvg(layoutResult, theme)` — LayoutResult + Theme to SVG
- `createTheme(overrides)` — factory with deep partial merge

## License

MIT
