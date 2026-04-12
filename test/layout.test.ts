import { describe, it, expect } from 'bun:test';
import { layout, checkHeightInvariant } from '../src/layout';
import { parse } from '../src/parser';
import type { LayoutBlock, PatchGraph } from '../src/types';

function parseGraph(input: string): PatchGraph {
  const result = parse(input);
  if (!result.graph) throw new Error('Parse failed: ' + result.errors.map(e => e.message).join(', '));
  return result.graph;
}

describe('layout', () => {
  it('positions blocks left-to-right', () => {
    const graph = parseGraph('- A (Out) >> B (In)');
    const result = layout(graph);
    expect(result.blocks).toHaveLength(2);
    const blockA = result.blocks.find(b => b.label === 'A')!;
    const blockB = result.blocks.find(b => b.label === 'B')!;
    expect(blockA.x).toBeLessThan(blockB.x);
  });

  it('places input ports on left, output ports on right', () => {
    const graph = parseGraph('- A (Out) >> B (In)');
    const result = layout(graph);
    const blockA = result.blocks.find(b => b.label === 'A')!;
    const outPort = blockA.ports.find(p => p.id === 'out')!;
    expect(outPort.position.x).toBeGreaterThanOrEqual(blockA.x + blockA.width * 0.5);
  });

  it('routes connections as SVG paths', () => {
    const graph = parseGraph('- A (Out) >> B (In)');
    const result = layout(graph);
    expect(result.connections).toHaveLength(1);
    expect(result.connections[0].path).toContain('M');
  });

  it('routes feedback edges as arcs below blocks', () => {
    const graph = parseGraph([
      '- A (Out) >> B (In)',
      '- B (Out) >> A (In)',
    ].join('\n'));
    const result = layout(graph);
    const total = result.connections.length;
    const feedbackConns = result.connections.filter(c => c.isFeedback);
    expect(total).toBe(2);
    expect(feedbackConns).toHaveLength(1);
    expect(feedbackConns[0].path).toBeTruthy();
  });

  it('computes overall width and height', () => {
    const graph = parseGraph('- A (Out) >> B (In)');
    const result = layout(graph);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('handles self-patching sections as separate nodes', () => {
    const graph = parseGraph([
      'MATHS:',
      '* CH 1: Cycle ON',
      '- MATHS.CH 1 (OUT) >> MATHS.CH 2 (In)',
    ].join('\n'));
    const result = layout(graph);
    const ch1 = result.blocks.find(b => b.label === 'CH 1');
    const ch2 = result.blocks.find(b => b.label === 'CH 2');
    expect(ch1).toBeDefined();
    expect(ch2).toBeDefined();
    expect(ch1!.x).not.toBe(ch2!.x);
  });

  it('passes through signalTypeStats', () => {
    const graph = parseGraph('- A (Out) >> B (In)');
    const result = layout(graph);
    expect(result.signalTypeStats.cv).toBe(1);
  });

  it('routes self-loop forward connections as arc below block', () => {
    // A self-loop in the forward-edges list (not feedback) — constructed
    // programmatically because the parser classifies self-loops as feedback.
    const graph: PatchGraph = {
      declaredBlocks: [
        {
          id: 'a',
          label: 'A',
          subLabel: null,
          params: [],
          ports: [
            { id: 'out', display: 'Out', direction: 'out' },
            { id: 'in', display: 'In', direction: 'in' },
          ],
          parentModule: null,
          voice: null,
        },
      ],
      stubBlocks: [],
      connections: [
        {
          id: 'c-0',
          source: { blockId: 'a', portId: 'out', portDisplay: 'Out' },
          target: { blockId: 'a', portId: 'in', portDisplay: 'In' },
          signalType: 'cv',
          annotation: null,
          graphvizExtras: null,
        },
      ],
      feedbackEdges: [],
      signalTypeStats: { cv: 1 },
      voices: [],
    };
    const result = layout(graph);
    expect(result.connections).toHaveLength(1);
    const conn = result.connections[0];
    expect(conn.isFeedback).toBe(false);
    expect(conn.path).toBeTruthy();
    expect(conn.path).not.toContain('NaN');
  });

  it('promotes a port to "out" when a connection uses an "in"-only declared port as source', () => {
    // Hand-crafted graph: block A has a port "foo" declared as 'in', and a
    // connection uses it as source. collectPorts should override to 'out'.
    const graph: PatchGraph = {
      declaredBlocks: [
        {
          id: 'a',
          label: 'A',
          subLabel: null,
          params: [],
          ports: [{ id: 'foo', display: 'foo', direction: 'in' }],
          parentModule: null,
          voice: null,
        },
        {
          id: 'b',
          label: 'B',
          subLabel: null,
          params: [],
          ports: [{ id: 'in', display: 'In', direction: 'in' }],
          parentModule: null,
          voice: null,
        },
      ],
      stubBlocks: [],
      connections: [
        {
          id: 'c-0',
          source: { blockId: 'a', portId: 'foo', portDisplay: 'foo' },
          target: { blockId: 'b', portId: 'in', portDisplay: 'In' },
          signalType: 'cv',
          annotation: null,
          graphvizExtras: null,
        },
      ],
      feedbackEdges: [],
      signalTypeStats: { cv: 1 },
      voices: [],
    };
    const result = layout(graph);
    const blockA = result.blocks.find(b => b.id === 'a')!;
    // Port should now be 'out' on the right face of the block
    const foo = blockA.ports.find(p => p.id === 'foo')!;
    expect(foo.direction).toBe('out');
    expect(foo.position.x).toBe(blockA.x + blockA.width);
  });

  it('adds a missing target port as "in" when it is absent from the block', () => {
    // Block B has zero declared ports; connection targets b.in — collectPorts
    // adds it as 'in' (lines 84-88).
    const graph: PatchGraph = {
      declaredBlocks: [
        {
          id: 'a',
          label: 'A',
          subLabel: null,
          params: [],
          ports: [{ id: 'out', display: 'Out', direction: 'out' }],
          parentModule: null,
          voice: null,
        },
        {
          id: 'b',
          label: 'B',
          subLabel: null,
          params: [],
          ports: [],
          parentModule: null,
          voice: null,
        },
      ],
      stubBlocks: [],
      connections: [
        {
          id: 'c-0',
          source: { blockId: 'a', portId: 'out', portDisplay: 'Out' },
          target: { blockId: 'b', portId: 'in', portDisplay: 'In' },
          signalType: 'cv',
          annotation: null,
          graphvizExtras: null,
        },
      ],
      feedbackEdges: [],
      signalTypeStats: { cv: 1 },
      voices: [],
    };
    const result = layout(graph);
    const blockB = result.blocks.find(b => b.id === 'b')!;
    const inPort = blockB.ports.find(p => p.id === 'in')!;
    expect(inPort).toBeDefined();
    expect(inPort.direction).toBe('in');
  });

  it('falls back to any-direction port match when direction does not match', () => {
    // Block A has only an 'in' port for "shared"; connection references it as
    // source (out). After the promotion above, the port is 'out'. To hit the
    // "any port with same id" fallback, we need two ports on the block with
    // different ids, then a connection asking for the wrong direction.
    // Simpler: block has port "foo" only as 'out', but connection's target
    // asks for "foo" as 'in' — findPortPosition falls back to the 'out' port.
    const graph: PatchGraph = {
      declaredBlocks: [
        {
          id: 'a',
          label: 'A',
          subLabel: null,
          params: [],
          ports: [{ id: 'shared', display: 'Shared', direction: 'out' }],
          parentModule: null,
          voice: null,
        },
        {
          id: 'b',
          label: 'B',
          subLabel: null,
          params: [],
          ports: [{ id: 'shared', display: 'Shared', direction: 'out' }],
          parentModule: null,
          voice: null,
        },
      ],
      stubBlocks: [],
      connections: [
        {
          id: 'c-0',
          // source uses 'shared' as out (matches exactly on A)
          source: { blockId: 'a', portId: 'shared', portDisplay: 'Shared' },
          // target wants 'shared' as 'in' on B, but B only has it as 'out' —
          // findPortPosition for target falls back to the 'out' port.
          target: { blockId: 'b', portId: 'shared', portDisplay: 'Shared' },
          signalType: 'cv',
          annotation: null,
          graphvizExtras: null,
        },
      ],
      feedbackEdges: [],
      signalTypeStats: { cv: 1 },
      voices: [],
    };
    const result = layout(graph);
    expect(result.connections).toHaveLength(1);
    const conn = result.connections[0];
    const blockB = result.blocks.find(b => b.id === 'b')!;
    // Because B only has 'shared' as 'out' (right face), targetPoint.x equals right-face x
    expect(conn.targetPoint.x).toBe(blockB.x + blockB.width);
  });

  it('derives signal type per port from connections', () => {
    const graph = parseGraph('- A (Out) p> B (1v/oct)');
    const result = layout(graph);
    const a = result.blocks.find(b => b.label === 'A')!;
    const outPort = a.ports.find(p => p.id === 'out')!;
    expect(outPort.signalType).toBe('pitch');
    const b = result.blocks.find(b => b.label === 'B')!;
    const inPort = b.ports.find(p => p.id === '1v/oct')!;
    expect(inPort.signalType).toBe('pitch');
  });

  it('derives signal type from feedback edges when port is only used in feedback', () => {
    const graph = parseGraph([
      '- A (Out) -> B (In)',
      '- B (FbOut) p> A (FbIn)',
    ].join('\n'));
    const result = layout(graph);
    const b = result.blocks.find(bl => bl.label === 'B')!;
    const fbOut = b.ports.find(p => p.id === 'fbout')!;
    expect(fbOut.signalType).toBe('pitch');
  });

  it('handles the MATHS bouncing ball patch', () => {
    const graph = parseGraph([
      'MATHS:',
      '* CH 1: Cycle ON',
      "* CH 2: Attenuverter ~2 o'clock",
      '',
      '- MATHS.CH 1 (OUT) >> MATHS.CH 2 (In)',
      '- MATHS.CH 2 (Out) >> MATHS.CH 1 (Fall CV) // shortens fall each cycle',
    ].join('\n'));
    const result = layout(graph);
    // Should have CH 1 and CH 2 blocks
    expect(result.blocks.length).toBeGreaterThanOrEqual(2);
    // Should have one forward and one feedback connection
    expect(result.connections.length).toBe(2);
    const feedback = result.connections.filter(c => c.isFeedback);
    expect(feedback.length).toBe(1);
    // Path should not contain NaN
    for (const c of result.connections) {
      expect(c.path).not.toContain('NaN');
    }
  });

  describe('post-layout invariants', () => {
    it('returns an empty warnings list when layout is consistent', () => {
      const graph = parseGraph('- A (Out) >> B (In)');
      const result = layout(graph);
      expect(result.warnings).toBeDefined();
      expect(result.warnings).toEqual([]);
    });

    it('produces no warnings for diagrams that include feedback', () => {
      const graph = parseGraph([
        '- A (Out) >> B (In)',
        '- B (Out) >> A (In)',
      ].join('\n'));
      const result = layout(graph);
      expect(result.warnings).toEqual([]);
    });

    it('keeps the computed height at or above every block bottom', () => {
      const graph = parseGraph([
        '- A (Out) >> B (In)',
        '- B (Out) >> C (In)',
        '- C (Out) >> D (In)',
      ].join('\n'));
      const result = layout(graph);
      const maxBottom = Math.max(...result.blocks.map(b => b.y + b.height));
      expect(result.height).toBeGreaterThanOrEqual(maxBottom);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('checkHeightInvariant', () => {
    const block = (y: number, height: number): LayoutBlock => ({
      id: 'b', label: 'B', subLabel: null, params: [], ports: [],
      parentModule: null, x: 0, y, width: 100, height,
    });

    it('returns no warnings when height covers block content', () => {
      const warnings = checkHeightInvariant({
        blocks: [block(0, 100)],
        height: 120,
        hasFeedback: false,
        feedbackBottom: 0,
      });
      expect(warnings).toEqual([]);
    });

    it('warns when computed height is below block bottom', () => {
      const warnings = checkHeightInvariant({
        blocks: [block(0, 200)],
        height: 100,
        hasFeedback: false,
        feedbackBottom: 0,
      });
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('computed height');
      expect(warnings[0]).toContain('below content bottom');
    });

    it('warns when feedback-arc bottom extends past computed height', () => {
      const warnings = checkHeightInvariant({
        blocks: [block(0, 100)],
        height: 150,
        hasFeedback: true,
        feedbackBottom: 200,
      });
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('200');
    });

    it('handles empty block lists without throwing', () => {
      const warnings = checkHeightInvariant({
        blocks: [],
        height: 0,
        hasFeedback: false,
        feedbackBottom: 0,
      });
      expect(warnings).toEqual([]);
    });
  });
});
