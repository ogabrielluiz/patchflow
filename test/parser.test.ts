import { describe, it, expect } from 'bun:test';
import { parse } from '../src/parser';

describe('parser', () => {
  describe('basic connections', () => {
    it('parses a single CV connection', () => {
      const result = parse('- Oscillator (Out) >> Filter (In)');
      expect(result.errors).toHaveLength(0);
      expect(result.graph).not.toBeNull();
      expect(result.graph!.connections).toHaveLength(1);
      const conn = result.graph!.connections[0];
      expect(conn.signalType).toBe('cv');
      expect(conn.source.portDisplay).toBe('Out');
      expect(conn.target.portDisplay).toBe('In');
    });

    it('parses all six signal operators', () => {
      const lines = [
        '- A (Out) -> B (In)',
        '- C (Out) >> D (In)',
        '- E (Out) p> F (In)',
        '- G (Out) g> H (In)',
        '- I (Out) t> J (In)',
        '- K (Out) c> L (In)',
      ];
      const result = parse(lines.join('\n'));
      expect(result.errors).toHaveLength(0);
      expect(result.graph!.connections).toHaveLength(6);
      const types = result.graph!.connections.map(c => c.signalType);
      expect(types).toEqual(['audio', 'cv', 'pitch', 'gate', 'trigger', 'clock']);
    });

    it('parses inline annotations from // comments', () => {
      const result = parse('- A (Out) >> B (In) // modulates cutoff');
      expect(result.graph!.connections[0].annotation).toBe('modulates cutoff');
    });

    it('parses graphviz extras and stores them', () => {
      const result = parse('- A (Out) >> B (In) [color=red, weight=3]');
      expect(result.graph!.connections[0].graphvizExtras).toEqual({
        color: 'red',
        weight: '3',
      });
    });
  });

  describe('module declarations', () => {
    it('parses module with params', () => {
      const result = parse('MATHS:\n* CH 1: Cycle ON');
      expect(result.graph!.declaredBlocks.length).toBeGreaterThanOrEqual(1);
    });

    it('parses multiline params', () => {
      const result = parse('OSC:\n* Settings\n| waveform = saw\n| octave = 2');
      const block = result.graph!.declaredBlocks.find(b => b.label === 'OSC');
      expect(block).toBeDefined();
      expect(block!.params.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('dot notation', () => {
    it('creates separate blocks for sections', () => {
      const result = parse([
        'MATHS:',
        '* CH 1: Cycle ON',
        '- MATHS.CH 1 (OUT) >> MATHS.CH 2 (In)',
      ].join('\n'));
      expect(result.errors).toHaveLength(0);
      const blocks = [...result.graph!.declaredBlocks, ...result.graph!.stubBlocks];
      const ch1 = blocks.find(b => b.label === 'CH 1');
      const ch2 = blocks.find(b => b.label === 'CH 2');
      expect(ch1).toBeDefined();
      expect(ch1!.parentModule).toBe('MATHS');
      expect(ch2).toBeDefined();
    });
  });

  describe('stub blocks', () => {
    it('undeclared modules become stubBlocks', () => {
      const result = parse('- MATHS (Out) >> VCA (In)');
      expect(result.graph!.stubBlocks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('voices', () => {
    it('parses voice declarations', () => {
      const result = parse('VOICE 1:\n- Osc (Out) -> Filter (In)');
      expect(result.graph!.voices).toContain('VOICE 1');
    });
  });

  describe('voice declarations do not create blocks', () => {
    it('VOICE 1: adds to voices but does not create a declared block', () => {
      const result = parse('VOICE 1:\n- Osc (Out) -> Filter (In)');
      expect(result.graph!.voices).toContain('VOICE 1');
      expect(result.graph!.declaredBlocks.find(b => b.label === 'VOICE 1')).toBeUndefined();
    });
  });

  describe('parent module with sections', () => {
    it('moves params to matching sections', () => {
      const result = parse([
        'MATHS:',
        '* CH 1: Cycle ON',
        '* CH 2: Attenuverter ~2 o\'clock',
        '- MATHS.CH 1 (OUT) >> MATHS.CH 2 (In)',
      ].join('\n'));
      const allBlocks = [...result.graph!.declaredBlocks, ...result.graph!.stubBlocks];
      const ch1 = allBlocks.find(b => b.label === 'CH 1');
      const ch2 = allBlocks.find(b => b.label === 'CH 2');
      expect(ch1).toBeDefined();
      expect(ch2).toBeDefined();
      expect(ch1!.params).toContainEqual({ key: 'CH 1', value: 'Cycle ON' });
      expect(ch2!.params.some(p => p.value.includes('Attenuverter'))).toBe(true);
    });

    it('removes parent block when all params are moved and no direct connections', () => {
      const result = parse([
        'MATHS:',
        '* CH 1: Cycle ON',
        '- MATHS.CH 1 (OUT) >> Filter (In)',
      ].join('\n'));
      expect(result.graph!.declaredBlocks.find(b => b.label === 'MATHS')).toBeUndefined();
    });

    it('keeps parent block when it has direct connections', () => {
      const result = parse([
        'MATHS:',
        '* CH 1: Cycle ON',
        '- MATHS (Out) >> Filter (In)',
        '- MATHS.CH 1 (OUT) >> VCA (In)',
      ].join('\n'));
      const allBlocks = [...result.graph!.declaredBlocks, ...result.graph!.stubBlocks];
      expect(allBlocks.find(b => b.label === 'MATHS' && b.parentModule === null)).toBeDefined();
    });

    it('keeps params on parent if no matching section', () => {
      const result = parse([
        'MATHS:',
        '* Global: mode 1',
        '- MATHS.CH 1 (OUT) >> Filter (In)',
      ].join('\n'));
      const allBlocks = [...result.graph!.declaredBlocks, ...result.graph!.stubBlocks];
      const maths = allBlocks.find(b => b.label === 'MATHS' && b.parentModule === null);
      expect(maths).toBeDefined();
      expect(maths!.params).toContainEqual({ key: 'Global', value: 'mode 1' });
    });
  });

  describe('normalization', () => {
    it('normalizes port names case-insensitively', () => {
      const result = parse('- A (Out) >> B (In)\n- B (OUT) >> C (In)');
      const bSource = result.graph!.connections[1].source;
      expect(bSource.portId).toBe('out');
      expect(bSource.portDisplay).toBe('OUT');
    });

    it('normalizes module names case-insensitively', () => {
      const result = parse('MATHS:\n- Maths (Out) >> VCA (In)');
      expect(result.graph!.stubBlocks.find(b => b.label.toLowerCase() === 'maths')).toBeUndefined();
    });
  });

  describe('error recovery', () => {
    it('skips malformed lines and continues', () => {
      const result = parse('- A (Out) >> B (In)\n- garbage ???\n- C (Out) -> D (In)');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.graph).not.toBeNull();
      expect(result.graph!.connections).toHaveLength(2);
    });

    it('never throws', () => {
      expect(() => parse('')).not.toThrow();
      expect(() => parse('!@#$%^&*()')).not.toThrow();
      expect(() => parse('\n\n\n')).not.toThrow();
    });
  });

  describe('signalTypeStats', () => {
    it('counts signal types', () => {
      const result = parse('- A (Out) >> B (In)\n- A (Out2) >> C (In)\n- D (Out) -> E (In)');
      expect(result.graph!.signalTypeStats.cv).toBe(2);
      expect(result.graph!.signalTypeStats.audio).toBe(1);
    });
  });

  describe('feedback detection', () => {
    it('detects feedback edges', () => {
      const result = parse('- A (Out) >> B (In)\n- B (Out) >> A (In)');
      const total = result.graph!.connections.length + result.graph!.feedbackEdges.length;
      expect(total).toBe(2);
      expect(result.graph!.feedbackEdges.length).toBe(1);
    });
  });

  describe('edit-distance warnings', () => {
    it('warns on likely typos', () => {
      const result = parse('MATHS:\n- MATH (Out) >> VCA (In)');
      const typoWarning = result.warnings.find(w => w.message.includes('Did you mean'));
      expect(typoWarning).toBeDefined();
    });
  });

  describe('version header', () => {
    it('ignores # patchflow v1 header', () => {
      const result = parse('# patchflow v1\n- A (Out) >> B (In)');
      expect(result.errors).toHaveLength(0);
      expect(result.graph!.connections).toHaveLength(1);
    });
  });
});
