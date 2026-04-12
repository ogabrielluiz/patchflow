import { describe, it, expect } from 'bun:test';
import { layout } from '../src/layout';
import { parse } from '../src/parser';
import type { PatchGraph } from '../src/types';

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
});
