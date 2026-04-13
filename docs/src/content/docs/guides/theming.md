---
title: Theming
description: Swap cable colors, panel finishes, fonts, and every other visual knob patchflow exposes.
---

patchflow's renderer is driven entirely by a `Theme` object. The package ships
two ready-made themes (`defaultTheme` for light UIs, `darkTheme` for dark UIs)
and a factory (`createTheme`) that merges a deep-partial override into the
default.

## Picking a built-in

```ts
import { render, defaultTheme, darkTheme } from '@ogabrielluiz/patchflow';

// Light (default)
render(notation);
render(notation, { theme: defaultTheme });

// Dark
render(notation, { theme: darkTheme });
```

Both themes use the same structural defaults — corner radii, bevels, typography
— and differ only in color. Swap them based on the target background.

## Overriding part of a theme

`render()` accepts a `DeepPartial<Theme>`, so you can change just the keys you
care about:

```ts
render(notation, {
  theme: {
    cable: {
      colors: {
        audio: { stroke: '#ff5f7a', plugTip: '#d94963' },
        cv:    { stroke: '#6fd0ff', plugTip: '#4db4e8' },
      },
    },
    panel: {
      fill: '#1a1815',
      stroke: '#55504a',
    },
  },
});
```

Anything you omit falls back to the default theme's value. Nested objects merge
recursively.

## Theme surface

Every top-level key on `Theme`:

| Key          | What it controls                                                     |
|--------------|----------------------------------------------------------------------|
| `panel`      | Module panel fill, stroke, bevel, drop shadow, corner radius.        |
| `label`      | Module title font, color, and the plate under the title.             |
| `param`      | Parameter plate fill/stroke and text color.                          |
| `port`       | Socket look, port-name font, and the signal-type "pill" chip.        |
| `cable`      | Per-signal cable colors, cable stroke width, plug-tip radius.        |
| `annotation` | Font, color, and font size for cable annotations (`// text`).        |
| `grid`       | Optional dot grid background (`null` to disable).                    |

See the [Types reference](../../reference/types/) for the full shape.

:::note
A few fields on `Theme` are declared on the type but not currently read by
the renderer: `background`, `annotation.haloColor`, and `label.subColor`.
They're reserved for future rendering features. Setting them has no visible
effect today.
:::

## Using `createTheme`

If you want to build a reusable theme (not just tweak one call), use
`createTheme`. It takes a required `DeepPartial<Theme>` and returns a full
`Theme` deep-merged over `defaultTheme`:

```ts
import { createTheme, render } from '@ogabrielluiz/patchflow';

const neonTheme = createTheme({
  panel: { fill: '#141414', stroke: '#2a2a2a' },
  cable: {
    colors: {
      audio:   { stroke: '#ff2d7a', plugTip: '#cc1f5f' },
      cv:      { stroke: '#2df0ff', plugTip: '#1fb8c7' },
      pitch:   { stroke: '#b2ff2d', plugTip: '#8fcc1f' },
      gate:    { stroke: '#ffb52d', plugTip: '#cc8f1f' },
      trigger: { stroke: '#ffb52d', plugTip: '#cc8f1f' },
      clock:   { stroke: '#ffb52d', plugTip: '#cc8f1f' },
    },
  },
});

const svg = render(notation, { theme: neonTheme });
```

A `createTheme()` call produces a full `Theme` — hand it straight to
`render()` or `renderSvg()`. The result is a plain object, not frozen; treat
it as immutable by convention.

## Tips

- **Grid on/off.** The dot grid is subtle but chatty. For tiny diagrams,
  setting `grid: null` keeps things clean.
- **SVG has no background rect.** The renderer never emits a background
  fill — embed the SVG in an element that has the color you want, or wrap it
  in a container in your site's CSS.
- **Typography.** The default stacks prefer system fonts. If you're rendering
  to PNG with resvg, you'll need the fonts available on the rendering machine.
- **Keep contrast honest.** Cable colors should stay distinct from each other
  *and* from the panel. The defaults are tuned for this; be careful when
  recoloring.
