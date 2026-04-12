import type {
  ParseResult,
  PatchGraph,
  Block,
  Connection,
  Param,
  ParseDiagnostic,
  SignalType,
} from './types';
import { SIGNAL_OPERATORS } from './types';
import { errorMessages, editDistance } from './errors';

// ── Helpers ──

function normalize(str: string): string {
  return str.trim().toLowerCase().replace(/\s+/g, '-');
}

function makeBlockId(module: string, section: string): string {
  return `${normalize(module)}--${normalize(section)}`;
}

function parseGraphvizExtras(str: string): Record<string, string> {
  const result: Record<string, string> = {};
  // str is content inside [], e.g. "color=red, weight=3"
  const parts = str.split(',');
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx !== -1) {
      const key = part.slice(0, eqIdx).trim();
      const value = part.slice(eqIdx + 1).trim();
      result[key] = value;
    }
  }
  return result;
}

function parseEndpoint(raw: string): { module: string; section: string | null; port: string } | null {
  const trimmed = raw.trim();

  // Find port in parentheses
  const openParen = trimmed.lastIndexOf('(');
  const closeParen = trimmed.lastIndexOf(')');
  if (openParen === -1 || closeParen === -1 || closeParen < openParen) {
    return null;
  }

  const port = trimmed.slice(openParen + 1, closeParen);
  const before = trimmed.slice(0, openParen).trim();

  // Check for dot notation
  const dotIdx = before.indexOf('.');
  if (dotIdx !== -1) {
    const module = before.slice(0, dotIdx).trim();
    const section = before.slice(dotIdx + 1).trim();
    return { module, section, port };
  }

  return { module: before, section: null, port };
}

// Sort operators longest first to avoid substring collisions
const SORTED_OPERATORS = Object.keys(SIGNAL_OPERATORS).sort((a, b) => b.length - a.length);

function findOperator(line: string): { operator: string; index: number } | null {
  for (const op of SORTED_OPERATORS) {
    const idx = line.indexOf(op);
    if (idx !== -1) {
      return { operator: op, index: idx };
    }
  }
  return null;
}

// ── Main Parser ──

export function parse(input: string): ParseResult {
  const errors: ParseDiagnostic[] = [];
  const warnings: ParseDiagnostic[] = [];

  // Normalize line endings
  const normalized = input.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  const declaredModules: Map<string, Block> = new Map(); // lowercase name -> Block
  const allBlocks: Map<string, Block> = new Map(); // blockId -> Block
  const connections: Connection[] = [];

  let currentModuleName: string | null = null;
  let currentVoice: string | null = null;
  const voices: string[] = [];
  let lastParam: Param | null = null;
  let connectionCounter = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineNum = lineIdx + 1;

    // Blank lines
    if (line.trim() === '') continue;

    // Version header
    if (line.startsWith('# patchflow')) continue;

    // Comments
    if (line.trim().startsWith('//')) continue;

    // Connection lines
    if (line.trimStart().startsWith('- ')) {
      lastParam = null;
      const connLine = line.trimStart().slice(2); // strip "- "

      // Extract annotation (trailing // comment)
      let annotation: string | null = null;
      let workLine = connLine;
      const annotationIdx = workLine.indexOf(' // ');
      if (annotationIdx !== -1) {
        annotation = workLine.slice(annotationIdx + 4).trim();
        workLine = workLine.slice(0, annotationIdx);
      }

      // Extract graphviz extras [key=val, ...]
      let graphvizExtras: Record<string, string> | null = null;
      const bracketOpen = workLine.lastIndexOf('[');
      const bracketClose = workLine.lastIndexOf(']');
      if (bracketOpen !== -1 && bracketClose !== -1 && bracketClose > bracketOpen) {
        const extrasStr = workLine.slice(bracketOpen + 1, bracketClose);
        graphvizExtras = parseGraphvizExtras(extrasStr);
        workLine = workLine.slice(0, bracketOpen).trim();
      }

      // Find operator
      const opResult = findOperator(workLine);
      if (!opResult) {
        errors.push({
          code: 'SYNTAX_ERROR',
          message: errorMessages.syntaxError('no valid operator found'),
          line: lineNum,
          column: 1,
          length: line.length,
          severity: 'error',
        });
        continue;
      }

      const { operator, index: opIdx } = opResult;
      const signalType = SIGNAL_OPERATORS[operator];
      const sourcePart = workLine.slice(0, opIdx).trim();
      const targetPart = workLine.slice(opIdx + operator.length).trim();

      // Parse endpoints
      const sourceEndpoint = parseEndpoint(sourcePart);
      const targetEndpoint = parseEndpoint(targetPart);

      if (!sourceEndpoint) {
        errors.push({
          code: 'MISSING_PORT',
          message: errorMessages.missingPort('source'),
          line: lineNum,
          column: 1,
          length: line.length,
          severity: 'error',
        });
        continue;
      }

      if (!targetEndpoint) {
        errors.push({
          code: 'MISSING_PORT',
          message: errorMessages.missingPort('target'),
          line: lineNum,
          column: 1,
          length: line.length,
          severity: 'error',
        });
        continue;
      }

      // Resolve blocks for source and target
      const sourceBlock = resolveBlock(sourceEndpoint, currentVoice);
      const targetBlock = resolveBlock(targetEndpoint, currentVoice);

      // Ensure ports exist on blocks
      ensurePort(sourceBlock, sourceEndpoint.port, 'out');
      ensurePort(targetBlock, targetEndpoint.port, 'in');

      const conn: Connection = {
        id: `conn-${connectionCounter++}`,
        source: {
          blockId: sourceBlock.id,
          portId: sourceEndpoint.port.trim().toLowerCase(),
          portDisplay: sourceEndpoint.port.trim(),
        },
        target: {
          blockId: targetBlock.id,
          portId: targetEndpoint.port.trim().toLowerCase(),
          portDisplay: targetEndpoint.port.trim(),
        },
        signalType,
        annotation,
        graphvizExtras,
      };

      connections.push(conn);
      continue;
    }

    // Multiline params
    if (line.trimStart().startsWith('|')) {
      if (lastParam) {
        const value = line.trimStart().slice(1).trim();
        lastParam.value += '; ' + value;
      }
      continue;
    }

    // Parameters
    if (line.trimStart().startsWith('*')) {
      const paramContent = line.trimStart().slice(1).trim();
      const colonIdx = paramContent.indexOf(':');
      let key: string;
      let value: string;
      if (colonIdx !== -1) {
        key = paramContent.slice(0, colonIdx).trim();
        value = paramContent.slice(colonIdx + 1).trim();
      } else {
        key = paramContent;
        value = '';
      }

      const param: Param = { key, value };
      lastParam = param;

      // Add to current module
      if (currentModuleName) {
        const lowerName = currentModuleName.toLowerCase();
        const block = declaredModules.get(lowerName);
        if (block) {
          block.params.push(param);
        }
      }
      continue;
    }

    // Module/Voice declarations (lines ending with :)
    if (line.trim().endsWith(':') && !line.trim().startsWith('-') && !line.trim().startsWith('*') && !line.trim().startsWith('|')) {
      lastParam = null;
      const moduleName = line.trim().slice(0, -1).trim();

      // Voice declaration: "VOICE <something>" — tag subsequent items, don't create a block
      if (/^voice\s+/i.test(moduleName)) {
        currentVoice = moduleName;
        currentModuleName = null;
        if (!voices.includes(moduleName)) {
          voices.push(moduleName);
        }
        continue;
      }

      // Module declaration
      currentModuleName = moduleName;

      const lowerName = moduleName.toLowerCase();
      if (!declaredModules.has(lowerName)) {
        const block: Block = {
          id: normalize(moduleName),
          label: moduleName,
          subLabel: null,
          params: [],
          ports: [],
          parentModule: null,
          voice: currentVoice,
        };
        declaredModules.set(lowerName, block);
        allBlocks.set(block.id, block);
      }
      continue;
    }

    // If we get here, it's unrecognized — record an error and skip
    errors.push({
      code: 'SYNTAX_ERROR',
      message: errorMessages.syntaxError('unrecognized line format'),
      line: lineNum,
      column: 1,
      length: line.length,
      severity: 'error',
    });
  }

  // ── Post-processing ──

  // Separate declared vs stub blocks
  let declaredBlocksList: Block[] = [...declaredModules.values()];
  const stubBlocks: Block[] = [];
  for (const [id, block] of allBlocks) {
    if (![...declaredModules.values()].find(b => b.id === id)) {
      stubBlocks.push(block);
    }
  }

  // ── Parent-module-with-sections post-processing ──
  // For each declared block, if it has child sections (blocks with parentModule === this.label),
  // migrate matching params to sections. Remove parent if empty and not directly referenced.
  const blocksToRemove: Set<string> = new Set();
  for (const parent of declaredBlocksList) {
    const parentLabelLower = parent.label.trim().toLowerCase();
    const childSections: Block[] = [];
    for (const block of [...declaredBlocksList, ...stubBlocks]) {
      if (block.parentModule && block.parentModule.trim().toLowerCase() === parentLabelLower) {
        childSections.push(block);
      }
    }
    if (childSections.length === 0) continue;

    // Migrate matching params
    const remainingParams: Param[] = [];
    for (const param of parent.params) {
      const keyLower = param.key.trim().toLowerCase();
      const matchingSection = childSections.find(
        s => s.label.trim().toLowerCase() === keyLower
      );
      if (matchingSection) {
        matchingSection.params.push(param);
      } else {
        remainingParams.push(param);
      }
    }
    parent.params = remainingParams;

    // If parent has no remaining params AND is not directly connected, remove it
    if (remainingParams.length === 0) {
      const directlyReferenced = connections.some(
        c => c.source.blockId === parent.id || c.target.blockId === parent.id
      );
      if (!directlyReferenced) {
        blocksToRemove.add(parent.id);
      }
    }
  }
  if (blocksToRemove.size > 0) {
    declaredBlocksList = declaredBlocksList.filter(b => !blocksToRemove.has(b.id));
  }

  // ── Feedback detection ──
  const { forward, feedback } = detectFeedbackEdges(connections);

  // ── Signal type stats ──
  const signalTypeStats: Partial<Record<SignalType, number>> = {};
  for (const conn of [...forward, ...feedback]) {
    signalTypeStats[conn.signalType] = (signalTypeStats[conn.signalType] || 0) + 1;
  }

  // ── Edit-distance warnings ──
  const declaredNames = [...declaredModules.keys()]; // already lowercase
  for (const stub of stubBlocks) {
    const stubLower = stub.label.toLowerCase();
    for (const declName of declaredNames) {
      const dist = editDistance(stubLower, declName);
      if (dist > 0 && dist <= 2) {
        const declBlock = declaredModules.get(declName)!;
        warnings.push({
          code: 'UNKNOWN_MODULE',
          message: errorMessages.didYouMean(stub.label, declBlock.label),
          line: 0,
          column: 1,
          length: stub.label.length,
          severity: 'warning',
        });
        break;
      }
    }
  }

  const graph: PatchGraph = {
    declaredBlocks: declaredBlocksList,
    stubBlocks,
    connections: forward,
    feedbackEdges: feedback,
    signalTypeStats,
    voices,
  };

  return { graph, errors, warnings };

  // ── Inner helper functions ──

  function resolveBlock(
    endpoint: { module: string; section: string | null; port: string },
    voice: string | null
  ): Block {
    const { module, section } = endpoint;

    if (section) {
      // Dot notation: Module.Section
      const blockId = makeBlockId(module, section);
      if (allBlocks.has(blockId)) {
        return allBlocks.get(blockId)!;
      }
      const block: Block = {
        id: blockId,
        label: section,
        subLabel: null,
        params: [],
        ports: [],
        parentModule: module,
        voice,
      };
      allBlocks.set(blockId, block);
      return block;
    }

    // No section — look up in declared modules first (case-insensitive)
    const lowerModule = module.toLowerCase();
    if (declaredModules.has(lowerModule)) {
      return declaredModules.get(lowerModule)!;
    }

    // Check if we already have it in allBlocks
    const blockId = normalize(module);
    if (allBlocks.has(blockId)) {
      return allBlocks.get(blockId)!;
    }

    // Create a new block (will end up as stub)
    const block: Block = {
      id: blockId,
      label: module,
      subLabel: null,
      params: [],
      ports: [],
      parentModule: null,
      voice,
    };
    allBlocks.set(blockId, block);
    return block;
  }

  function ensurePort(block: Block, portName: string, direction: 'in' | 'out'): void {
    const portId = portName.trim().toLowerCase();
    const existing = block.ports.find(p => p.id === portId && p.direction === direction);
    if (!existing) {
      block.ports.push({
        id: portId,
        display: portName.trim(),
        direction,
      });
    }
  }
}

// ── Feedback Edge Detection ──

function detectFeedbackEdges(connections: Connection[]): {
  forward: Connection[];
  feedback: Connection[];
} {
  if (connections.length === 0) {
    return { forward: [], feedback: [] };
  }

  // Build adjacency list (block-level)
  const adjacency: Map<string, Set<string>> = new Map();
  const edgeMap: Map<string, Connection[]> = new Map(); // "src->tgt" -> connections

  for (const conn of connections) {
    const src = conn.source.blockId;
    const tgt = conn.target.blockId;

    if (!adjacency.has(src)) adjacency.set(src, new Set());
    adjacency.get(src)!.add(tgt);

    const edgeKey = `${src}->${tgt}`;
    if (!edgeMap.has(edgeKey)) edgeMap.set(edgeKey, []);
    edgeMap.get(edgeKey)!.push(conn);
  }

  // DFS cycle detection
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color: Map<string, number> = new Map();
  const backEdges: Set<string> = new Set(); // edge keys that form cycles

  // Get all nodes
  const nodes = new Set<string>();
  for (const conn of connections) {
    nodes.add(conn.source.blockId);
    nodes.add(conn.target.blockId);
  }
  for (const node of nodes) {
    color.set(node, WHITE);
  }

  function dfs(u: string): void {
    color.set(u, GRAY);
    const neighbors = adjacency.get(u) || new Set();
    for (const v of neighbors) {
      const c = color.get(v) ?? WHITE;
      if (c === GRAY) {
        // Back edge found
        backEdges.add(`${u}->${v}`);
      } else if (c === WHITE) {
        dfs(v);
      }
    }
    color.set(u, BLACK);
  }

  for (const node of nodes) {
    if (color.get(node) === WHITE) {
      dfs(node);
    }
  }

  // Partition connections
  const forward: Connection[] = [];
  const feedback: Connection[] = [];

  for (const conn of connections) {
    const edgeKey = `${conn.source.blockId}->${conn.target.blockId}`;
    if (backEdges.has(edgeKey)) {
      feedback.push(conn);
    } else {
      forward.push(conn);
    }
  }

  return { forward, feedback };
}
