import { describe, expect, it } from 'vitest';
import { DEFAULT_PATH, VIEWS, clonePose, newPose, poseAlong, poseBetween, smootherstep, type CameraPose } from './camera';
import { basis, decodeView, encodeView, niceScale, orbit, pan, zoom } from './explore';
import { FEATURES, TOUR, featurePose } from './features';

describe('camera', () => {
  const path = DEFAULT_PATH.map((n) => VIEWS[n]);

  it('hits every keyframe exactly at its place on the path', () => {
    const out = newPose();
    path.forEach((view, i) => {
      poseAlong(path, i / (path.length - 1), out);
      expect(out.logDistance).toBeCloseTo(view.logDistance, 6);
      expect(out.polar).toBeCloseTo(view.polar, 6);
    });
  });

  it('moves continuously: no jump larger than a few percent between adjacent samples', () => {
    const a = newPose();
    const b = newPose();
    for (let t = 0; t < 1; t += 0.002) {
      poseAlong(path, t, a);
      poseAlong(path, t + 0.002, b);
      expect(Math.abs(a.logDistance - b.logDistance)).toBeLessThan(0.05);
      expect(Math.abs(a.polar - b.polar)).toBeLessThan(0.05);
      expect(Math.abs(a.roll - b.roll)).toBeLessThan(0.2);
    }
  });

  it('smootherstep is monotonic and clamped', () => {
    expect(smootherstep(-1)).toBe(0);
    expect(smootherstep(2)).toBe(1);
    let prev = 0;
    for (let t = 0; t <= 1; t += 0.05) {
      const v = smootherstep(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('poseBetween with t=0 and t=1 returns the two segment ends', () => {
    const out = newPose();
    poseBetween(path, 1, 0, out);
    expect(out.polar).toBeCloseTo(path[1].polar, 6);
    poseBetween(path, 1, 1, out);
    expect(out.polar).toBeCloseTo(path[2].polar, 6);
  });
});

describe('explore camera maths', () => {
  it('orbit clamps polar away from the poles and zoom stays in range', () => {
    const p: CameraPose = clonePose(VIEWS.tilted);
    orbit(p, 0, 100);
    expect(p.polar).toBeLessThan(Math.PI);
    orbit(p, 0, -100);
    expect(p.polar).toBeGreaterThan(0);
    for (let i = 0; i < 200; i++) zoom(p, 0.5);
    expect(Math.exp(p.logDistance)).toBeGreaterThanOrEqual(29.9);
    for (let i = 0; i < 200; i++) zoom(p, 2);
    expect(Math.exp(p.logDistance)).toBeLessThanOrEqual(4501);
  });

  it('camera basis is orthonormal', () => {
    const { forward, up, right } = basis(clonePose(VIEWS.tilted));
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    expect(dot(forward, up)).toBeCloseTo(0, 6);
    expect(dot(forward, right)).toBeCloseTo(0, 6);
    expect(dot(up, right)).toBeCloseTo(0, 6);
    expect(Math.hypot(...right)).toBeCloseTo(1, 6);
  });

  it('panning moves the target but not the distance', () => {
    const p = clonePose(VIEWS.tilted);
    const before = { ...p };
    pan(p, 100, 50, 800);
    expect(p.logDistance).toBe(before.logDistance);
    expect(Math.hypot(p.targetX - before.targetX, p.targetY - before.targetY, p.targetZ - before.targetZ)).toBeGreaterThan(1);
  });

  it('shared view links round-trip and reject garbage', () => {
    const p = clonePose(VIEWS['arm-flyby']);
    const decoded = decodeView(encodeView(p))!;
    expect(decoded.polar).toBeCloseTo(p.polar, 1);
    expect(Math.exp(decoded.logDistance)).toBeCloseTo(Math.exp(p.logDistance), 0);
    expect(decodeView('nonsense')).toBeNull();
    expect(decodeView('1,2,3')).toBeNull();
    expect(decodeView('1,2,-5,0,0,0')).toBeNull();
    expect(decodeView(null)).toBeNull();
  });

  it('scale bar picks a round length that fits', () => {
    const { ly, px } = niceScale(0.01, 140);
    expect(px).toBeLessThanOrEqual(140);
    expect([100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000]).toContain(ly);
  });
});

describe('feature catalogue', () => {
  it('has unique ids and finite positions and poses', () => {
    const ids = new Set(FEATURES.map((f) => f.id));
    expect(ids.size).toBe(FEATURES.length);
    for (const f of FEATURES) {
      f.position.forEach((v) => expect(Number.isFinite(v)).toBe(true));
      Object.values(featurePose(f)).forEach((v) => expect(Number.isFinite(v)).toBe(true));
    }
  });

  it('places the Sun 26,673 ly from the centre and tour steps point at real features', () => {
    const sun = FEATURES.find((f) => f.id === 'sun')!;
    expect(Math.hypot(sun.position[0], sun.position[2]) * 100).toBeCloseTo(26673, -2);
    for (const step of TOUR) if (step.featureId) expect(FEATURES.some((f) => f.id === step.featureId)).toBe(true);
  });
});
