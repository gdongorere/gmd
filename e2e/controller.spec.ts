import { expect, test, type Page } from '@playwright/test';

// A fake pad the page polls through the real navigator.getGamepads(); tests change it with `setPad`.
const DS4_ID = 'Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)';
interface FakePad { id: string; mapping: string; axes: number[]; pressed: number[] }

const install = (page: Page) => page.addInitScript(() => {
  (window as unknown as { __gp: unknown }).__gp = null;
  navigator.getGamepads = () => [(window as unknown as { __gp: unknown }).__gp] as unknown as (Gamepad | null)[];
});
const setPad = (page: Page, p: FakePad | null, buttonCount = 18) => page.evaluate(({ p, n }) => {
  (window as unknown as { __gp: unknown }).__gp = p && {
    id: p.id, index: 0, connected: true, mapping: p.mapping, axes: p.axes, timestamp: performance.now(),
    buttons: Array.from({ length: n }, (_, i) => ({ pressed: p.pressed.includes(i), value: p.pressed.includes(i) ? 1 : 0 })),
  };
}, { p, n: buttonCount });
const standard = (pressed: number[] = [], axes = [0, 0, 0, 0]): FakePad => ({ id: DS4_ID, mapping: 'standard', axes, pressed });

test.describe('controller support', () => {
  test('a DualShock 4 with the standard layout is recognised and its buttons are shown', async ({ page }) => {
    await install(page);
    await page.goto('/controller');
    await expect(page.getByTestId('pad-status')).toContainText('No controller yet');
    await setPad(page, standard());
    await expect(page.getByTestId('pad-label')).toHaveText('DualShock 4');
    await expect(page.getByTestId('pad-source')).toHaveText('standard layout');
    await setPad(page, standard([0, 5]));
    await expect(page.getByTestId('pad-down')).toContainText('✕');
    await expect(page.getByTestId('pad-down')).toContainText('R1');
    await setPad(page, null);
    await expect(page.getByTestId('pad-status')).toContainText('No controller yet');
  });

  test('a raw-layout DS4 (as some browsers report it) uses the built-in profile', async ({ page }) => {
    await install(page);
    await page.goto('/controller');
    await setPad(page, { id: '054c-09cc-Wireless Controller', mapping: '', axes: [0, 0, 0, -1, -1, 0, 0, 0, 0, 1.2857], pressed: [1] }, 14);
    await expect(page.getByTestId('pad-source')).toHaveText('built-in DS4 profile');
    await expect(page.getByTestId('pad-down')).toContainText('✕'); // raw index 1 is cross in this layout
  });

  test('an unknown pad can be taught once and the mapping is saved', async ({ page }) => {
    test.setTimeout(150_000);
    await install(page);
    await page.goto('/controller');
    const id = 'Mystery Pad 1234';
    const base: FakePad = { id, mapping: '', axes: [0, 0, 0, 0, 0, 0], pressed: [] };
    await setPad(page, base, 12);
    await expect(page.getByTestId('pad-source')).toHaveText('unknown layout');
    await page.getByRole('button', { name: 'Start' }).click();
    // Scrambled layout: left stick is axes 3/2, right stick axes 5/4; buttons follow reverse order.
    const stickAxis: Record<string, [number, number]> = { 'LEFT stick fully to the right': [3, 1], 'LEFT stick fully down': [2, 1], 'RIGHT stick fully to the right': [5, 1], 'RIGHT stick fully down': [4, 1] };
    let buttonIndex = 11;
    for (let i = 0; i < 22; i++) {
      const wizard = page.getByTestId('wizard');
      if (!(await wizard.isVisible())) break;
      const prompt = (await page.getByTestId('wizard-prompt').innerText()).trim();
      const stick = Object.entries(stickAxis).find(([k]) => prompt.includes(k));
      // Let the pad rest long enough to be armed, then act.
      await page.waitForTimeout(400);
      if (stick) {
        const axes = [...base.axes]; axes[stick[1][0]] = stick[1][1];
        await setPad(page, { ...base, axes }, 12);
      } else if (/\(or skip\)/.test(prompt)) {
        await page.getByRole('button', { name: 'Skip' }).click();
        continue;
      } else {
        await setPad(page, { ...base, pressed: [buttonIndex] }, 12);
        buttonIndex = buttonIndex > 0 ? buttonIndex - 1 : 11;
      }
      await expect(page.getByTestId('wizard-prompt')).not.toHaveText(prompt, { timeout: 10_000 }).catch(() => {});
      await setPad(page, base, 12);
    }
    await expect(page.getByTestId('wizard')).toBeHidden({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Save this mapping' }).click();
    await expect(page.getByText(/Saved\./)).toBeVisible();
    const stored = await page.evaluate(() => window.localStorage.getItem('gmd.padMappings.v1'));
    expect(stored).toContain('Mystery Pad 1234');
    // After saving, the same pad is read through the learned mapping.
    await setPad(page, { ...base, axes: [0, 0, 0, 1, 0, 0] }, 12);
    await expect(page.getByTestId('pad-source')).toHaveText('your saved mapping', { timeout: 10_000 });
  });

  test('on the Milky Way page ✕ opens the Solar System, ▼ changes body, ○ goes back', async ({ page }) => {
    await install(page);
    await page.goto('/stars');
    await page.getByRole('group', { name: 'Date and time' }).waitFor({ timeout: 60_000 });
    await setPad(page, standard());
    await expect(page.getByText('DualShock 4 connected')).toBeVisible({ timeout: 10_000 });
    await setPad(page, standard([0])); // ✕
    await page.waitForTimeout(150);
    await setPad(page, standard());
    await expect(page.getByTestId('system3d')).toBeVisible({ timeout: 20_000 });
    await setPad(page, standard([13])); // D-pad down → next body
    await page.waitForTimeout(150);
    await setPad(page, standard());
    await expect(page.getByTestId('system3d-readout')).toContainText(/Mercury/, { timeout: 30_000 });
    await setPad(page, standard([1])); // ○
    await page.waitForTimeout(150);
    await setPad(page, standard());
    await expect(page.getByTestId('system3d')).toBeHidden({ timeout: 10_000 });
  });

  test('the left stick turns the view (the share link changes)', async ({ page }) => {
    await install(page);
    await page.goto('/stars');
    await page.getByRole('group', { name: 'Date and time' }).waitFor({ timeout: 60_000 });
    const link = async () => {
      await page.getByRole('button', { name: 'Copy link to this view' }).click();
      return page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    };
    await setPad(page, standard());
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    const before = await link();
    await setPad(page, standard([], [1, 0, 0, 0]));
    await page.waitForTimeout(1200);
    await setPad(page, standard());
    const after = await link();
    expect(after).not.toBe('');
    expect(after).not.toBe(before);
  });
});
