import type {
  LayoutBlock,
  LayoutConnection,
  LayoutResult,
  SignalType,
  Theme,
} from './types';
import { sanitizeForSvg } from './errors';

// ── ID generation ──

function genId(): string {
  return 'pf-' + Math.random().toString(16).slice(2, 8);
}

// ── Accessibility summary ──

function buildDesc(layoutResult: LayoutResult): string {
  const blockCount = layoutResult.blocks.length;
  const connCount = layoutResult.connections.length;
  const stats = layoutResult.signalTypeStats;
  const statsParts: string[] = [];
  const order: SignalType[] = ['audio', 'cv', 'pitch', 'gate', 'trigger', 'clock'];
  for (const t of order) {
    const n = stats[t] ?? 0;
    if (n > 0) statsParts.push(`${n} ${t}`);
  }

  let summary = `Patch diagram with ${blockCount} module${blockCount === 1 ? '' : 's'} and ${connCount} connection${connCount === 1 ? '' : 's'}.`;

  if (blockCount > 0 && blockCount <= 6) {
    const names = layoutResult.blocks.map(b => sanitizeForSvg(b.label)).join(', ');
    summary += ` Modules: ${names}.`;
  }

  if (statsParts.length > 0) {
    summary += ` Signals: ${statsParts.join(', ')}.`;
  }

  return summary;
}

// ── Layer builders ──

function buildBackground(theme: Theme, idPrefix: string, width: number, height: number): string {
  if (!theme.grid) return '';
  return `<rect width="${width}" height="${height}" fill="url(#${idPrefix}-dots)"/>`;
}

function buildCables(theme: Theme, connections: LayoutConnection[]): string {
  const parts: string[] = [];
  const tips: string[] = [];

  for (const conn of connections) {
    const cableColor = theme.cable.colors[conn.signalType];
    parts.push(
      `<path d="${conn.path}" stroke="${cableColor.stroke}" stroke-width="${theme.cable.width}" ` +
      `fill="none" stroke-linecap="round" stroke-linejoin="round" ` +
      `data-connection="${sanitizeForSvg(conn.id)}" data-signal="${conn.signalType}"/>`,
    );
    tips.push(
      `<circle cx="${conn.sourcePoint.x}" cy="${conn.sourcePoint.y}" r="${theme.cable.plugTipRadius}" fill="${cableColor.plugTip}"/>`,
    );
    tips.push(
      `<circle cx="${conn.targetPoint.x}" cy="${conn.targetPoint.y}" r="${theme.cable.plugTipRadius}" fill="${cableColor.plugTip}"/>`,
    );
  }

  return parts.join('') + tips.join('');
}

function buildPanels(theme: Theme, idPrefix: string, blocks: LayoutBlock[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    const moduleName = sanitizeForSvg(block.parentModule || block.label);
    const label = sanitizeForSvg(block.label);
    const fontFamily = sanitizeForSvg(theme.label.fontFamily);

    const insetX = block.x + 12;
    const insetY = block.y + 8;
    const insetW = block.width - 24;

    let group = `<g data-module="${moduleName}" filter="url(#${idPrefix}-panel-shadow)">`;
    // Main panel rect
    group += `<rect x="${block.x}" y="${block.y}" width="${block.width}" height="${block.height}" ` +
      `fill="${theme.panel.fill}" stroke="${theme.panel.stroke}" stroke-width="0.75" rx="${theme.panel.cornerRadius}"/>`;
    // Top highlight bevel
    group += `<line x1="${block.x}" y1="${block.y + 0.5}" x2="${block.x + block.width}" y2="${block.y + 0.5}" ` +
      `stroke="${theme.panel.highlight}" stroke-width="${theme.panel.bevelWidth}"/>`;
    // Bottom shadow bevel
    group += `<line x1="${block.x}" y1="${block.y + block.height - 0.5}" x2="${block.x + block.width}" y2="${block.y + block.height - 0.5}" ` +
      `stroke="${theme.panel.shadow}" stroke-width="0.5"/>`;
    // Inset label recess
    group += `<rect x="${insetX}" y="${insetY}" width="${insetW}" height="28" ` +
      `fill="${theme.label.plateFill}" stroke="${theme.label.plateStroke}" stroke-width="0.5"/>`;
    // Label
    group += `<text x="${block.x + block.width / 2}" y="${block.y + 22}" text-anchor="middle" ` +
      `font-family="${fontFamily}" font-size="14" font-weight="700" ` +
      `fill="${theme.label.color}" letter-spacing="3">${label}</text>`;
    // Sub-label: dark bar directly below the inset label plate (Monotrail style)
    if (block.subLabel) {
      const subLabel = sanitizeForSvg(block.subLabel);
      const barX = insetX;
      const barY = insetY + 28;
      const barW = insetW;
      const barH = 16;
      group += `<rect class="pf-sublabel-bar" x="${barX}" y="${barY}" width="${barW}" height="${barH}" ` +
        `fill="${theme.panel.shadow}"/>`;
      group += `<text x="${block.x + block.width / 2}" y="${barY + barH / 2 + 3}" text-anchor="middle" ` +
        `font-family="${fontFamily}" font-size="10" fill="${theme.panel.fill}" letter-spacing="1">${subLabel}</text>`;
    }
    group += `</g>`;
    parts.push(group);
  }

  return parts.join('');
}

function buildParams(blocks: LayoutBlock[], theme: Theme): string {
  const parts: string[] = [];
  const monoFont = "'SF Mono', 'Fira Code', Consolas, 'Courier New', monospace";

  for (const block of blocks) {
    const pw = block.width - 24;
    const px = block.x + 12;
    let py = block.y + 40 + (block.subLabel ? 18 : 0);
    const blockLabelNorm = block.label.trim().toLowerCase();
    for (const param of block.params) {
      parts.push(
        `<rect x="${px}" y="${py}" width="${pw}" height="20" fill="${theme.param.plateFill}" stroke="${theme.param.plateStroke}" stroke-width="0.5"/>`,
      );
      const keyNorm = param.key.trim().toLowerCase();
      const text = keyNorm === blockLabelNorm
        ? sanitizeForSvg(param.value)
        : `${sanitizeForSvg(param.key)}: ${sanitizeForSvg(param.value)}`;
      parts.push(
        `<text x="${px + pw / 2}" y="${py + 14}" text-anchor="middle" ` +
        `font-family="${monoFont}" font-size="10" fill="${theme.param.textColor}">${text}</text>`,
      );
      py += 20;
    }
  }

  return parts.join('');
}

function buildJacks(theme: Theme, idPrefix: string, blocks: LayoutBlock[]): string {
  if (theme.port.hideSocket) return '';
  const parts: string[] = [];
  const c = theme.port.colors;

  for (const block of blocks) {
    for (const port of block.ports) {
      const { x, y } = port.position;
      const id = sanitizeForSvg(`${block.id}.${port.id}`);
      let group = `<g data-port="${id}" filter="url(#${idPrefix}-jack-shadow)">`;
      group += `<circle cx="${x}" cy="${y}" r="8" fill="${c.bezel}" stroke="${c.bezelStroke}" stroke-width="0.75"/>`;
      group += `<circle cx="${x}" cy="${y}" r="5" fill="${c.ring}"/>`;
      group += `<circle cx="${x}" cy="${y}" r="3" fill="${c.hole}"/>`;
      group += `<circle cx="${x}" cy="${y}" r="1" fill="${c.pin}"/>`;
      group += `</g>`;
      parts.push(group);
    }
  }

  return parts.join('');
}

const SIGNAL_PILL_LABEL: Record<SignalType, string> = {
  audio: 'audio',
  cv: 'cv',
  pitch: '1v/oct',
  gate: 'gate',
  trigger: 'trig',
  clock: 'clk',
};

// Direction threshold (px) — cables going upward by more than this are considered "straight up"
const UPWARD_CABLE_THRESHOLD = 20;

/**
 * For each port, decide whether its label should be placed BELOW the socket
 * (instead of the default ABOVE). The rule: if the cable at that socket heads
 * vertically upward (by more than a threshold), flip the label below so it
 * doesn't collide with the cable.
 *
 * Keyed by `${blockId}:${portId}:${direction}`.
 */
function computeLabelBelowMap(connections: LayoutConnection[]): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const conn of connections) {
    // Source (output) port: cable leaves the socket toward targetPoint.
    // If targetPoint.y is significantly above sourcePoint.y, cable goes up → flip below.
    const srcKey = `${conn.source.blockId}:${conn.source.portId}:out`;
    const srcDy = conn.targetPoint.y - conn.sourcePoint.y;
    if (srcDy < -UPWARD_CABLE_THRESHOLD) {
      map.set(srcKey, true);
    } else if (!map.has(srcKey)) {
      map.set(srcKey, false);
    }

    // Target (input) port: cable arrives from sourcePoint. If cable approaches
    // from below going up (sourcePoint.y > targetPoint.y by threshold), flip below.
    // Feedback edges are U-shaped: they leave the source going DOWN, traverse
    // the bottom, and arrive at the target going UP. So feedback targets always
    // flip below.
    const tgtKey = `${conn.target.blockId}:${conn.target.portId}:in`;
    const tgtDy = conn.sourcePoint.y - conn.targetPoint.y;
    if (conn.isFeedback || tgtDy > UPWARD_CABLE_THRESHOLD) {
      map.set(tgtKey, true);
    } else if (!map.has(tgtKey)) {
      map.set(tgtKey, false);
    }
  }
  return map;
}

function buildLabels(theme: Theme, blocks: LayoutBlock[], connections: LayoutConnection[]): string {
  const parts: string[] = [];
  const fontFamily = sanitizeForSvg(theme.port.fontFamily);
  const pillShow = theme.port.pill.show;
  const pillFontSize = theme.port.pill.fontSize;
  const pillTextColor = theme.port.pill.textColor;
  const pillRadius = theme.port.pill.cornerRadius;
  const pillPadX = 3;
  const pillHeight = 11;
  const charWidth = 6.5;

  // Vertical offsets relative to the socket center
  const pillOffsetAbove = 20;  // pill center above socket
  const nameOffsetAbove = 32;  // port name text y above socket
  const pillOffsetBelow = 20;  // pill center below socket
  const nameOffsetBelow = 32;  // port name text y below socket

  const belowMap = computeLabelBelowMap(connections);

  // Horizontal offset from socket to label edge — keeps label fully outside the
  // block panel so text never straddles the panel boundary (which caused clipping
  // against the cream fill in dark mode).
  const labelOffsetX = 6;

  for (const block of blocks) {
    for (const port of block.ports) {
      const { x, y } = port.position;
      const key = `${block.id}:${port.id}:${port.direction}`;
      const below = belowMap.get(key) === true;
      const display = sanitizeForSvg(port.display);
      const isOutput = port.direction === 'out';

      // Port name text baseline: vertically above or below the socket, but shifted
      // horizontally OUTSIDE the block edge (right of output, left of input).
      const textY = below ? y + nameOffsetBelow : y - nameOffsetAbove;
      const textX = isOutput ? x + labelOffsetX : x - labelOffsetX;
      const textAnchor = isOutput ? 'start' : 'end';

      parts.push(
        `<text x="${textX}" y="${textY}" font-family="${fontFamily}" ` +
        `font-size="${theme.port.fontSize}" fill="${theme.port.labelColor}" font-weight="600" ` +
        `text-anchor="${textAnchor}" dominant-baseline="central">${display}</text>`,
      );

      if (pillShow && port.signalType) {
        const pillText = SIGNAL_PILL_LABEL[port.signalType];
        const pillWidth = pillText.length * charWidth + pillPadX * 2;
        const pillColor = theme.cable.colors[port.signalType].stroke;
        // Pill is stacked between name and socket vertically, and shifted outside
        // the block edge horizontally (adjacent to the port name above/below it).
        const pillCenterY = below ? y + pillOffsetBelow : y - pillOffsetAbove;
        const pillX = isOutput
          ? x + labelOffsetX
          : x - labelOffsetX - pillWidth;
        const pillY = pillCenterY - pillHeight / 2;
        const pillTextX = pillX + pillWidth / 2;
        parts.push(
          `<rect class="pf-port-pill" x="${pillX}" y="${pillY}" width="${pillWidth}" height="${pillHeight}" ` +
          `rx="${pillRadius}" fill="${pillColor}" data-signal="${port.signalType}"/>`,
        );
        parts.push(
          `<text class="pf-port-pill-text" x="${pillTextX}" y="${pillCenterY}" text-anchor="middle" dominant-baseline="central" ` +
          `font-family="${fontFamily}" font-size="${pillFontSize}" fill="${pillTextColor}" font-weight="600">${sanitizeForSvg(pillText)}</text>`,
        );
      }

    }
  }

  return parts.join('');
}

function buildAnnotations(theme: Theme, connections: LayoutConnection[], layoutHeight: number): string {
  const annotated = connections.filter(c => c.annotation);
  if (annotated.length === 0) return '';

  const parts: string[] = [];
  const fontFamily = sanitizeForSvg(theme.annotation.fontFamily);
  const noteFontSize = theme.annotation.fontSize + 2;
  const markerFontFamily = fontFamily;

  // Numbered markers on cables
  annotated.forEach((conn, i) => {
    const num = i + 1;
    const sx = conn.sourcePoint.x;
    const sy = conn.sourcePoint.y;
    const tx = conn.targetPoint.x;
    const ty = conn.targetPoint.y;

    let mx: number;
    let my: number;

    if (conn.isFeedback) {
      // Feedback arcs dip below the diagram — place marker at the arc's bottom-middle.
      // The path format is: M sx sy L (sx+20) sy L (sx+20) arcY L (tx-20) arcY ...
      // Extract arcY from the third point.
      mx = (sx + tx) / 2;
      const match = conn.path.match(/L\s+\S+\s+\S+\s+L\s+\S+\s+(\S+)/);
      my = match ? parseFloat(match[1]) : Math.max(sy, ty) + 30;
    } else {
      mx = (sx + tx) / 2;
      my = (sy + ty) / 2;
    }

    const markerStroke = conn.isFeedback
      ? theme.cable.colors[conn.signalType].stroke
      : theme.annotation.color;

    parts.push(
      `<circle cx="${mx}" cy="${my}" r="8" fill="${theme.panel.highlight}" ` +
      `stroke="${markerStroke}" stroke-width="0.5" data-annotation-marker="${num}"/>`,
    );
    parts.push(
      `<text x="${mx}" y="${my + 3}" text-anchor="middle" ` +
      `font-family="${markerFontFamily}" font-size="9" ` +
      `fill="${theme.annotation.color}">${num}</text>`,
    );
  });

  // Notes panel in bottom-left, stacked upward above the legend line.
  // `layoutHeight` here is the viewBox-relative diagram bottom (content height
  // plus bottom padding), so `- 10` sits inside the padded bottom area and
  // never overlaps block content.
  const panelX = -120;
  const lineGap = 16;
  const noteCount = annotated.length;
  // Bottom of notes sits at layoutHeight - 10 (just above the legend row)
  const bottomY = layoutHeight - 10;
  // First note (topmost) starts at bottomY - (noteCount - 1) * lineGap
  const firstNoteY = bottomY - (noteCount - 1) * lineGap;

  annotated.forEach((conn, i) => {
    const num = i + 1;
    const noteText = `${num}. ${sanitizeForSvg(conn.annotation!)}`;
    const noteY = firstNoteY + i * lineGap;
    parts.push(
      `<text x="${panelX}" y="${noteY}" ` +
      `font-family="${fontFamily}" font-size="${noteFontSize}" font-weight="600" ` +
      `fill="${theme.annotation.color}">${noteText}</text>`,
    );
  });

  return parts.join('');
}

function buildLegend(theme: Theme, layoutResult: LayoutResult, diagramBottom: number): string {
  const order: SignalType[] = ['audio', 'cv', 'pitch', 'gate', 'trigger', 'clock'];
  const used = order.filter(t => (layoutResult.signalTypeStats[t] ?? 0) > 0);
  if (used.length === 0) return '';

  const parts: string[] = [];
  const fontFamily = sanitizeForSvg(theme.annotation.fontFamily);
  const itemWidth = 70;
  const totalWidth = used.length * itemWidth;
  // Right-align: place the legend's right edge at layoutResult.width
  const legendStartX = layoutResult.width - totalWidth;
  // Anchor the legend inside the viewBox's bottom padding so it never
  // overlaps block/panel content.
  const y = diagramBottom - 20;

  for (let i = 0; i < used.length; i++) {
    const sig = used[i];
    const color = theme.cable.colors[sig].stroke;
    const x = legendStartX + i * itemWidth;
    let g = `<g transform="translate(${x}, ${y})">`;
    g += `<line x1="0" y1="0" x2="20" y2="0" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`;
    g += `<text x="26" y="3" font-family="${fontFamily}" font-size="9" fill="${theme.annotation.color}">${sig}</text>`;
    g += `</g>`;
    parts.push(g);
  }

  return parts.join('');
}

// ── Main renderer ──

export function renderSvg(layoutResult: LayoutResult, theme: Theme): string {
  const idPrefix = genId();
  const width = layoutResult.width;
  const height = layoutResult.height;
  const minWidth = Math.round(width);

  const desc = buildDesc(layoutResult);

  // Build defs
  const defsParts: string[] = [];
  defsParts.push(
    `<filter id="${idPrefix}-panel-shadow" x="-20%" y="-20%" width="140%" height="140%">` +
    `<feDropShadow dx="0" dy="2" stdDeviation="${theme.panel.shadowBlur}" flood-opacity="${theme.panel.shadowOpacity}"/>` +
    `</filter>`,
  );
  defsParts.push(
    `<filter id="${idPrefix}-jack-shadow" x="-20%" y="-20%" width="140%" height="140%">` +
    `<feDropShadow dx="0" dy="0.5" stdDeviation="0.8" flood-opacity="0.15"/>` +
    `</filter>`,
  );
  if (theme.grid) {
    const spacing = theme.grid.spacing;
    defsParts.push(
      `<pattern id="${idPrefix}-dots" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse">` +
      `<circle cx="${spacing / 2}" cy="${spacing / 2}" r="${theme.grid.dotRadius}" fill="${theme.grid.dotColor}" opacity="${theme.grid.opacity}"/>` +
      `</pattern>`,
    );
  }

  // Port labels are now stacked vertically above/below sockets, so horizontal
  // padding only needs to clear the socket jacket (radius 8) plus a small buffer.
  // Annotation notes anchor to x = -120, so keep enough left padding for them
  // (they still read as margin-text aligned with the legend).
  const labelPadX = 130;
  const vbWidth = width + labelPadX * 2;

  // Top padding: room for port name + pill stacked above the topmost socket
  // (~40px: pill center at -20, text baseline at -32, plus text height).
  const topPad = 40;
  // Bottom padding must accommodate:
  //   • port labels below sockets on the bottommost row (~40px)
  //   • legend row: ~30px
  //   • observation notes (bottom-left, stacked upward above legend)
  const noteCount = layoutResult.connections.filter(c => c.annotation).length;
  const notesHeight = noteCount > 0 ? noteCount * 16 + 10 : 0;
  const bottomPad = Math.max(40, notesHeight + 10);
  const vbHeight = height + topPad + bottomPad;

  // `diagramBottom` is the Y coordinate of the viewBox's bottom edge. Legend
  // and notes are positioned relative to this so they render INSIDE the
  // bottom padding, not inside the block content area (which ends at `height`).
  const diagramBottom = height + bottomPad;

  // Assemble layers
  const layers = [
    `<g class="pf-layer-bg">${buildBackground(theme, idPrefix, width, height)}</g>`,
    `<g class="pf-layer-cables">${buildCables(theme, layoutResult.connections)}</g>`,
    `<g class="pf-layer-panels" >${buildPanels(theme, idPrefix, layoutResult.blocks)}</g>`,
    `<g class="pf-layer-params">${buildParams(layoutResult.blocks, theme)}</g>`,
    `<g class="pf-layer-jacks">${buildJacks(theme, idPrefix, layoutResult.blocks)}</g>`,
    `<g class="pf-layer-labels">${buildLabels(theme, layoutResult.blocks, layoutResult.connections)}</g>`,
    `<g class="pf-layer-annotations">${buildAnnotations(theme, layoutResult.connections, diagramBottom)}</g>`,
    `<g class="pf-layer-legend">${buildLegend(theme, layoutResult, diagramBottom)}</g>`,
  ].join('');

  const style =
    `<style>@media print { .pf-panel, .pf-jack { filter: none; } }</style>`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-labelPadX} ${-topPad} ${vbWidth} ${vbHeight}" width="100%" ` +
    `data-pf-min-width="${minWidth + labelPadX * 2}" role="img" aria-labelledby="${idPrefix}-title ${idPrefix}-desc">` +
    `<title id="${idPrefix}-title">Patch diagram</title>` +
    `<desc id="${idPrefix}-desc">${desc}</desc>` +
    style +
    `<defs>${defsParts.join('')}</defs>` +
    layers +
    `</svg>`;

  return svg;
}
