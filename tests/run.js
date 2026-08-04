// Headless regression harness (CLAUDE.md §13.4, §13.5).
// Runs the real app in Chromium with zero console errors tolerated, and pins every
// confirmed ruling from CLAUDE.md §4 so a later edit cannot drift off it.

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createServer, listen } from './serve.js';
import { pinChecks } from './rulings.test.js';
import { dataChecks } from './data.test.js';

// The pre-installed Chromium in this environment; PLAYWRIGHT_BROWSERS_PATH points at it.
const BROWSER_ROOT = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const candidates = fs.existsSync(BROWSER_ROOT) ? fs.readdirSync(BROWSER_ROOT) : [];
  const dir = candidates.find((d) => /^chromium-/.test(d)) || candidates.find((d) => /^chromium/.test(d));
  return dir ? path.join(BROWSER_ROOT, dir, 'chrome-linux', 'chrome') : 'chromium';
}
const EXECUTABLE = findChromium();

let passed = 0;
const failures = [];

export function check(name, condition, detail = '') {
  if (condition) { passed += 1; return true; }
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  return false;
}

export function equal(name, actual, expected) {
  return check(name, Object.is(actual, expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function main() {
  // --- pure data and engine checks, no browser needed ---
  await dataChecks({ check, equal });
  await pinChecks({ check, equal });

  // --- browser checks ---
  const server = createServer();
  const port = await listen(server);
  const base = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ['--no-sandbox'] });
  const consoleErrors = [];

  try {
    const context = await browser.newContext({ viewport: { width: 360, height: 780 } });
    const page = await context.newPage();
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    // Firebase is aborted in the harness (CLAUDE.md §13.4).
    await page.route('**://*.firebaseio.com/**', (route) => route.abort());
    await page.route('**://*.googleapis.com/**', (route) => route.abort());

    await page.goto(base + '/index.html', { waitUntil: 'networkidle' });
    check('app boots', await page.locator('#screen .card').first().isVisible());
    equal('home is the default route', new URL(page.url()).hash, '#/');

    // Every visible tab renders, at 360px, with no horizontal overflow.
    const tabs = await page.locator('#bottom-nav a').all();
    check('default nav has 3 tabs (solo and GM gated off)', tabs.length === 3, `got ${tabs.length}`);

    for (const label of ['Home', 'Rules', 'Settings']) {
      await page.getByRole('link', { name: label, exact: true }).click();
      await page.waitForTimeout(60);
      check(`${label} renders content`, await page.locator('#screen .card').first().isVisible());
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`${label} has no horizontal overflow at 360px`, overflow <= 0, `overflow ${overflow}px`);
    }

    // Rules library search over the extracted data.
    await page.getByRole('link', { name: 'Rules', exact: true }).click();
    await page.waitForSelector('#rules-results .result');
    const total = await page.locator('#rules-results .result').count();
    check('rules library is populated', total > 0, `entries rendered ${total}`);
    await page.fill('#rules-search', '§17.3');
    await page.waitForTimeout(60);
    check('search finds Heat thresholds by section number', await page.locator('#rules-results .result').count() >= 5);
    await page.fill('#rules-search', 'B§6');
    await page.waitForTimeout(60);
    check('search finds bestiary encounter blocks by B§ citation', await page.locator('#rules-results .result').count() >= 4);

    // R-B1 — the digital roller toggle is present but blocked.
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    check('R-B1: digital roller toggle is disabled', await page.locator('#flag-digitalRoller').isDisabled());
    // R-8 — the house-aid budget defaults to 500 and is badged.
    equal('R-8: starting budget defaults to 500', await page.inputValue('#starting-budget'), '500');
    check('R-8: house-aid badge is shown', await page.getByText('not a printed rule').first().isVisible());

    // Gated tabs appear when their flag is turned on.
    await page.locator('#flag-soloMode').check();
    await page.waitForTimeout(60);
    check('solo tab appears when soloMode is on', await page.locator('#bottom-nav a', { hasText: 'Solo' }).count() === 1);

    // A11y basics.
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    check('nav marks the current tab with aria-current', await page.locator('#bottom-nav a[aria-current="page"]').count() === 1);
    check('icon-only buttons are labelled', await page.locator('#theme-toggle[aria-label]').count() === 1);

    // 390px as well as 360px.
    await page.setViewportSize({ width: 390, height: 780 });
    for (const label of ['Home', 'Rules', 'Settings']) {
      await page.getByRole('link', { name: label, exact: true }).click();
      await page.waitForTimeout(60);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`${label} has no horizontal overflow at 390px`, overflow <= 0, `overflow ${overflow}px`);
    }

    check('zero console errors', consoleErrors.length === 0, consoleErrors.join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\n${passed} checks passed, ${failures.length} failed`);
  if (failures.length) {
    failures.forEach((f) => console.error(`  FAIL ${f}`));
    process.exit(1);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
