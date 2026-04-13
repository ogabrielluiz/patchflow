---
title: Notation syntax
description: The full Patchbook-compatible grammar patchflow understands.
---

The patchflow notation is line-oriented. Blank lines are insignificant. Lines
starting with `//` are comments. Everything else is either a **connection**, a
**module header**, a **parameter**, or a **voice marker**.

## Connections

A connection is a line that starts with `-`:

```text
- <source endpoint> <operator> <target endpoint>
```

An **endpoint** has the shape `Module (Port)` or `Module.Section (Port)`. The
port is always the last parenthesized token in the endpoint.

```text
- Oscillator (Out) -> Filter (In)
- MATHS.CH 1 (OUT) >> MATHS.CH 2 (In)
```

Port and module names are matched **case-insensitively** with surrounding
whitespace trimmed — `OUT`, `Out`, and `out` all refer to the same port. The
original capitalization is preserved for rendering.

Internal whitespace inside a name is **not** collapsed for lookup. A module
declared as `Low Pass` won't match a reference to `LowPass` or `Low  Pass`
(note the double space). Keep your spacing consistent between the
declaration and every connection that references it.

### Annotations

Add a trailing comment with `//` — it becomes a small label printed near the
cable's midpoint:

```text
- LFO (Out) >> VCA (CV) // tremolo, slow
```

### Graphviz extras (advanced)

Any `[key=value, ...]` segment appended before the annotation is parsed into
`graphvizExtras` on the connection. patchflow itself doesn't render these, but
they're preserved in the graph for downstream tools.

```text
- Clock (Out) c> Sequencer (In) [weight=5]
```

## Modules and sections

Any module name you use in a connection becomes a **stub block** unless you
*declare* it with a header line. A declaration lets you attach parameters, a
subtitle, or section breakdowns.

### Basic declaration

```text
Filter:
* Cutoff: 2 kHz
* Resonance: 0.6
```

The header ends with `:` and must be the full module name. Parameters follow,
each starting with `*`.

### Subtitle / variant

Add a bracketed subtitle after the name:

```text
Filter [Low Pass]:
* Cutoff: 2 kHz
```

### Sections (composite modules like MATHS)

Many modules have multiple functional channels. Declare the parent with
parameters keyed by channel, and address each section with dot-notation
(`Module.Section`) inside connections:

```text
MATHS:
* CH 1: Cycle ON
* CH 2: Attenuverter ~2 o'clock

- MATHS.CH 1 (OUT) >> MATHS.CH 2 (In)
```

Each section is laid out as its own panel, side-by-side with any sibling
sections. If every parameter on the parent matches a section name (as above),
the parser **migrates** those params to their corresponding section panels and
removes the parent block entirely (unless the parent is also directly wired).
So `MATHS` above becomes two sibling panels labeled "CH 1" and "CH 2",
each carrying its own parameter plate — no outer "MATHS" panel wraps them.

## Voices

A **voice marker** tags every block declared after it with a voice name. The
parser records each voice in `graph.voices` and each block's `voice` field,
which is useful if you want to post-process the graph — highlighting a voice,
extracting it, or driving a legend.

```text
VOICE 1:
- Osc1 (Out) -> Mixer (In1)
- Env1 (Out) >> VCA1 (CV)

VOICE 2:
- Osc2 (Out) -> Mixer (In2)
- Env2 (Out) >> VCA2 (CV)
```

:::caution
Voice markers are **parse-time metadata only**. The current layout and
renderer ignore the `voice` field — a voice isn't drawn as a group.

The tag is also **frozen at each block's first appearance**: a block that
first shows up under `VOICE 1:` keeps `voice = "VOICE 1"` forever, even if
it's wired again below `VOICE 2:`. A new block that only appears after the
last `VOICE …:` marker gets that last voice's tag. If you need voices drawn
as enclosing groups, read `graph.voices` and build that overlay yourself.
:::

## Comments

Any line starting with `//` is ignored. Trailing `// text` on a connection line
becomes an annotation (see above).

```text
// ── voice 1 ──
- Osc1 (Out) -> Mixer (In1)   // saw wave
```

## Error handling

`parse()` never throws on ordinary syntax issues. Instead it returns a
`ParseResult` with `errors` and `warnings` arrays of `ParseDiagnostic`s, each
pointing to the offending line and column. The `render()` convenience function
*does* throw, but only when the final graph has **no modules and no
connections** — because there's nothing to draw.

See the [API reference](../../reference/api/) for the full diagnostic shape.
