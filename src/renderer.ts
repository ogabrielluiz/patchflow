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

function buildLabels(theme: Theme, blocks: LayoutBlock[]): string {
  const parts: string[] = [];
  const fontFamily = sanitizeForSvg(theme.port.fontFamily);
  const pillShow = theme.port.pill.show;
  const pillFontSize = theme.port.pill.fontSize;
  const pillTextColor = theme.port.pill.textColor;
  const pillRadius = theme.port.pill.cornerRadius;
  const pillPadX = 3;
  const pillHeight = 11;
  const pillGap = 6;
  const charWidth = 6.5;

  for (const block of blocks) {
    for (const port of block.ports) {
      const { x, y } = port.position;
      const isOut = port.direction === 'out';
      const labelX = isOut ? x + 14 : x - 14;
      const labelY = y + 3;
      const anchor = isOut ? 'start' : 'end';
      const display = sanitizeForSvg(port.display);
      const labelWidth = port.display.length * charWidth;

      parts.push(
        `<text x="${labelX}" y="${labelY}" font-family="${fontFamily}" ` +
        `font-size="${theme.port.fontSize}" fill="${theme.port.labelColor}" font-weight="600" ` +
        `text-anchor="${anchor}">${display}</text>`,
      );

      if (pillShow && port.signalType) {
        const pillText = SIGNAL_PILL_LABEL[port.signalType];
        const pillWidth = pillText.length * charWidth + pillPadX * 2;
        const pillColor = theme.cable.colors[port.signalType].stroke;
        // Position pill next to the label (away from the socket)
        let pillX: number;
        if (isOut) {
          // socket → label → pill
          pillX = labelX + labelWidth + pillGap;
        } else {
          // pill → label → socket; pill sits to the left of label's leftmost edge
          pillX = labelX - labelWidth - pillGap - pillWidth;
        }
        const pillY = y - pillHeight / 2;
        const textX = pillX + pillWidth / 2;
        const textY = pillY + pillHeight / 2 + pillFontSize / 2 - 1;
        parts.push(
          `<rect class="pf-port-pill" x="${pillX}" y="${pillY}" width="${pillWidth}" height="${pillHeight}" ` +
          `rx="${pillRadius}" fill="${pillColor}" data-signal="${port.signalType}"/>`,
        );
        parts.push(
          `<text class="pf-port-pill-text" x="${textX}" y="${textY}" text-anchor="middle" ` +
          `font-family="${fontFamily}" font-size="${pillFontSize}" fill="${pillTextColor}" font-weight="600">${sanitizeForSvg(pillText)}</text>`,
        );
      }
    }
  }

  return parts.join('');
}

function buildAnnotations(theme: Theme, connections: LayoutConnection[]): string {
  const annotated = connections.filter(c => c.annotation);
  if (annotated.length === 0) return '';

  const parts: string[] = [];
  const fontFamily = sanitizeForSvg(theme.annotation.fontFamily);
  const noteFontSize = theme.annotation.fontSize + 1;
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
      : theme.label.color;

    parts.push(
      `<circle cx="${mx}" cy="${my}" r="8" fill="${theme.panel.highlight}" ` +
      `stroke="${markerStroke}" stroke-width="0.5" data-annotation-marker="${num}"/>`,
    );
    parts.push(
      `<text x="${mx}" y="${my + 3}" text-anchor="middle" ` +
      `font-family="${markerFontFamily}" font-size="9" ` +
      `fill="${theme.label.color}">${num}</text>`,
    );
  });

  // Notes panel in upper-left
  const panelX = -120;
  let panelY = 20;
  const lineGap = 14;

  annotated.forEach((conn, i) => {
    const num = i + 1;
    const noteText = `${num}. ${sanitizeForSvg(conn.annotation!)}`;
    parts.push(
      `<text x="${panelX}" y="${panelY}" ` +
      `font-family="${fontFamily}" font-size="${noteFontSize}" ` +
      `fill="${theme.annotation.color}">${noteText}</text>`,
    );
    panelY += lineGap;
  });

  return parts.join('');
}

function buildLegend(theme: Theme, layoutResult: LayoutResult): string {
  const order: SignalType[] = ['audio', 'cv', 'pitch', 'gate', 'trigger', 'clock'];
  const used = order.filter(t => (layoutResult.signalTypeStats[t] ?? 0) > 0);
  if (used.length === 0) return '';

  const parts: string[] = [];
  const fontFamily = sanitizeForSvg(theme.annotation.fontFamily);
  const itemWidth = 70;
  const y = layoutResult.height - 20;
  let x = 20;

  for (const sig of used) {
    const color = theme.cable.colors[sig].stroke;
    let g = `<g transform="translate(${x}, ${y})">`;
    g += `<line x1="0" y1="0" x2="20" y2="0" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`;
    g += `<text x="26" y="3" font-family="${fontFamily}" font-size="9" fill="${theme.annotation.color}">${sig}</text>`;
    g += `</g>`;
    parts.push(g);
    x += itemWidth;
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

  // Assemble layers
  const layers = [
    `<g class="pf-layer-bg">${buildBackground(theme, idPrefix, width, height)}</g>`,
    `<g class="pf-layer-cables">${buildCables(theme, layoutResult.connections)}</g>`,
    `<g class="pf-layer-panels" >${buildPanels(theme, idPrefix, layoutResult.blocks)}</g>`,
    `<g class="pf-layer-params">${buildParams(layoutResult.blocks, theme)}</g>`,
    `<g class="pf-layer-jacks">${buildJacks(theme, idPrefix, layoutResult.blocks)}</g>`,
    `<g class="pf-layer-labels">${buildLabels(theme, layoutResult.blocks)}</g>`,
    `<g class="pf-layer-annotations">${buildAnnotations(theme, layoutResult.connections)}</g>`,
    `<g class="pf-layer-legend">${buildLegend(theme, layoutResult)}</g>`,
  ].join('');

  const style =
    `<style>@media print { .pf-panel, .pf-jack { filter: none; } }</style>`;

  // Extend the viewBox horizontally so port labels ("Fall CV", etc.) on the
  // leftmost and rightmost blocks don't get clipped outside the SVG.
  const labelPadX = 130;
  const vbWidth = width + labelPadX * 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-labelPadX} 0 ${vbWidth} ${height}" width="100%" ` +
    `data-pf-min-width="${minWidth + labelPadX * 2}" role="img" aria-labelledby="${idPrefix}-title ${idPrefix}-desc">` +
    `<title id="${idPrefix}-title">Patch diagram</title>` +
    `<desc id="${idPrefix}-desc">${desc}</desc>` +
    style +
    `<defs>${defsParts.join('')}</defs>` +
    layers +
    `</svg>`;

  return svg;
}
