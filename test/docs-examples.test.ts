import { describe, it, expect } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse, render } from '../src/index';

// ── Extraction ──

const DOCS_ROOT = join(import.meta.dir, '..', 'docs', 'src', 'content', 'docs');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.md') || entry.endsWith('.mdx')) out.push(full);
  }
  return out;
}

interface Example {
  file: string;   // path relative to repo root
  line: number;   // 1-based line where the sample starts
  source: string;
  origin: 'fence' | 'patch';
}

const NOTATION_HINT = /(^|\n)\s*(-\s|VOICE\s|[A-Z][\w ]*:\s*$)/;

function extractExamples(filePath: string): Example[] {
  const rel = relative(join(import.meta.dir, '..'), filePath);
  const text = readFileSync(filePath, 'utf8');
  const examples: Example[] = [];

  // Fenced `text` blocks
  const fenceRe = /```text\n([\s\S]*?)\n```/g;
  for (const m of text.matchAll(fenceRe)) {
    const body = m[1]!;
    if (!NOTATION_HINT.test(body)) continue;
    // Skip grammar sketches that use `<metasyntax>` placeholders.
    if (/<[a-z][\w\s]*>/i.test(body)) continue;
    const line = text.slice(0, m.index).split('\n').length;
    examples.push({ file: rel, line, source: body, origin: 'fence' });
  }

  // <Patch source={`...`} ... />  (backtick-delimited literal)
  const patchRe = /<Patch\s+source=\{`([\s\S]*?)`\}/g;
  for (const m of text.matchAll(patchRe)) {
    const line = text.slice(0, m.index).split('\n').length;
    examples.push({ file: rel, line, source: m[1]!, origin: 'patch' });
  }

  return examples;
}

const allExamples: Example[] = walk(DOCS_ROOT).flatMap(extractExamples);

// ── Tests ──

describe('docs code examples', () => {
  it('finds a meaningful number of examples', () => {
    // Guards against a regex change silently disabling every assertion below.
    expect(allExamples.length).toBeGreaterThan(10);
  });

  describe.each(allExamples)('$file:$line ($origin)', (ex) => {
    it('parses without errors', () => {
      const result = parse(ex.source);
      if (result.errors.length) {
        throw new Error(
          `parse() errors in ${ex.file}:${ex.line}\n` +
          result.errors.map((e) => `  [${e.code}] ${e.message}`).join('\n') +
          `\n--- source ---\n${ex.source}`,
        );
      }
      // Non-empty graph: must have at least one block or connection to be a
      // useful doc example.
      const blocks = result.graph.declaredBlocks.length + result.graph.stubBlocks.length;
      const conns = result.graph.connections.length + result.graph.feedbackEdges.length;
      expect(blocks + conns).toBeGreaterThan(0);
    });

    it('renders to a non-empty SVG', () => {
      const svg = render(ex.source);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.length).toBeGreaterThan(100);
    });
  });
});

// ── Claim-carrying samples ──
//
// These tests lock in specific assertions made by the docs so that a parser
// change that silently contradicts the prose fails here.

describe('docs claim: voices are parse-time metadata that never reset', () => {
  const multiVoice = [
    'VOICE 1:',
    '- Osc1 (Out) -> Mixer (In1)',
    '- Env1 (Out) >> VCA1 (CV)',
    '',
    'VOICE 2:',
    '- Osc2 (Out) -> Mixer (In2)',
    '- Env2 (Out) >> VCA2 (CV)',
    '',
    '- Mixer (Out) -> Filter (In)',
    '- Filter (Out) -> Output (In)',
  ].join('\n');

  it('records every VOICE header on graph.voices', () => {
    const { graph } = parse(multiVoice);
    expect(graph.voices).toEqual(['VOICE 1', 'VOICE 2']);
  });

  it("freezes each block's voice at first appearance; the marker never resets", () => {
    const { graph } = parse(multiVoice);
    const all = [...graph.declaredBlocks, ...graph.stubBlocks];
    const by = (label: string) => all.find((b) => b.label === label);

    // Mixer is first seen under VOICE 1, so it keeps VOICE 1 even though it is
    // wired again below VOICE 2.
    expect(by('Mixer')?.voice).toBe('VOICE 1');
    expect(by('Osc1')?.voice).toBe('VOICE 1');

    // Filter and Output first appear after VOICE 2 and have never been tagged
    // by anything else, so they are VOICE 2.
    expect(by('Filter')?.voice).toBe('VOICE 2');
    expect(by('Output')?.voice).toBe('VOICE 2');
  });
});

describe('docs claim: sections render as siblings; parent absorbed when all params migrate', () => {
  const mathsPatch = [
    'MATHS:',
    '* CH 1: Cycle ON',
    "* CH 2: Attenuverter ~2 o'clock",
    '',
    '- MATHS.CH 1 (OUT) >> MATHS.CH 2 (In)',
    '- MATHS.CH 2 (Out) >> MATHS.CH 1 (Fall CV)',
  ].join('\n');

  it('produces one block per section and no standalone parent block', () => {
    const { graph } = parse(mathsPatch);
    const blocks = [...graph.declaredBlocks, ...graph.stubBlocks];
    const labels = blocks.map((b) => b.label).sort();
    expect(labels).toEqual(['CH 1', 'CH 2']);
    // No block is a bare "MATHS" parent with no section.
    expect(blocks.some((b) => b.label === 'MATHS' && b.parentModule === null)).toBe(false);
  });

  it('migrates each parent param onto its matching section block', () => {
    const { graph } = parse(mathsPatch);
    const all = [...graph.declaredBlocks, ...graph.stubBlocks];
    const ch1 = all.find((b) => b.label === 'CH 1');
    const ch2 = all.find((b) => b.label === 'CH 2');
    expect(ch1?.params.length).toBeGreaterThan(0);
    expect(ch2?.params.length).toBeGreaterThan(0);
    // The migrated param value matches the parent-header param value.
    expect(ch1?.params[0]?.value).toBe('Cycle ON');
    expect(ch2?.params[0]?.value).toBe("Attenuverter ~2 o'clock");
    // Sections preserve their parent-module name for layering.
    expect(ch1?.parentModule).toBe('MATHS');
    expect(ch2?.parentModule).toBe('MATHS');
  });
});

describe('docs claim: render() throws only on empty patch', () => {
  it('throws for an empty string', () => {
    expect(() => render('')).toThrow();
  });

  it('does not throw for a patch with only stub blocks', () => {
    expect(() => render('- Osc (Out) -> Filter (In)')).not.toThrow();
  });
});

describe('docs claim: feedback routing is always detected automatically', () => {
  const selfFeedback = [
    '- A (Out) -> B (In)',
    '- B (Out) -> A (In)',
  ].join('\n');

  it('parser surfaces a feedback edge without user marking', () => {
    const { graph } = parse(selfFeedback);
    expect(graph.feedbackEdges.length).toBeGreaterThan(0);
  });
});
