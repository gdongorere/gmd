import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = ['/', '/projects', '/projects/venda-khona', '/contact', '/nope'];

for (const path of pages) {
  test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
    await page.goto(`${path}?quality=static`);
    await page.getByRole('main').waitFor();
    // Let entrance animations finish so contrast is measured on final colours.
    await page.waitForTimeout(1200);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    const summary = results.violations.map((v) => `${v.id}: ${v.nodes.length}× — ${v.nodes[0]?.target.join(' ')}`);
    expect(summary, summary.join('\n')).toEqual([]);
  });
}
