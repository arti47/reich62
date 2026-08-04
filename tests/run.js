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
    check('default nav shows 6 tabs (solo and GM gated off)', tabs.length === 6, `got ${tabs.length}`);

    for (const label of ['Home', 'Sheet', 'Roll', 'Create', 'Rules', 'Settings']) {
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

    // --- 🏁 First Session Playable: create → sheet → resolve a check → track resources ---
    await page.getByRole('link', { name: 'Create', exact: true }).click();
    await page.waitForSelector('#char-name');
    await page.fill('#char-name', 'Test Runner');
    await page.locator('#career-resistanceRunner').check();
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Career skills: exactly four picks, and the step will not advance on three.
    for (const skillId of ['deception', 'stealth', 'streetwise']) await page.locator(`#pick-${skillId}`).check();
    check('wizard blocks advancing with only 3 career skills', await page.getByRole('button', { name: 'Next', exact: true }).isDisabled());
    await page.locator('#pick-cool').check();
    check('wizard allows advancing with 4 career skills', !(await page.getByRole('button', { name: 'Next', exact: true }).isDisabled()));
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // XP step: spend on a characteristic and confirm the cost model (§7).
    await page.waitForSelector('#roller-skill, .stat-grid');
    const xpBefore = await page.locator('.card p.small.muted').first().textContent();
    check('wizard opens with 70 XP', /70 of 70 XP left/.test(xpBefore), xpBefore);
    await page.getByRole('button', { name: 'Raise Brawn', exact: true }).click();
    const xpAfterBrawn = await page.locator('.card p.small.muted').first().textContent();
    check('raising a characteristic to 2 costs 20 XP', /50 of 70 XP left/.test(xpAfterBrawn), xpAfterBrawn);

    // Talent pyramid is enforced live (§7, §12A).
    const berserkRow = page.locator('.result', { hasText: 'Berserk' }).first();
    check('R-11/pyramid: a tier 2 talent is locked with no tier 1 held',
      (await berserkRow.getByRole('button', { name: 'Locked' }).count()) === 1);
    await page.locator('.result', { hasText: 'Grit' }).first().getByRole('button', { name: 'Buy' }).click();
    check('pyramid: the tier 2 talent unlocks once a tier 1 is held',
      (await page.locator('.result', { hasText: 'Berserk' }).first().getByRole('button', { name: 'Buy' }).count()) === 1);

    await page.getByRole('button', { name: 'Next', exact: true }).click();   // derived
    check('R-1 badge shown on the derived step', await page.getByText('R-1 inferred').first().isVisible());
    const woundStat = await page.locator('.stat', { hasText: 'Wound Threshold' }).locator('.stat-value').innerText();
    equal('derived: wound threshold is base 8 + Brawn 2', woundStat.trim(), '10');
    const strainStat = await page.locator('.stat', { hasText: 'Strain Threshold' }).locator('.stat-value').innerText();
    // Base 10 + Willpower 1 + 1 for the rank of Grit bought above (§6, §12A).
    equal('derived: strain threshold includes the Grit rank just bought', strainStat.trim(), '12');

    await page.getByRole('button', { name: 'Next', exact: true }).click();   // motivation
    check('motivation step blocks until all four facets are set',
      await page.getByRole('button', { name: 'Next', exact: true }).isDisabled());
    for (const facet of ['desire', 'fear', 'strength', 'flaw']) {
      await page.selectOption(`#motivation-${facet}`, { index: 1 });
    }
    check('motivation step advances once all four are set',
      !(await page.getByRole('button', { name: 'Next', exact: true }).isDisabled()));
    await page.getByRole('button', { name: 'Next', exact: true }).click();   // gear
    check('R-8 house-aid badge on the gear step', await page.getByText('house aid — not a printed rule').first().isVisible());
    await page.getByRole('button', { name: 'Next', exact: true }).click();   // review
    await page.getByRole('button', { name: 'Save character' }).click();
    await page.waitForSelector('#resource-header:not([hidden])');

    check('saving lands on the sheet', new URL(page.url()).hash === '#/sheet');
    check('persistent resource header appears', await page.locator('#resource-header .chip').count() >= 5);
    const header = await page.locator('#resource-header').innerText();
    check('header shows wounds against the true threshold', /W 0\/10/.test(header), header);
    check('header shows Story Points as player/GM', /SP 1\/0/.test(header), header);
    check('header shows Personal and Cell Heat', /Heat 0·0/.test(header), header);

    // Vitals stepper clamps and flips incapacitation at the threshold (§6).
    for (let i = 0; i < 10; i += 1) await page.getByRole('button', { name: 'Raise Wounds' }).click();
    check('incapacitated once wounds meet the threshold', /INCAPACITATED/.test(await page.locator('#resource-header').innerText()));
    for (let i = 0; i < 10; i += 1) await page.getByRole('button', { name: 'Lower Wounds' }).click();

    // The roller: pool build, cancellation, Heat from Despair in a surveilled context.
    await page.getByRole('link', { name: 'Roll', exact: true }).click();
    await page.waitForSelector('#roller-skill');
    await page.selectOption('#roller-skill', 'deception');
    const poolText = await page.locator('#screen .card', { hasText: 'Pool' }).first().innerText();
    check('pool is built from the skill and its characteristic',
      /Proficiency|Ability/.test(poolText) && /Deception 1 with Cunning 1/.test(poolText), poolText);
    check('difficulty dice come from the difficulty ladder', /2 Difficulty/.test(poolText), poolText);

    await page.locator('#roller-surveilled').check();
    await page.getByRole('button', { name: 'One more success' }).click();
    await page.getByRole('button', { name: 'One more despair' }).click();
    const resultText = await page.locator('#roll-result').innerText();
    check('an uncancelled Despair on an evasion check reads +2 Personal Heat (§17.1)',
      /Personal Heat \+2/.test(resultText), resultText);
    await page.getByRole('button', { name: 'Log this check' }).click();
    await page.waitForTimeout(80);
    const headerAfter = await page.locator('#resource-header').innerText();
    check('Heat is applied to the character', /Heat 2·0/.test(headerAfter), headerAfter);
    check('the roll is logged', (await page.locator('#screen .card', { hasText: 'Roll log' }).locator('.result').count()) >= 1);

    // 390px as well as 360px.
    await page.setViewportSize({ width: 390, height: 780 });
    for (const label of ['Home', 'Sheet', 'Roll', 'Rules', 'Settings']) {
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
