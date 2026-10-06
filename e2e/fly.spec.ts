import { expect, test } from '@playwright/test';

test.describe('/fly hangar: the Kestrel', () => {
  test('opens without the site header or footer and shows the ship card', async ({ page }) => {
    await page.goto('/fly');
    await expect(page.getByTestId('ship-card')).toContainText('Kestrel', { timeout: 60_000 });
    await expect(page.getByTestId('ship-card')).toContainText('Δv 14.9 km/s');
    await expect(page.getByTestId('ship-card')).toContainText('original design');
    await expect(page.getByRole('contentinfo')).toHaveCount(0); // bare route: no site footer
    await expect(page.getByTestId('hangar-canvas').locator('canvas')).toBeVisible({ timeout: 30_000 });
  });

  test('controls respond and views switch', async ({ page }) => {
    await page.goto('/fly');
    await expect(page.getByTestId('hangar-canvas').locator('canvas')).toBeVisible({ timeout: 60_000 });
    const gear = page.getByRole('checkbox', { name: 'Landing gear' });
    await expect(gear).toBeChecked();
    await page.getByText('Landing gear').click();
    await expect(gear).not.toBeChecked();
    await page.getByRole('slider', { name: 'Lift thrust' }).press('End');
    await expect(page.getByRole('slider', { name: 'Lift thrust' })).toHaveAttribute('aria-valuenow', '1');
    await page.getByRole('button', { name: 'Side' }).click();
    await expect(page.getByRole('button', { name: 'Side' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('checkbox', { name: 'Turntable' })).not.toBeChecked(); // picking a fixed view stops the turntable
  });

  test('Save image downloads kestrel.png', async ({ page }) => {
    await page.goto('/fly');
    await expect(page.getByTestId('hangar-canvas').locator('canvas')).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(2500);
    const download = page.waitForEvent('download', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Save image' }).click();
    expect((await download).suggestedFilename()).toBe('kestrel.png');
  });
});
