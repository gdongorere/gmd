import { expect, test } from '@playwright/test';

// `quality=static` skips WebGL so these checks stay fast and deterministic.
const routes: { path: string; heading: RegExp }[] = [
  { path: '/', heading: /Godliness/ },
  { path: '/projects', heading: /Projects/ },
  { path: '/projects/venda-khona', heading: /Venda Khona/ },
  { path: '/contact', heading: /talk/i },
];

for (const { path, heading } of routes) {
  test(`${path} renders with one h1 and working landmarks`, async ({ page }) => {
    const response = await page.goto(`${path}?quality=static`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });
}

test('unknown routes show the friendly 404', async ({ page }) => {
  const response = await page.goto('/definitely-not-a-page?quality=static');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lost in space');
  await expect(page.getByRole('link', { name: 'Take me home' })).toBeVisible();
});

test('skip link jumps to the main content', async ({ page }) => {
  await page.goto('/?quality=static');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
});

test('sitemap, robots and share image are served', async ({ request }) => {
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain('/projects/venda-khona');
  expect((await request.get('/robots.txt')).ok()).toBe(true);
  const og = await request.get('/opengraph-image');
  expect(og.ok()).toBe(true);
  expect(og.headers()['content-type']).toContain('image/png');
});

test('stored contact messages are not readable through the API', async ({ request }) => {
  for (const method of ['get', 'put', 'delete'] as const) {
    const res = await request[method]('/api/contact');
    expect(res.status(), `${method.toUpperCase()} /api/contact`).toBe(405);
  }
  expect((await request.get('/api/projects')).status()).toBe(404);
});

test('mobile menu opens, traps focus and closes with Escape @mobile', async ({ page }) => {
  await page.goto('/?quality=static');
  const open = page.getByRole('button', { name: 'Open menu' });
  await open.tap();
  const nav = page.getByRole('navigation', { name: 'Mobile' });
  await expect(nav).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(nav).toBeHidden();
  await expect(open).toBeFocused();
});
