import { describe, it, expect } from 'bun:test';
import type {
  SignalType, Port, Block, Connection, PatchGraph,
  LayoutBlock, LayoutConnection, LayoutResult,
  Theme, CableColor, SocketColors, RenderOptions, LayoutOptions,
  ParseResult, DeepPartial,
} from '../src/types';

describe('types', () => {
  it('SignalType covers all six operators', () => {
    const types: SignalType[] = ['audio', 'cv', 'pitch', 'gate', 'trigger', 'clock'];
    expect(types).toHaveLength(6);
  });

  it('PatchGraph has declaredBlocks, stubBlocks, feedbackEdges, signalTypeStats', () => {
    const graph: PatchGraph = {
      declaredBlocks: [],
      stubBlocks: [],
      connections: [],
      feedbackEdges: [],
      signalTypeStats: {},
      voices: [],
    };
    expect(graph.declaredBlocks).toEqual([]);
    expect(graph.feedbackEdges).toEqual([]);
  });

  it('Block has id, label, subLabel, params, ports, voice', () => {
    const block: Block = {
      id: 'maths.ch-1',
      label: 'CH 1',
      subLabel: 'FUNCTION GENERATOR',
      params: [{ key: 'Cycle', value: 'ON' }],
      ports: [],
      parentModule: 'MATHS',
      voice: null,
    };
    expect(block.id).toBe('maths.ch-1');
    expect(block.parentModule).toBe('MATHS');
  });

  it('Connection has source, target, signalType, annotation, graphvizExtras', () => {
    const conn: Connection = {
      id: 'conn-0',
      source: { blockId: 'maths.ch-1', portId: 'out', portDisplay: 'OUT' },
      target: { blockId: 'maths.ch-2', portId: 'in', portDisplay: 'In' },
      signalType: 'cv',
      annotation: 'shortens fall each cycle',
      graphvizExtras: null,
    };
    expect(conn.signalType).toBe('cv');
    expect(conn.annotation).toBe('shortens fall each cycle');
  });

  it('DeepPartial makes nested fields optional', () => {
    const partial: DeepPartial<Theme> = {
      cable: { width: 5 },
    };
    expect(partial.cable?.width).toBe(5);
    expect(partial.panel).toBeUndefined();
  });
});
