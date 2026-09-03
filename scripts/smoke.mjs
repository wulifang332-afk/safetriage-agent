import { chromium } from '@playwright/test';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:5173/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.on('console', (message) => console.log(`[browser:${message.type()}] ${message.text()}`));
page.on('pageerror', (error) => console.log(`[pageerror] ${error.message}`));
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.locator('.brand').waitFor({ timeout: 10000 });
await page.screenshot({ path: 'work/qa/desktop.png', fullPage: true });

await page.getByText('Chest pain episode').click();
await page.getByRole('button', { name: /Run Agent/i }).click();
await page.getByRole('button', { name: /Escalate/i }).click();
await page.getByText('Escalated to Urgent Nurse Triage Queue').first().waitFor();
await page.screenshot({ path: 'work/qa/escalation.png', fullPage: true });

await page.setViewportSize({ width: 390, height: 900 });
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.screenshot({ path: 'work/qa/mobile.png', fullPage: true });

const hasOverflow = await page.evaluate(() => {
  const doc = document.documentElement;
  return doc.scrollWidth > doc.clientWidth + 1;
});

await browser.close();

if (hasOverflow) {
  throw new Error('Mobile viewport has horizontal overflow');
}

console.log('Smoke test passed: desktop, escalation workflow, and mobile render verified.');
