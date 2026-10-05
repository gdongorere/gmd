import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const open = async (page: import('@playwright/test').Page) => {
  await page.goto('/stars');
  await page.getByRole('group', { name: 'Date and time' }).waitFor({ timeout: 60_000 });
};

test.describe('Time machine', () => {
  test('boots at the real current time with UTC and local clocks and a fullscreen control', async ({ page }) => {
    const before = Date.now();
    await open(page);
    const utc = page.getByLabel(/^Universal time:/);
    await expect(utc).toBeVisible();
    const text = (await utc.getAttribute('aria-label')) ?? '';
    const year = new Date(before).getUTCFullYear();
    expect(text).toContain(String(year));
    expect(text).toMatch(/\d{2}:\d{2}:\d{2}/);
    await expect(page.getByText(/^(LOCAL|MEAN SOLAR)$/)).toBeVisible();
    await expect(page.getByRole('button', { name: /full screen/i })).toBeVisible();
    await expect(page.getByText(/· live/)).toBeVisible();
  });

  test('the clock advances in real time and can be paused', async ({ page }) => {
    await open(page);
    const utc = page.getByLabel(/^Universal time:/);
    const a = await utc.getAttribute('aria-label');
    await page.waitForTimeout(2200);
    const b = await utc.getAttribute('aria-label');
    expect(b).not.toBe(a);
    await page.getByRole('button', { name: 'Pause time' }).click();
    const c = await utc.getAttribute('aria-label');
    await page.waitForTimeout(1500);
    expect(await utc.getAttribute('aria-label')).toBe(c);
  });

  test('jumping to the Last Glacial Maximum shows an ice-age Earth and an honest accuracy report', async ({ page }) => {
    await open(page);
    await page.keyboard.press('o');
    await page.getByRole('tab', { name: 'Earth' }).click();
    await page.getByRole('button', { name: 'Open time machine' }).click();
    await page.getByRole('button', { name: /Last Glacial Maximum/ }).click();
    await expect(page.getByLabel(/^Universal time:/)).toContainText('BCE');
    await expect(page.getByText('Ice age · schematic')).toBeVisible();
    await expect(page.getByText(/sea level −130 m/)).toBeVisible();
    await page.getByRole('button', { name: 'Open time machine' }).click();
    await expect(page.getByText('How accurate is this moment?')).toBeVisible();
    await expect(page.getByText(/time of day means nothing here/)).toBeVisible();
  });

  test('Mars shows the 2018 dust storm', async ({ page }) => {
    await open(page);
    await page.keyboard.press('o');
    await page.getByRole('tab', { name: 'Mars' }).click();
    await page.getByRole('button', { name: 'Open time machine' }).click();
    await page.getByRole('button', { name: /Mars dust storm 2018/ }).click();
    await expect(page.getByText('Global dust storm of 2018')).toBeVisible();
    await expect(page.getByText('MY 34')).toBeVisible();
  });

  test('the Sun card verifies its place with cited sources', async ({ page }) => {
    await open(page);
    await page.keyboard.press('o');
    await page.getByRole('tab', { name: 'Sun in the Galaxy' }).click();
    await expect(page.getByText(/26,673 ± 85 light-years/)).toBeVisible();
    await expect(page.getByText(/GRAVITY Collaboration 2019/)).toBeVisible();
  });

  test('time-travel panel has no accessibility violations', async ({ page }) => {
    await open(page);
    await page.keyboard.press('o');
    await page.getByRole('tab', { name: 'Earth' }).click();
    await page.waitForTimeout(800);
    const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`)).toEqual([]);
  });

  test('Earth shows the Moon, equation of time and the year’s seasons; the 2024 eclipse is flagged', async ({ page }) => {
    await open(page);
    await page.goto('/stars?t=2460409.2625');
    await page.getByRole('group', { name: 'Date and time' }).waitFor({ timeout: 60_000 });
    await page.keyboard.press('o');
    await page.getByRole('tab', { name: 'Earth' }).click();
    await expect(page.getByTestId('moon-disc')).toBeVisible();
    await expect(page.getByTestId('eclipse-flag')).toContainText(/total solar eclipse/i);
    await expect(page.getByText('Equation of time')).toBeVisible();
    await expect(page.getByTestId('year-events')).toContainText('2024: seasons and orbit');
  });

  test('the orrery labels periods and focuses a planet', async ({ page }) => {
    await open(page);
    await page.keyboard.press('o');
    await page.getByRole('tab', { name: 'Top-down' }).click();
    await page.getByRole('button', { name: 'Mars', exact: true }).click();
    const focus = page.getByTestId('planet-focus');
    await expect(focus).toContainText('orbital period 687 d');
    await expect(focus).toContainText('from Earth');
    await page.getByText('Orbits', { exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'Orbits' })).not.toBeChecked();
  });

  test('Take me home descends from the Solar System to Earth, with controls always on screen', async ({ page }) => {
    await open(page);
    await page.keyboard.press('h');
    const controls = page.getByTestId('descent-controls');
    await expect(controls).toBeVisible({ timeout: 60_000 });
    await expect(controls.getByRole('button', { name: /Pause|Resume descent/ })).toBeVisible();
    await expect(controls.getByRole('button', { name: 'Skip' })).toBeVisible();
    await expect(page.getByTestId('descent-caption')).toContainText(/Earth, from about 1,400 km up/, { timeout: 80_000 });
    await expect(page.getByTestId('system3d-readout')).toContainText(/Earth · [\d,]+ km up/);
  });

  test('the scale ladder jumps between stops and the scale rule is always stated', async ({ page }) => {
    await open(page);
    await page.keyboard.press('o');
    await expect(page.getByTestId('scale-badge')).toContainText('Visible scale');
    await page.getByRole('group', { name: 'Scale ladder' }).getByRole('button', { name: 'Inner planets', exact: true }).click();
    await expect(page.getByTestId('system3d-readout')).toContainText(/3\.60 AU/, { timeout: 30_000 });
    await page.getByText('True scale', { exact: true }).click();
    await expect(page.getByTestId('scale-badge')).toContainText('True scale');
  });
});
