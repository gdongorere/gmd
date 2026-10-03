import { describe, expect, it } from 'vitest';
import { generateGalaxy, LAYER_NAMES } from './generate';
import { TIERS } from './tiers';

const small = { old: 2000, young: 1000, halo: 400, glow: 200, dust: 300, hii: 80 };
const larger = { old: 5000, young: 2500, halo: 900, glow: 500, dust: 700, hii: 200 };

describe('galaxy generator', () => {
  it('is deterministic: the same counts give identical data', () => {
    const a = generateGalaxy(small);
    const b = generateGalaxy(small);
    for (const name of LAYER_NAMES) {
      expect(Array.from(a[name].cyl.slice(0, 60))).toEqual(Array.from(b[name].cyl.slice(0, 60)));
      expect(Array.from(a[name].color.slice(0, 60))).toEqual(Array.from(b[name].color.slice(0, 60)));
    }
  });

  it('lower tiers are prefixes of higher tiers: the same galaxy, fewer stars', () => {
    const a = generateGalaxy(small);
    const b = generateGalaxy(larger);
    for (const name of LAYER_NAMES) {
      const n = small[name] * 3;
      expect(Array.from(a[name].cyl.slice(0, n))).toEqual(Array.from(b[name].cyl.slice(0, n)));
      expect(Array.from(a[name].meta.slice(0, n))).toEqual(Array.from(b[name].meta.slice(0, n)));
    }
  });

  it('never produces NaN or Infinity and keeps stars inside sane bounds', () => {
    const data = generateGalaxy(larger);
    for (const name of LAYER_NAMES) {
      const layer = data[name];
      expect(layer.count).toBe(larger[name]);
      for (let i = 0; i < layer.cyl.length; i++) expect(Number.isFinite(layer.cyl[i])).toBe(true);
      for (let i = 0; i < layer.meta.length; i++) expect(Number.isFinite(layer.meta[i])).toBe(true);
      for (let i = 0; i < layer.count; i++) expect(layer.cyl[i * 3]).toBeLessThan(2000); // radius in scene units
    }
  });

  it('keeps old and young populations distinct in colour', () => {
    const data = generateGalaxy(larger);
    const meanBlueRatio = (layer: typeof data.old) => {
      let sum = 0;
      for (let i = 0; i < layer.count; i++) sum += layer.color[i * 3 + 2] / Math.max(1, layer.color[i * 3]);
      return sum / layer.count;
    };
    // Young arm stars skew blue; old bulge/disk stars skew orange.
    expect(meanBlueRatio(data.young)).toBeGreaterThan(meanBlueRatio(data.old));
  });

  it('tier counts only ever shrink going down', () => {
    const order = ['ultra', 'high', 'medium', 'low', 'minimal'] as const;
    for (let i = 1; i < order.length; i++)
      for (const name of LAYER_NAMES) expect(TIERS[order[i]].counts[name]).toBeLessThanOrEqual(TIERS[order[i - 1]].counts[name]);
  });
});
