import { describe, it, expect } from 'bun:test';
import { straightPath, rightAnglePath, smoothstepPath, feedbackArcPath, selfLoopArcPath } from '../src/edge-routing';

describe('edge-routing', () => {
  it('straightPath returns a line between two points', () => {
    const d = straightPath({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(d).toBe('M 0 0 L 100 0');
  });

  it('rightAnglePath routes with a midpoint elbow', () => {
    const d = rightAnglePath({ x: 0, y: 0 }, { x: 100, y: 50 });
    expect(d).toContain('M 0 0');
    expect(d).toContain('L 50 0');
    expect(d).toContain('L 50 50');
    expect(d).toContain('L 100 50');
  });

  it('smoothstepPath returns a cubic bezier', () => {
    const d = smoothstepPath({ x: 0, y: 0 }, { x: 200, y: 0 });
    expect(d).toContain('M 0 0');
    expect(d).toContain('C');
    expect(d).toContain('200 0');
  });

  it('feedbackArcPath routes below the diagram', () => {
    const d = feedbackArcPath(
      { x: 200, y: 50 },
      { x: 0, y: 50 },
      160,
      20,
    );
    expect(d).toContain('M 200 50');
    expect(d).toMatch(/\d+ 180/);
  });

  it('selfLoopArcPath returns a quadratic curve', () => {
    const d = selfLoopArcPath(
      { x: 100, y: 50 },
      { x: 0, y: 50 },
      80,
      20,
    );
    expect(d).toContain('M 100 50');
    expect(d).toContain('Q');
  });

  it('handles zero-distance paths gracefully', () => {
    const d = straightPath({ x: 50, y: 50 }, { x: 50, y: 50 });
    expect(d).toBe('M 50 50 L 50 50');
  });
});
