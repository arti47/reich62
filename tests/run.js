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
    check('default nav shows 7 tabs (solo and GM gated off)', tabs.length === 7, `got ${tabs.length}`);

    for (const label of ['Home', 'Sheet', 'Roll', 'Create', 'Combat', 'Rules', 'Settings']) {
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
    check('R-B1: the digital roller toggle unblocks once face data is loaded (D§)',
      !(await page.locator('#flag-digitalRoller').isDisabled()));
    check('R-B1: the simulated roller is still off by default',
      !(await page.locator('#flag-digitalRoller').isChecked()));
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
    // The simulated roller fills the symbol entry from the supplied face table (D§).
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.locator('#flag-digitalRoller').check();
    await page.getByRole('link', { name: 'Roll', exact: true }).click();
    await page.waitForSelector('#roll-digitally');
    await page.getByRole('button', { name: 'Roll this pool' }).click();
    await page.waitForTimeout(80);
    const rolledText = await page.locator('#screen').innerText();
    check('a digital roll reports each die and its face (D§)', /Ability \d+:|Proficiency \d+:|Difficulty \d+:/.test(rolledText), rolledText.slice(0, 160));
    await page.getByRole('button', { name: 'Clear symbols' }).click();
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.locator('#flag-digitalRoller').uncheck();
    await page.getByRole('link', { name: 'Roll', exact: true }).click();
    await page.waitForTimeout(60);
    check('manual entry remains available with the simulated roller off',
      (await page.locator('#roll-digitally').count()) === 0);

    await page.locator('#roller-surveilled').check();
    await page.getByRole('button', { name: 'One more success' }).click();
    await page.getByRole('button', { name: 'One more despair' }).click();
    await page.getByRole('button', { name: 'Log this check' }).click();
    await page.waitForTimeout(80);
    const headerAfter = await page.locator('#resource-header').innerText();
    check('Heat is applied to the character', /Heat 2·0/.test(headerAfter), headerAfter);
    check('the roll is logged', (await page.locator('#screen .card', { hasText: 'Roll log' }).locator('.result').count()) >= 1);

    // --- Phase 4: combat tracker, lifecycle, progress tasks ---
    await page.getByRole('link', { name: 'Combat', exact: true }).click();
    await page.waitForSelector('#bestiary-pick');

    // Bestiary drop-in loads printed stats verbatim (R-15) and computes group WT (R-18).
    await page.selectOption('#bestiary-pick', 'checkpointGuards');
    await page.getByRole('button', { name: 'Drop in', exact: true }).click();
    const guardCard = page.locator('.result', { hasText: 'Checkpoint Guards' }).first();
    check('R-18: a 3-strong group of 4-per-member minions has a group threshold of 12',
      /Wounds 0\/12/.test(await guardCard.innerText()), await guardCard.innerText());
    await guardCard.getByRole('button', { name: '+1 minion' }).click();
    check('R-18: resizing to 4 recomputes the group threshold to 16',
      /Wounds 0\/16/.test(await page.locator('.result', { hasText: 'Checkpoint Guards' }).first().innerText()));

    // R-16: the Guard Dog arrives as a minion and promotes to Rival in one tap.
    await page.selectOption('#bestiary-pick', 'guardDog');
    await page.getByRole('button', { name: 'Drop in', exact: true }).click();
    const dogCard = () => page.locator('.result', { hasText: 'Guard Dog' }).first();
    check('R-16: the Guard Dog defaults to minion tier', /minion/.test(await dogCard().innerText()));
    await dogCard().getByRole('button', { name: 'Promote to Rival' }).click();
    check('R-16: promotion moves it to rival tier', /rival/.test(await dogCard().innerText()));

    // Initiative slots: ownership is fixed and the owning side fills each slot (§5A').
    await page.fill('#init-label', 'Test Runner');
    await page.fill('#init-success', '3');
    await page.selectOption('#init-owner', 'pc');
    await page.getByRole('button', { name: 'Add roll' }).click();
    await page.fill('#init-label', 'Checkpoint Guards');
    await page.fill('#init-success', '1');
    await page.selectOption('#init-owner', 'npc');
    await page.getByRole('button', { name: 'Add roll' }).click();
    await page.getByRole('button', { name: 'Start encounter' }).click();
    await page.waitForSelector('text=/round 1/');
    check('initiative produces one slot per roll, ranked by Success',
      (await page.locator('table tr').count()) === 3); // header plus two slots

    // Progress tracker: the Dragnet escalates and drives both Heat tracks (B§6).
    await page.fill('#task-name', 'City dragnet');
    await page.selectOption('#task-kind', 'dragnet');
    await page.getByRole('button', { name: 'Add task' }).click();
    const dragnet = () => page.locator('.result', { hasText: 'City dragnet' }).first();
    check('dragnet starts at 2 opposition dice', /2 opposition dice/.test(await dragnet().innerText()), await dragnet().innerText());
    await dragnet().getByRole('button', { name: 'Failed round' }).click();
    check('a failed dragnet round escalates the opposition to 3 dice',
      /3 opposition dice/.test(await dragnet().innerText()), await dragnet().innerText());
    // Personal 2 → 3 from the dragnet, and Cell 0 → 2: one from the dragnet itself (B§6)
    // and one from the member crossing Personal Heat 3 (§17.2).
    const headerDragnet = await page.locator('#resource-header').innerText();
    check('a failed dragnet round advances Personal and Cell Heat', /Heat 3·2/.test(headerDragnet), headerDragnet);

    // Lifecycle: End Session awards XP, decays Heat on downtime, and undoes in one step.
    await page.getByRole('button', { name: 'End Session', exact: true }).click();
    await page.waitForSelector('.modal');
    check('the boundary preview lists its deltas before applying', (await page.locator('.modal li').count()) >= 2);
    await page.locator('#lc-downtime').check();
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.waitForTimeout(120);
    const afterSession = await page.locator('#resource-header').innerText();
    check('downtime decays Personal Heat by 1 (§17.4)', /Heat 2·/.test(afterSession), afterSession);
    await page.getByRole('link', { name: 'Sheet', exact: true }).click();
    // 70 XP at creation, 25 spent (Brawn to 2 and one rank of Grit), plus the 20 session award.
    const xpText = await page.locator('#screen').innerText();
    check('the session award adds 20 XP (§27)', /65 XP available of 90 earned/.test(xpText), xpText.match(/\d+ XP available of \d+ earned/) || 'no XP line');

    await page.getByRole('link', { name: 'Combat', exact: true }).click();
    await page.getByRole('button', { name: /^Undo End session/ }).click();
    await page.waitForTimeout(120);
    check('one-step undo restores the pre-boundary state',
      /Heat 3·2/.test(await page.locator('#resource-header').innerText()));

    // --- Phase 4: guided death procedure and enforced rest limits ---
    await page.getByRole('link', { name: 'Sheet', exact: true }).click();
    await page.getByRole('button', { name: 'Start Bleeding Out' }).click();
    await page.getByRole('button', { name: 'Tick one turn' }).click();
    await page.waitForTimeout(80);
    check('Bleeding Out ticks 1 wound and 1 strain per turn (§9)',
      /W 1\/10/.test(await page.locator('#resource-header').innerText()), await page.locator('#resource-header').innerText());

    await page.getByRole('button', { name: 'Healed — clear' }).click();
    await page.fill('#recovery-successes', '2');
    await page.locator('#recovery-nightRest').click();
    await page.waitForTimeout(80);
    check('a night\'s rest heals 1 wound and all strain (§5G)',
      /W 0\/10/.test(await page.locator('#resource-header').innerText()));
    check('the once-per-night limit is enforced', await page.locator('#recovery-nightRest').isDisabled());

    // --- Phase 6 surface: the GM screen with the bestiary browser ---
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.locator('#flag-gmScreen').check();
    await page.waitForTimeout(60);
    await page.getByRole('link', { name: 'GM', exact: true }).click();
    await page.waitForSelector('#bestiary-list');
    check('the bestiary browser lists all 28 published blocks',
      /28 of 28 entries/.test(await page.locator('#bestiary-list').innerText()));
    await page.locator('#bestiary-challenging').check();
    await page.waitForTimeout(60);
    const challenging = await page.locator('#bestiary-list').innerText();
    check('the very-challenging filter narrows the list (§12C)', /of 28 entries/.test(challenging) && !/28 of 28/.test(challenging), challenging.slice(0, 80));
    await page.locator('#bestiary-challenging').uncheck();
    await page.selectOption('#bestiary-tier', 'nemesis');
    await page.waitForTimeout(60);
    check('the tier filter finds the 4 nemeses', /4 of 28 entries/.test(await page.locator('#bestiary-list').innerText()));

    // --- Phase 6: solo mode (official rules, so the tab is real) ---
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    if (!(await page.locator('#flag-soloMode').isChecked())) await page.locator('#flag-soloMode').check();
    await page.waitForTimeout(60);
    await page.getByRole('link', { name: 'Solo', exact: true }).click();
    await page.waitForSelector('#oracle-likelihood');
    check('the Oracle offers all three likelihoods', (await page.locator('#oracle-likelihood option').count()) === 3);

    // A Despair answer reads "No, and…", chains a Random Event, and feeds Heat when the
    // question concerned a surveilled context (§18, §19, §17.1).
    await page.locator('#oracle-surveilled').check();
    const heatBeforeOracle = await page.locator('#resource-header').innerText();
    await page.getByRole('button', { name: 'One more oracle despair' }).click();
    await page.getByRole('button', { name: 'Ask the Oracle' }).click();
    await page.waitForTimeout(80);
    const oracleAnswer = await page.locator('#oracle-answer').innerText();
    check('an uncancelled Despair answers "No, and…"', /No, and/.test(oracleAnswer), oracleAnswer);
    check('a Triumph or Despair chains a Random Event (§19)', /Random Event/.test(oracleAnswer), oracleAnswer);
    check('Oracle Despair in a surveilled context raises Heat (§17.1)',
      (await page.locator('#resource-header').innerText()) !== heatBeforeOracle);

    await page.getByRole('button', { name: 'Meaning (§15A)' }).click();
    check('the meaning table produces a phrase', (await page.locator('#solo-output').innerText()).length > 8);
    await page.getByRole('button', { name: 'Random encounter (B§7)' }).click();
    check('the random encounter table rolls', /\(\d+\)/.test(await page.locator('#solo-output').innerText()));

    // 390px as well as 360px.
    await page.setViewportSize({ width: 390, height: 780 });
    for (const label of ['Home', 'Sheet', 'Roll', 'Combat', 'Solo', 'GM', 'Rules', 'Settings']) {
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
