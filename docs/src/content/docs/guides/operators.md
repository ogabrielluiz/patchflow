---
title: Signal operators
description: The six cable operators patchflow understands, and how each one is rendered.
---

patchflow uses different operators to mark different *kinds* of cables. The
cable's color — and whether it looks like a single strand or a bundle — is
driven entirely by this operator.

## The six operators

| Operator | Signal type | Typical use                                |
|----------|-------------|--------------------------------------------|
| `->`     | `audio`     | Audio-rate signals (VCO → filter → VCA).  |
| `>>`     | `cv`        | Slow control voltage (LFO → filter cutoff).|
| `p>`     | `pitch`     | 1 V/oct pitch signal.                      |
| `g>`     | `gate`      | Gate (sustained ON/OFF).                   |
| `t>`     | `trigger`   | Trigger (momentary pulse).                 |
| `c>`     | `clock`     | Clock signal.                              |

Every operator uses the same notation — the letter just changes the cable
color and adds a small pill label on the cable when relevant.

```text
- Osc (Out)       -> Filter (In)        // audio cable
- LFO (Out)       >> Filter (Cutoff)    // CV cable
- Keyboard (V/Oct) p> Osc (V/Oct)       // pitch cable
- Sequencer (Gate) g> Env (Gate)        // gate cable
- Clock (Trig)    t> Drum (Trig)        // trigger cable
- Clock (Out)     c> Sequencer (Clock)  // clock cable
```

## Default cable colors

The default theme picks colors chosen to read distinctly in both light and dark
modes — loosely following what you'd expect from a well-stocked cable bag.

- **Audio** — pink
- **CV** — blue
- **Pitch** — green
- **Gate / Trigger / Clock** — amber

See the [Theming guide](../theming/) to override any of these.

## Feedback edges

patchflow automatically detects cycles in your patch (e.g. the classic
self-patched MATHS bouncing ball) and routes those cables on a separate
"feedback" lane **below** the modules, so they don't collide with the main
signal flow.

You don't need to mark a connection as feedback — it's derived from the graph.

## Why a taxonomy?

Color-coding cables by *signal intent* rather than by *audio vs control* lets
the diagram carry more information without any extra ink:

- A reader can trace the "pitch spine" of a patch at a glance.
- Copy-pasting a subpatch keeps its semantic colors.
- You can grep the notation for `p>` to audit every pitch connection.

If your rig doesn't care about the distinction, feel free to use `->` and `>>`
exclusively — the other operators are there when you want them.
