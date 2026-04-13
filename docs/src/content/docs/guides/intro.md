---
title: Introduction
description: What patchflow is, what problem it solves, and how its pipeline fits together.
---

**patchflow** turns a plain-text description of a eurorack patch into an SVG
block diagram that looks like a panel, not a dataflow chart.

If you've ever tried to document a patch by taking phone photos of a cluttered
rig, or by drawing boxes in a generic diagramming tool, you know the pain: the
diagram ages badly, the cable colors mean nothing, and nobody can tell an audio
signal from a clock at a glance.

patchflow fixes that with two ideas:

1. **A Patchbook-compatible notation** you write by hand (or generate from
   something else) — concise, line-oriented, and easy to diff in git.
2. **A deterministic, themeable SVG renderer** that draws modules as panels
   with real sockets, parameter plates, and cables color-coded by signal type.

## The pipeline

Every render passes through three stages. You can call the convenience function
`render()` to do all three, or compose them yourself.

```
notation string
     │
     │  parse()
     ▼
PatchGraph            ← declared blocks, stub blocks, connections, voices
     │
     │  layout()
     ▼
LayoutResult          ← positioned blocks, routed cables (SVG paths)
     │
     │  renderSvg()
     ▼
SVG string
```

- **`parse()`** validates the notation and produces a `PatchGraph`, along with
  structured diagnostics (`errors` + `warnings`) for any issues it finds. It
  never throws on ordinary syntax problems — you get a graph back anyway so
  tooling can surface errors inline.
- **`layout()`** runs the graph through [dagre](https://github.com/dagrejs/dagre)
  to place modules, then routes cables: forward edges as smoothstep cubic
  beziers, feedback edges as U-shaped polylines below the diagram, and
  self-loops as small arcs. The result includes block positions, port
  coordinates, and SVG `d` attributes for every cable.
- **`renderSvg()`** takes the positioned layout plus a `Theme` and emits an SVG
  string. It's the only stage that touches colors, fonts, or visual styling.

## When to use patchflow

- **Documenting patches** in a repo, wiki, or blog post.
- **Generating diagrams in CI** — the samples on this very site are produced by
  a GitHub Action on every push.
- **Teaching** — a cable colored like CV next to a cable colored like audio
  tells a student more than a legend ever will.
- **Prototyping** a rig before buying modules — sketch the signal flow, iterate
  on the notation, print the result.

## What patchflow is *not*

- Not a rack planner. It doesn't know about HP, depth, or power draw.
  Use [ModularGrid](https://www.modulargrid.net/) for that.
- Not a simulator. It draws the patch; it doesn't play it.
- Not opinionated about module names — you can use `VCO`, `Plaits`, `Osc1`, or
  anything else. Modules are whatever you say they are.

## Next

Head to the [Quickstart](../quickstart/) to install the library and render your
first diagram, or open the [Playground](../../playground/) to experiment
without installing anything.
