import dagre from '@dagrejs/dagre';
import type {
  Block,
  Connection,
  LayoutBlock,
  LayoutConnection,
  LayoutOptions,
  LayoutPort,
  LayoutResult,
  PatchGraph,
  Point,
  Port,
  SignalType,
} from './types';
import { feedbackArcPath, selfLoopArcPath, smoothstepPath } from './edge-routing';

// ── Dimension estimation (no DOM) ──

const MIN_WIDTH = 140;
const MIN_HEIGHT = 90;

function getBlockDimensions(block: Block, portCount: number): { width: number; height: number } {
  // Main label uses 14px bold with 3px letter-spacing, so per-char width is
  // larger than plain 8px — use 11 to avoid overflow (matches renderer fit).
  const labelWidth = block.label.length * 11;
  const subLabelWidth = block.subLabel ? block.subLabel.length * 7 : 0;
  const paramWidths = block.params.map(p => (`${p.key}: ${p.value}`).length * 7);
  const longestParam = paramWidths.length > 0 ? Math.max(...paramWidths) : 0;

  const width = Math.max(
    labelWidth + 40,
    subLabelWidth + 40,
    longestParam + 30,
    MIN_WIDTH,
  );

  const labelArea = 50;
  const subLabelArea = block.subLabel ? 18 : 0;
  const paramsArea = 20 * block.params.length;
  const portsArea = Math.max((portCount / 2) * 24, 30);
  const padding = 20;

  const height = Math.max(labelArea + subLabelArea + paramsArea + portsArea + padding, MIN_HEIGHT);

  return { width, height };
}

// ── Port collection ──

/**
 * Collect ports on every block based on all connections (forward + feedback).
 * If a port appears as both in and out, 'out' wins (source).
 */
function collectPorts(
  blocks: Block[],
  connections: Connection[],
): Map<string, Port[]> {
  // Start from whatever ports each block already has declared.
  const byBlock = new Map<string, Map<string, Port>>();
  for (const block of blocks) {
    const map = new Map<string, Port>();
    for (const p of block.ports) {
      // dedupe key ignores direction here; 'out' wins later if conflict
      const existing = map.get(p.id);
      if (!existing || (existing.direction === 'in' && p.direction === 'out')) {
        map.set(p.id, { ...p });
      }
    }
    byBlock.set(block.id, map);
  }

  for (const conn of connections) {
    const srcBlock = byBlock.get(conn.source.blockId);
    if (srcBlock) {
      const existing = srcBlock.get(conn.source.portId);
      if (!existing || existing.direction === 'in') {
        srcBlock.set(conn.source.portId, {
          id: conn.source.portId,
          display: conn.source.portDisplay,
          direction: 'out',
        });
      }
    }
    const tgtBlock = byBlock.get(conn.target.blockId);
    if (tgtBlock) {
      const existing = tgtBlock.get(conn.target.portId);
      if (!existing) {
        tgtBlock.set(conn.target.portId, {
          id: conn.target.portId,
          display: conn.target.portDisplay,
          direction: 'in',
        });
      }
      // if existing is 'out', keep it ('out' wins)
    }
  }

  const result = new Map<string, Port[]>();
  for (const [blockId, map] of byBlock) {
    result.set(blockId, Array.from(map.values()));
  }
  return result;
}

// ── Port placement on block faces ──

/**
 * Compute the Y coordinate of the first port in a cluster so that the cluster
 * is vertically centered in the available area below the inset label and above
 * the block's bottom edge.
 */
function startYForFace(blockY: number, blockHeight: number, portCount: number): number {
  const topMargin = 40;    // below inset label recess
  const bottomMargin = 30; // above block bottom edge
  const topY = blockY + topMargin;
  const bottomY = blockY + blockHeight - bottomMargin;
  const availableHeight = bottomY - topY;
  const clusterHeight = Math.max(0, (portCount - 1) * 24);
  return topY + (availableHeight - clusterHeight) / 2;
}

function placePorts(block: LayoutBlock, ports: Port[]): LayoutPort[] {
  const inPorts = ports.filter(p => p.direction === 'in');
  const outPorts = ports.filter(p => p.direction === 'out');

  const layoutPorts: LayoutPort[] = [];
  const spacing = 24;

  const inStartY = startYForFace(block.y, block.height, inPorts.length);
  inPorts.forEach((p, i) => {
    layoutPorts.push({
      ...p,
      position: { x: block.x, y: inStartY + i * spacing },
      signalType: null,
    });
  });

  const outStartY = startYForFace(block.y, block.height, outPorts.length);
  outPorts.forEach((p, i) => {
    layoutPorts.push({
      ...p,
      position: { x: block.x + block.width, y: outStartY + i * spacing },
      signalType: null,
    });
  });

  return layoutPorts;
}

// ── Signal type derivation ──

/**
 * For each port, pick a signal type. Prefer forward edges; fall back to feedback.
 * For outputs: first connection where this port is the source.
 * For inputs: first connection where this port is the target.
 */
function assignPortSignalTypes(
  blocks: LayoutBlock[],
  forward: Connection[],
  feedback: Connection[],
): void {
  const pick = (
    blockId: string,
    portId: string,
    direction: 'in' | 'out',
    connections: Connection[],
  ): SignalType | null => {
    for (const conn of connections) {
      if (direction === 'out') {
        if (conn.source.blockId === blockId && conn.source.portId === portId) {
          return conn.signalType;
        }
      } else {
        if (conn.target.blockId === blockId && conn.target.portId === portId) {
          return conn.signalType;
        }
      }
    }
    return null;
  };

  for (const block of blocks) {
    for (const port of block.ports) {
      const fromForward = pick(block.id, port.id, port.direction, forward);
      if (fromForward) {
        port.signalType = fromForward;
        continue;
      }
      const fromFeedback = pick(block.id, port.id, port.direction, feedback);
      if (fromFeedback) {
        port.signalType = fromFeedback;
      }
    }
  }
}

// ── Lookup helpers ──

function findPortPosition(
  block: LayoutBlock,
  portId: string,
  direction: 'in' | 'out',
): Point {
  const exact = block.ports.find(p => p.id === portId && p.direction === direction);
  if (exact) return exact.position;
  // fallback: any port with same id (different direction) — collectPorts
  // synthesizes every connection endpoint, so the only way to miss an exact
  // match is a direction mismatch on a port that exists in the block.
  const any = block.ports.find(p => p.id === portId)!;
  return any.position;
}

// ── Main ──

export function layout(graph: PatchGraph, options: LayoutOptions = {}): LayoutResult {
  const direction = options.direction ?? 'LR';
  const rankSep = options.rankSep ?? 120;
  const nodeSep = options.nodeSep ?? 40;

  const allBlocks: Block[] = [...graph.declaredBlocks, ...graph.stubBlocks];

  // Collect ports using both forward and feedback edges
  const allConnections = [...graph.connections, ...graph.feedbackEdges];
  const portsByBlock = collectPorts(allBlocks, allConnections);

  // Compute dimensions for each block
  const dimsByBlock = new Map<string, { width: number; height: number }>();
  for (const block of allBlocks) {
    const ports = portsByBlock.get(block.id) ?? [];
    dimsByBlock.set(block.id, getBlockDimensions(block, ports.length));
  }

  // Build dagre graph
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    ranksep: rankSep,
    nodesep: nodeSep,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const block of allBlocks) {
    const d = dimsByBlock.get(block.id)!;
    g.setNode(block.id, { width: d.width, height: d.height });
  }

  // Forward edges only (skip self-loops to avoid dagre issues)
  for (const conn of graph.connections) {
    if (conn.source.blockId === conn.target.blockId) continue;
    g.setEdge(conn.source.blockId, conn.target.blockId);
  }

  dagre.layout(g);

  // Extract positioned blocks
  const layoutBlocks: LayoutBlock[] = [];
  const blocksById = new Map<string, LayoutBlock>();

  for (const block of allBlocks) {
    const node = g.node(block.id);
    const d = dimsByBlock.get(block.id)!;
    const nodeX = node?.x ?? 0;
    const nodeY = node?.y ?? 0;
    const x = nodeX - d.width / 2;
    const y = nodeY - d.height / 2;

    const partial: LayoutBlock = {
      id: block.id,
      label: block.label,
      subLabel: block.subLabel,
      params: block.params,
      ports: [],
      parentModule: block.parentModule,
      x,
      y,
      width: d.width,
      height: d.height,
    };
    const ports = portsByBlock.get(block.id) ?? [];
    partial.ports = placePorts(partial, ports);
    layoutBlocks.push(partial);
    blocksById.set(block.id, partial);
  }

  // Assign signal types to each port based on connections
  assignPortSignalTypes(layoutBlocks, graph.connections, graph.feedbackEdges);

  // Compute diagram bounds
  let maxX = 0;
  let maxY = 0;
  for (const b of layoutBlocks) {
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }

  const hasFeedback = graph.feedbackEdges.length > 0;
  const feedbackArcOffset = 20;
  const diagramBottom = maxY + 10;

  // Route connections
  const layoutConnections: LayoutConnection[] = [];

  for (const conn of graph.connections) {
    const srcBlock = blocksById.get(conn.source.blockId);
    const tgtBlock = blocksById.get(conn.target.blockId);
    if (!srcBlock || !tgtBlock) continue;

    const srcPos = findPortPosition(srcBlock, conn.source.portId, 'out');
    const tgtPos = findPortPosition(tgtBlock, conn.target.portId, 'in');

    let path: string;
    if (conn.source.blockId === conn.target.blockId) {
      const blockBottom = srcBlock.y + srcBlock.height;
      path = selfLoopArcPath(srcPos, tgtPos, blockBottom, 20);
    } else {
      path = smoothstepPath(srcPos, tgtPos);
    }

    layoutConnections.push({
      id: conn.id,
      source: conn.source,
      target: conn.target,
      signalType: conn.signalType,
      annotation: conn.annotation,
      path,
      isFeedback: false,
      sourcePoint: srcPos,
      targetPoint: tgtPos,
    });
  }

  for (const conn of graph.feedbackEdges) {
    const srcBlock = blocksById.get(conn.source.blockId);
    const tgtBlock = blocksById.get(conn.target.blockId);
    if (!srcBlock || !tgtBlock) continue;

    const srcPos = findPortPosition(srcBlock, conn.source.portId, 'out');
    const tgtPos = findPortPosition(tgtBlock, conn.target.portId, 'in');

    const path = feedbackArcPath(srcPos, tgtPos, diagramBottom, feedbackArcOffset);

    layoutConnections.push({
      id: conn.id,
      source: conn.source,
      target: conn.target,
      signalType: conn.signalType,
      annotation: conn.annotation,
      path,
      isFeedback: true,
      sourcePoint: srcPos,
      targetPoint: tgtPos,
    });
  }

  // Overall dimensions
  const margin = 20;
  // Feedback arcs drop to diagramBottom + feedbackArcOffset and carry an
  // annotation below them, so reserve enough room for the arc + the
  // annotation line + its text stroke padding.
  const feedbackSpace = hasFeedback
    ? (diagramBottom - maxY) + feedbackArcOffset + 30 + 16
    : 0;
  const width = maxX + margin;
  const height = maxY + margin + feedbackSpace;

  // Post-layout safety check: the computed `height` should always sit at or
  // below the true content bottom (block bottoms, plus feedback arc dip if
  // present). The renderer relies on this invariant when reserving bottom
  // padding for the legend and annotation notes — if it's violated, they can
  // render over block content. We emit a warning rather than throwing so a
  // regression is visible without breaking callers.
  const warnings = checkHeightInvariant({
    blocks: layoutBlocks,
    height,
    hasFeedback,
    feedbackBottom: diagramBottom + feedbackArcOffset,
  });

  return {
    blocks: layoutBlocks,
    connections: layoutConnections,
    width,
    height,
    signalTypeStats: graph.signalTypeStats,
    warnings,
  };
}

/**
 * Verifies that the computed layout height fully contains the block content
 * (and any feedback-arc dip). Returns a list of diagnostic warnings — empty
 * when the invariant holds. Exported so the guard can be unit-tested directly.
 */
export function checkHeightInvariant(args: {
  blocks: LayoutBlock[];
  height: number;
  hasFeedback: boolean;
  feedbackBottom: number;
}): string[] {
  const { blocks, height, hasFeedback, feedbackBottom } = args;
  const warnings: string[] = [];
  const blockBottomMax = blocks.length > 0
    ? Math.max(...blocks.map(b => b.y + b.height))
    : 0;
  const contentBottom = hasFeedback
    ? Math.max(blockBottomMax, feedbackBottom)
    : blockBottomMax;
  if (height < contentBottom) {
    warnings.push(
      `layout: computed height (${height.toFixed(1)}) is below content bottom (${contentBottom.toFixed(1)}); legend/notes may overlap block content`,
    );
  }
  return warnings;
}
