import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/contact?quality=static');
});

test('shows inline errors next to fields and focuses the first one', async ({ page }) => {
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Please enter your name.')).toBeVisible();
  await expect(page.getByText('Please enter your email address.')).toBeVisible();
  await expect(page.getByLabel(/Your name/)).toBeFocused();
  await expect(page.getByLabel(/Your name/)).toHaveAttribute('aria-invalid', 'true');
});

test('validates on blur and clears the error once fixed', async ({ page }) => {
  const email = page.getByRole('textbox', { name: /^Email/ });
  await email.fill('nope');
  await email.blur();
  await expect(page.getByText('That email address doesn’t look right.')).toBeVisible();
  await email.fill('ada@example.com');
  await expect(page.getByText('That email address doesn’t look right.')).toBeHidden();
});

async function fillValid(page: import('@playwright/test').Page) {
  await page.getByLabel(/Your name/).fill('Ada Lovelace');
  await page.getByRole('textbox', { name: /^Email/ }).fill('ada@example.com');
  await page.getByLabel(/Subject/).fill('A project idea');
  await page.getByLabel(/Message/).fill('I would like to talk about building something together.');
}

test('sends the message, includes the empty honeypot, and shows a confirmation', async ({ page }) => {
  let body: Record<string, string> | undefined;
  await page.route('**/api/contact', async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Message sent.' }) });
  });
  await fillValid(page);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('heading', { name: 'Message sent' })).toBeFocused();
  expect(body?.email).toBe('ada@example.com');
  expect(body?.website).toBe('');
  await page.getByRole('button', { name: 'Send another message' }).click();
  await expect(page.getByLabel(/Your name/)).toHaveValue('');
});

test('explains a server failure without losing what was typed', async ({ page }) => {
  await page.route('**/api/contact', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Something went wrong on my side.' }) }));
  await fillValid(page);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('form', { name: 'Send a message' }).getByRole('alert')).toContainText('Something went wrong on my side.');
  await expect(page.getByLabel(/Your name/)).toHaveValue('Ada Lovelace');
});

test('the real API rejects invalid input and silently accepts honeypot bots', async ({ request }) => {
  const bad = await request.post('/api/contact', { data: { name: '', email: 'x' } });
  expect(bad.status()).toBe(400);
  expect((await bad.json()).errors.email).toBeTruthy();
  const bot = await request.post('/api/contact', { data: { name: 'Bot', email: 'bot@example.com', subject: 'Buy now', message: 'spam spam spam spam', website: 'http://spam' } });
  expect(bot.status()).toBe(200);
});
