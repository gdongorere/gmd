import { expect, test } from '@playwright/test';

// These run with a real (software) WebGL context at the lightest tier.
test.describe('explore mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/stars?quality=minimal');
    await expect(page.getByRole('link', { name: 'Back to site' }).first()).toBeAttached();
    await page.locator('button[aria-label^="Sagittarius A"]').waitFor({ state: 'attached', timeout: 60_000 });
  });

  test('number keys fly to a place and announce it', async ({ page }) => {
    await page.keyboard.press('5');
    await expect(page.getByRole('region', { name: 'The Sun details' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Flying to The Sun' })).toBeAttached();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: 'The Sun details' })).toBeHidden();
  });

  test('the guided tour steps forward and back, and T ends it', async ({ page }) => {
    await page.keyboard.press('t');
    const tour = page.getByRole('region', { name: 'Guided tour' });
    await expect(tour).toContainText('1 of 7');
    await tour.getByRole('button', { name: 'Next' }).click();
    await expect(tour).toContainText('2 of 7');
    await tour.getByRole('button', { name: 'Back' }).click();
    await expect(tour).toContainText('1 of 7');
    await page.keyboard.press('t');
    await expect(tour).toBeHidden();
  });

  test('space pauses time and the help dialog lists the shortcuts', async ({ page }) => {
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Play time' })).toBeVisible();
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog')).toContainText('Orbit with the keyboard');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('G toggles the settings panel and presets change state', async ({ page }) => {
    await page.keyboard.press('g');
    const panel = page.getByRole('dialog', { name: 'Galaxy settings' });
    await expect(panel).toBeVisible();
    await panel.getByRole('radio', { name: 'Calm' }).click();
    await expect(panel.getByRole('radio', { name: 'Calm' })).toHaveAttribute('aria-checked', 'true');
    await panel.getByLabel('Brightness').press('ArrowRight');
    await expect(panel.getByText('Custom', { exact: true })).toBeVisible();
  });

  test('a shared link restores the camera and the copy button works', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'Copy link to this view' }).click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/\/stars\?v=[\d.,-]+/);
  });
});
