import type { Point } from './types';

export function straightPath(source: Point, target: Point): string {
  return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
}

export function rightAnglePath(source: Point, target: Point): string {
  const midX = (source.x + target.x) / 2;
  return [
    `M ${source.x} ${source.y}`,
    `L ${midX} ${source.y}`,
    `L ${midX} ${target.y}`,
    `L ${target.x} ${target.y}`,
  ].join(' ');
}

export function smoothstepPath(source: Point, target: Point): string {
  const dx = target.x - source.x;
  const controlOffset = Math.max(Math.abs(dx) * 0.4, 30);
  const cx1 = source.x + controlOffset;
  const cy1 = source.y;
  const cx2 = target.x - controlOffset;
  const cy2 = target.y;
  return `M ${source.x} ${source.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${target.x} ${target.y}`;
}

export function feedbackArcPath(
  source: Point,
  target: Point,
  diagramBottom: number,
  arcOffset: number,
): string {
  const arcY = diagramBottom + arcOffset;
  return [
    `M ${source.x} ${source.y}`,
    `L ${source.x + 20} ${source.y}`,
    `L ${source.x + 20} ${arcY}`,
    `L ${target.x - 20} ${arcY}`,
    `L ${target.x - 20} ${target.y}`,
    `L ${target.x} ${target.y}`,
  ].join(' ');
}

export function selfLoopArcPath(
  source: Point,
  target: Point,
  blockBottom: number,
  arcOffset: number,
): string {
  const arcY = blockBottom + arcOffset;
  return [
    `M ${source.x} ${source.y}`,
    `L ${source.x + 15} ${source.y}`,
    `Q ${source.x + 15} ${arcY}, ${(source.x + target.x) / 2} ${arcY}`,
    `Q ${target.x - 15} ${arcY}, ${target.x - 15} ${target.y}`,
    `L ${target.x} ${target.y}`,
  ].join(' ');
}
