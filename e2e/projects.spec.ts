import { expect, test } from '@playwright/test';

test('filters by technology, keeps the URL in sync and can be cleared', async ({ page }) => {
  await page.goto('/projects?quality=static');
  const status = page.getByRole('status').filter({ hasText: /Showing/ });
  await expect(status).toContainText('of 17 projects');
  await page.getByRole('button', { name: 'React', exact: true }).click();
  await expect(page).toHaveURL(/tech=React/);
  await expect(page.getByRole('button', { name: 'React', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const filtered = await status.textContent();
  expect(filtered).not.toContain('Showing 17');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(status).toContainText('Showing 17 of 17');
});

test('search narrows results and shows an empty state with a way out', async ({ page }) => {
  await page.goto('/projects?quality=static');
  await page.getByLabel('Search').fill('zzzz-no-such-project');
  await expect(page.getByText('Nothing matches those filters')).toBeVisible();
  await page.getByRole('button', { name: 'Show all projects' }).click();
  await expect(page.getByText('Nothing matches those filters')).toBeHidden();
});

test('a shared filter URL restores its state', async ({ page }) => {
  await page.goto('/projects?tech=Next.js&sort=name&quality=static');
  await expect(page.getByRole('button', { name: 'Next.js', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Sort by')).toHaveValue('name');
});

test('a card opens its case study with a breadcrumb back', async ({ page }) => {
  await page.goto('/projects?quality=static');
  await page.getByRole('link', { name: 'Venda Khona' }).first().click();
  await expect(page).toHaveURL(/\/projects\/venda-khona/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Venda Khona');
  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Projects' }).click();
  await expect(page).toHaveURL(/\/projects/);
});

test('demo credentials can be copied from a case study', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/projects/triptych-tasks?quality=static');
  await page.getByRole('button', { name: 'Copy username' }).click();
  await expect(page.getByText('username copied')).toBeAttached();
});
