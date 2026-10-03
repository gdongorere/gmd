import { describe, expect, it } from 'vitest';
import { QualityGovernor } from './quality';

/** Feed `seconds` of frames at a fixed frame time and return the final decision. */
function run(governor: QualityGovernor, frameMs: number, budgetMs: number, seconds: number, startMs = 0) {
  let now = startMs;
  let changes = 0;
  for (let t = 0; t < seconds * 1000; t += frameMs) {
    now += frameMs;
    if (governor.sample(frameMs, budgetMs, now) === 'changed') changes++;
  }
  return { changes, now };
}

describe('quality governor', () => {
  it('does nothing while frames are on budget', () => {
    const g = new QualityGovernor('high', 'ultra', 'test', true);
    expect(run(g, 16, 16.7, 8).changes).toBe(0);
    expect(g.state).toEqual({ tier: 'high', resolutionStep: 0 });
  });

  it('lowers resolution first, then the tier, when frames run long', () => {
    const g = new QualityGovernor('high', 'ultra', 'test', true);
    run(g, 40, 16.7, 4);
    expect(g.state.resolutionStep).toBeGreaterThan(0);
    expect(g.state.tier).toBe('high');
    run(g, 40, 16.7, 30);
    expect(g.state.tier).not.toBe('high');
  });

  it('never drops below minimal', () => {
    const g = new QualityGovernor('minimal', 'minimal', 'test', true);
    run(g, 80, 33, 60);
    expect(g.state.tier).toBe('minimal');
  });

  it('ignores stalls such as a tab switch', () => {
    const g = new QualityGovernor('high', 'ultra', 'test', true);
    for (let i = 0; i < 100; i++) g.sample(2000, 16.7, i * 2000);
    expect(g.state.resolutionStep).toBe(0);
  });

  it('never exceeds the device ceiling', () => {
    const g = new QualityGovernor('ultra', 'medium', 'test', true);
    expect(g.state.tier).toBe('medium');
    run(g, 8, 16.7, 60);
    expect(g.state.tier).toBe('medium');
  });

  it('stops upgrading for the session after an upgrade had to be undone', () => {
    const g = new QualityGovernor('low', 'high', 'test', true);
    let { now } = run(g, 8, 16.7, 14); // plenty of headroom: it upgrades
    const upgradedTo = g.state;
    expect(upgradedTo.tier === 'low' ? upgradedTo.resolutionStep : 1).toBeLessThanOrEqual(1);
    ({ now } = run(g, 50, 16.7, 8, now)); // the upgrade was too much: it comes back down
    const afterFailure = { ...g.state };
    run(g, 8, 16.7, 30, now); // headroom again, but it must not oscillate back up
    expect(g.state).toEqual(afterFailure);
  });
});
