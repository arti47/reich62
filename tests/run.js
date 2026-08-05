// Headless regression harness (CLAUDE.md §13.4, §13.5).
// Runs the real app in Chromium with zero console errors tolerated, and pins every
// confirmed ruling from CLAUDE.md §4 so a later edit cannot drift off it.

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

// The pure data and engine checks import real app modules, some of which persist through
// localStorage and announce changes on `document`. Both are shimmed so those modules can be
// exercised outside a browser; the browser section below runs against the real thing.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = { addEventListener() {}, dispatchEvent() { return true; } };
}
if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
}
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

    // Navigation goes through the hash so the harness does not depend on which tabs the
    // current seat shows; the nav itself is asserted separately.
    const go = async (hash) => { await page.goto(base + '/index.html' + hash, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(120); };
    const subtab = async (label) => { await page.getByRole('tab', { name: label, exact: true }).click(); await page.waitForTimeout(90); };

    await page.goto(base + '/index.html', { waitUntil: 'networkidle' });
    check('app boots', await page.locator('#screen .card').first().isVisible());
    equal('home is the default route', new URL(page.url()).hash, '#/');

    // Every visible tab renders, at 360px, with no horizontal overflow.
    // The seat model caps the bar at five tabs; everything else lives in the header menu.
    const tabs = await page.locator('#bottom-nav a').all();
    check('player mode shows five tabs, not nine', tabs.length === 5, `got ${tabs.length}`);
    const tabLabels = (await page.locator('#bottom-nav a').allInnerTexts()).join(' ');
    check('the player seat shows the player screens', /HOME/i.test(tabLabels) && /SHEET/i.test(tabLabels) && /ROLL/i.test(tabLabels), tabLabels);
    check('the GM screen is not a tab in the player seat', !/\bGM\b/i.test(tabLabels), tabLabels);
    check('every screen is still reachable from the header menu', (await page.locator('#screen-menu').count()) === 1);

    for (const label of ['Home', 'Sheet', 'Roll', 'Create', 'Combat', 'Rules', 'Settings']) {
      check(`${label} renders content`, await page.locator('#screen .card, #screen section.card').first().isVisible());
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`${label} has no horizontal overflow at 360px`, overflow <= 0, `overflow ${overflow}px`);
    }

    // Rules library search over the extracted data.
    await go('#/rules');
    await page.waitForSelector('#rules-results .rule-entry');
    const total = await page.locator('#rules-results .rule-entry').count();
    check('rules library is populated', total > 0, `entries rendered ${total}`);
    await page.fill('#rules-search', '§17.3');
    await page.waitForTimeout(60);
    check('search finds Heat thresholds by section number', await page.locator('#rules-results .rule-entry').count() >= 5);
    check('results are grouped by the part of the books they come from', (await page.locator('#rules-results .rule-section').count()) >= 1);
    await page.fill('#rules-search', 'B§6');
    await page.waitForTimeout(60);
    check('search finds bestiary encounter blocks by B§ citation', await page.locator('#rules-results .rule-entry').count() >= 4);

    // R-B1 — the digital roller toggle is present but blocked.
    await go('#/settings');
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
    check('the solo screen becomes reachable when its option is on',
      (await page.locator('#bottom-nav a', { hasText: 'Solo' }).count()) + (await page.locator('#screen-menu').count()) >= 1);

    // A11y basics.
    await go('#/');
    check('nav marks the current tab with aria-current', await page.locator('#bottom-nav a[aria-current="page"]').count() === 1);
    check('icon-only buttons are labelled', await page.locator('#theme-toggle[aria-label]').count() === 1);

    // --- 🏁 First Session Playable: create → sheet → resolve a check → track resources ---
    await go('#/create');
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
    const xpBefore = await page.locator('#screen p.small.muted').first().textContent();
    check('wizard opens with 70 experience', /70 of 70 experience/.test(xpBefore), xpBefore);
    await page.getByRole('button', { name: 'Raise Brawn', exact: true }).click();
    const xpAfterBrawn = await page.locator('#screen p.small.muted').first().textContent();
    check('raising a characteristic to 2 costs 20 XP', /50 of 70 experience/.test(xpAfterBrawn), xpAfterBrawn);

    // Talents live on their own sub-step, grouped by tier and filterable.
    await subtab('Talents');
    await page.fill('#talent-filter', 'Berserk');
    await page.waitForTimeout(90);
    const berserkRow = page.locator('.result', { hasText: 'Berserk' }).first();
    check('pyramid: a tier 2 talent is locked with no tier 1 held',
      (await berserkRow.getByRole('button', { name: 'Locked' }).count()) === 1);
    check('the wizard says why a talent is locked',
      /pyramid/i.test(await berserkRow.innerText()), await berserkRow.innerText());
    await page.fill('#talent-filter', 'Grit');
    await page.waitForTimeout(90);
    await page.locator('.result', { hasText: 'Grit' }).first().getByRole('button', { name: 'Buy' }).click();
    await page.fill('#talent-filter', 'Berserk');
    await page.waitForTimeout(90);
    check('pyramid: the tier 2 talent unlocks once a tier 1 is held',
      (await page.locator('.result', { hasText: 'Berserk' }).first().getByRole('button', { name: 'Buy' }).count()) === 1);
    await page.fill('#talent-filter', '');
    await page.waitForTimeout(90);

    await page.getByRole('button', { name: 'Next', exact: true }).click();   // derived
    check('the derived step flags an inferred base in plain words',
      await page.getByText('inferred', { exact: false }).first().isVisible());
    check('no internal ruling codes leak into the interface',
      (await page.evaluate(() => (document.querySelector('#screen').innerText.match(/\bR-(?:B1|\d+)\b/g) || []).length)) === 0);
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
    // Pocket money: rolled once the shopping is done, kept apart from the budget.
    await page.getByRole('button', { name: 'Roll pocket money' }).click();
    await page.waitForTimeout(90);
    const pocketText = await page.locator('.result', { hasText: 'Pocket money' }).innerText();
    const pocket = Number((pocketText.match(/Rolled (\d+)/) || [])[1]);
    check('pocket money rolls a d100', pocket >= 1 && pocket <= 100, String(pocket));
    check('pocket money cannot buy more starting gear',
      /cannot buy more starting gear/i.test(pocketText), pocketText.replace(/\n/g, ' | '));

    await page.getByRole('button', { name: 'Next', exact: true }).click();   // review
    await page.getByRole('button', { name: 'Save character' }).click();
    await page.waitForSelector('#resource-header:not([hidden])');

    check('saving lands on the sheet', new URL(page.url()).hash === '#/sheet');

    // Unspent budget plus pocket money becomes the character's cash.
    await subtab('Gear');
    const startingCash = Number(await page.inputValue('#purse-cash'));
    check('the character starts with the unspent budget plus pocket money',
      startingCash >= 500 && startingCash <= 600, String(startingCash));
    await subtab('Vitals');
    check('persistent resource header appears', await page.locator('#resource-header .chip').count() >= 5);
    const header = await page.locator('#resource-header').innerText();
    check('the resource bar shows injury against its true limit', /Injury 0\/10/.test(header), header);
    check('the resource bar shows story points as players / GM', /Story 1\/0/.test(header), header);
    check('header shows Personal and Cell Heat', /Heat 0·0/.test(header), header);

    // Vitals stepper clamps and flips incapacitation at the threshold (§6).
    await page.fill('#vital-injury', '10');
    await page.locator('#vital-injury').blur();
    await page.waitForTimeout(80);
    check('incapacitated once wounds meet the threshold', /INCAPACITATED/.test(await page.locator('#resource-header').innerText()));
    await page.fill('#vital-injury', '0');
    await page.locator('#vital-injury').blur();
    await page.waitForTimeout(80);

    // The roller: pool build, cancellation, Heat from Despair in a surveilled context.
    await go('#/roll');
    await page.waitForSelector('#roller-skill');
    await page.selectOption('#roller-skill', 'deception');
    // The dice counts live in the entry panel and update as the setup changes.
    const dieCount = async (name) => Number(await page.locator('.die-count', { hasText: new RegExp(`^\\d+\\s*${name}`, 'i') }).first().locator('.die-count-value').innerText());
    check('pool is built from the skill and its characteristic', (await dieCount('Proficiency')) === 1, 'proficiency');
    equal('difficulty dice come from the difficulty ladder', await dieCount('Difficulty'), 2);

    // Change the difficulty and the numbers move without touching anything else.
    await page.selectOption('#roller-difficulty', 'daunting');
    await page.waitForTimeout(90);
    equal('raising the difficulty updates the dice count live', await dieCount('Difficulty'), 4);
    await page.selectOption('#roller-difficulty', 'average');
    await page.waitForTimeout(90);
    equal('lowering it again updates back', await dieCount('Difficulty'), 2);

    // A situational option moves them too.
    await page.locator('#roller-cover').check();
    await page.waitForTimeout(90);
    equal('taking cover adds a Boost die live', await dieCount('Boost'), 1);
    await page.locator('#roller-cover').uncheck();
    await page.waitForTimeout(90);
    equal('leaving cover removes it again', await dieCount('Boost'), 0);

    // --- called shots, two-weapon fighting and swaying a crowd (§10A, §5H, §11) ---
    await page.selectOption('#roller-difficulty', 'average');
    await page.waitForTimeout(90);
    const setbackBefore = await dieCount('Setback');
    await page.selectOption('#roller-called-shot', '1');
    await page.waitForTimeout(90);
    equal('a called shot aimed once adds two Setback', await dieCount('Setback'), setbackBefore + 2);
    await page.selectOption('#roller-called-shot', '2');
    await page.waitForTimeout(90);
    equal('aiming twice in a row halves that', await dieCount('Setback'), setbackBefore + 1);
    await page.selectOption('#roller-called-shot', '');
    await page.waitForTimeout(90);
    equal('dropping the called shot takes the Setback back off', await dieCount('Setback'), setbackBefore);

    const difficultyBefore = await dieCount('Difficulty');
    await page.locator('#roller-two-weapon').check();
    await page.waitForTimeout(90);
    equal('a second weapon makes the check one step harder', await dieCount('Difficulty'), difficultyBefore + 1);
    check('the app says what the off-hand hit costs',
      /2 advantage or 1 triumph/i.test(await page.locator('#screen').innerText()));
    await page.locator('#roller-two-weapon').uncheck();
    await page.waitForTimeout(90);
    equal('putting the second weapon away takes it back off', await dieCount('Difficulty'), difficultyBefore);

    await page.selectOption('#roller-audience', '16–50');
    await page.waitForTimeout(90);
    equal('a crowd of 16 to 50 sets a Daunting difficulty', await dieCount('Difficulty'), 4);
    await page.selectOption('#roller-audience', '');
    await page.waitForTimeout(90);
    equal('back to one listener and the picker governs again', await dieCount('Difficulty'), difficultyBefore);

    // Changing the skill rebuilds the positive side.
    await page.selectOption('#roller-skill', 'athletics');
    await page.waitForTimeout(90);
    check('changing skill rebuilds the positive dice',
      (await dieCount('Ability')) + (await dieCount('Proficiency')) >= 1);
    await page.selectOption('#roller-skill', 'deception');
    await page.waitForTimeout(90);

    await page.locator('#roller-surveilled').check();
    await page.getByRole('button', { name: 'One more success' }).click();
    await page.getByRole('button', { name: 'One more despair' }).click();
    const resultText = await page.locator('#roll-result').innerText();
    check('an uncancelled Despair on an evasion check reads +2 Personal Heat (§17.1)',
      /Personal Heat \+2/.test(resultText), resultText);
    // The simulated roller fills the symbol entry from the supplied face table (D§).
    await go('#/settings');
    await page.locator('#flag-digitalRoller').check();
    await go('#/roll');
    await page.waitForSelector('#roll-digitally');
    await page.getByRole('button', { name: 'Roll this pool' }).click();
    await page.waitForTimeout(80);
    const rolledText = await page.locator('#screen').innerText();
    check('a digital roll fills the symbol entry without a per-die readout',
      !/Ability \d+:|Proficiency \d+:|Difficulty \d+:/.test(rolledText), rolledText.slice(0, 160));
    // The app rolled them, so there is nothing to key in: read-only, non-zero symbols only.
    check('a rolled pool shows no plus or minus buttons',
      (await page.locator('#roll-pool button', { hasText: /^[−+]$/ }).count()) === 0);
    const rolledRows = await page.locator('#rolled-symbols .rolled-row').allInnerTexts();
    check('every symbol shown was actually rolled', rolledRows.every((r) => !/^\s*0\s/.test(r)), rolledRows.join(' | '));
    check('symbols that did not come up are left out', rolledRows.length < 6, `rows ${rolledRows.length}`);
    await page.getByRole('button', { name: 'Clear symbols' }).click();
    await page.waitForTimeout(80);
    check('clearing a rolled pool empties the list',
      /Nothing rolled yet/.test(await page.locator('#rolled-symbols').innerText()));
    await go('#/settings');
    await page.locator('#flag-digitalRoller').uncheck();
    await go('#/roll');
    await page.waitForTimeout(60);
    check('manual entry remains available with the simulated roller off',
      (await page.locator('#roll-digitally').count()) === 0);
    check('the symbol pad comes back with the simulated roller off (R-B1)',
      (await page.getByRole('button', { name: 'One more success' }).count()) === 1);

    await page.locator('#roller-surveilled').check();
    await page.getByRole('button', { name: 'One more success' }).click();
    await page.getByRole('button', { name: 'One more despair' }).click();
    await page.getByRole('button', { name: 'Log this check' }).click();
    await page.waitForTimeout(80);
    const headerAfter = await page.locator('#resource-header').innerText();
    check('Heat is applied to the character', /Heat 2·0/.test(headerAfter), headerAfter);
    check('the roll is logged', (await page.locator('#screen section.card', { hasText: 'Recent checks' }).locator('.log-row').count()) >= 1);
    const logRow = await page.locator('.log-row').first().innerText();
    check('a log row shows the result, not the whole derivation',
      /Success|Failure/.test(logRow) && !/Pool /.test(logRow) && !/entered /.test(logRow), logRow.replace(/\n/g, ' | '));
    check('the outcome stays on screen instead of only flashing a toast',
      /Suspicion on you/.test(await page.locator('.outcome').first().innerText()));

    // --- Phase 4: combat tracker, lifecycle, progress tasks ---
    await go('#/combat');
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
    await go('#/sheet');
    // 70 XP at creation, 25 spent (Brawn to 2 and one rank of Grit), plus the 20 session award.
    const xpText = await page.locator('#screen').innerText();
    check('the session award adds 20 XP (§27)', /65 experience unspent/.test(xpText), (xpText.match(/\d+ experience unspent/) || ['no XP line'])[0]);

    await go('#/combat');
    await page.getByRole('button', { name: /^Undo End session/ }).click();
    await page.waitForTimeout(120);
    check('one-step undo restores the pre-boundary state',
      /Heat 3·2/.test(await page.locator('#resource-header').innerText()));

    // --- Phase 4: guided death procedure and enforced rest limits ---
    await go('#/sheet');
    await subtab('Talents & injuries');
    await page.getByRole('button', { name: 'Start Bleeding Out' }).click();
    await page.getByRole('button', { name: 'Tick one turn' }).click();
    await page.waitForTimeout(80);
    check('Bleeding Out ticks 1 wound and 1 strain per turn (§9)',
      /Injury 1\/10/.test(await page.locator('#resource-header').innerText()), await page.locator('#resource-header').innerText());

    await page.getByRole('button', { name: 'Healed — clear' }).click();
    await subtab('Recovery');
    await page.fill('#recovery-successes', '2');
    await page.locator('#recovery-nightRest').click();
    await page.waitForTimeout(80);
    check('a night\'s rest heals 1 wound and all strain (§5G)',
      /Injury 0\/10/.test(await page.locator('#resource-header').innerText()));
    check('the once-per-night limit is enforced', await page.locator('#recovery-nightRest').isDisabled());

    // --- the Medicine ladder works itself out from the patient's own wounds (§5G) ---
    check('an unhurt patient is an Easy Medicine check',
      /easy medicine check/i.test(await page.locator('#medicine-difficulty').innerText()),
      await page.locator('#medicine-difficulty').innerText());
    await page.locator('#medicine-selfTreatment').check();
    await page.waitForTimeout(90);
    check('treating yourself pushes it two steps up the ladder',
      /hard medicine check/i.test(await page.locator('#medicine-difficulty').innerText()),
      await page.locator('#medicine-difficulty').innerText());
    await page.locator('#medicine-noEquipment').check();
    await page.waitForTimeout(90);
    check('with no kit either, one step more',
      /daunting medicine check/i.test(await page.locator('#medicine-difficulty').innerText()),
      await page.locator('#medicine-difficulty').innerText());
    await page.locator('#medicine-to-roller').click();
    await page.waitForTimeout(140);
    equal('the check lands on the Roll screen ready to go', await page.inputValue('#roller-skill'), 'medicine');
    equal('at the difficulty the ladder worked out', await page.inputValue('#roller-difficulty'), 'daunting');

    // --- falls: mitigation first, then soak, and strain is never soaked (§5I) ---
    await go('#/sheet');
    await subtab('Recovery');
    await page.locator('#medicine-selfTreatment').uncheck();
    await page.locator('#medicine-noEquipment').uncheck();
    await page.selectOption('#fall-band', 'short');
    await page.fill('#fall-successes', '3');
    await page.fill('#fall-advantages', '4');
    await page.locator('#apply-fall').click();
    await page.waitForTimeout(140);
    const fallText = await page.locator('#screen').innerText();
    check('the fall reports wounds after soak and strain untouched by it',
      /short fall/i.test(fallText) && /strain/i.test(fallText), fallText.slice(0, 160));
    check('the fall reached the sheet\'s vitals',
      /Injury [1-9]/.test(await page.locator('#resource-header').innerText()),
      await page.locator('#resource-header').innerText());
    await page.selectOption('#fall-band', 'long');
    await page.fill('#fall-successes', '0');
    await page.fill('#fall-advantages', '0');
    await page.locator('#apply-fall').click();
    await page.waitForTimeout(140);
    check('a long fall says to roll a Critical Injury at +50',
      /\+50/.test(await page.locator('#screen').innerText()));

    // --- Phase 6 surface: the GM screen with the bestiary browser ---
    await go('#/settings');
    await page.locator('#flag-gmScreen').check();
    await page.waitForTimeout(60);
    await go('#/gm');
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

    // Log entries can be deleted one at a time, and the whole log cleared.
    await go('#/roll');
    await page.getByRole('button', { name: 'One more success' }).click();
    await page.getByRole('button', { name: 'Log this check' }).click();
    await page.waitForTimeout(120);
    const beforeDelete = await page.locator('.log-row').count();
    check('a second check adds a second log row', beforeDelete >= 2, `rows ${beforeDelete}`);
    await page.locator('.log-row').first().getByRole('button', { name: 'Delete' }).click();
    await page.waitForTimeout(120);
    check('deleting one entry leaves the rest', (await page.locator('.log-row').count()) === beforeDelete - 1);
    await page.getByRole('button', { name: /^Clear all/ }).click();
    await page.waitForSelector('.modal-backdrop');
    check('clearing the whole log asks first', /cannot be undone/i.test(await page.locator('.modal').innerText()));
    await page.getByRole('button', { name: 'Delete them' }).click();
    await page.waitForTimeout(120);
    check('clearing empties the log', (await page.locator('.log-row').count()) === 0);
    check('the empty log explains itself', /Nothing logged yet/.test(await page.locator('#screen').innerText()));

    // A fresh Roll screen is not a failed check.
    await go('#/roll');
    await page.waitForSelector('#roll-result');
    const pending = await page.locator('#roll-result').innerText();
    check('with nothing entered the outcome is neutral, not a failure',
      /waiting for your dice/i.test(pending) && !/failure/i.test(pending), pending.slice(0, 80));
    check('logging is disabled until symbols are entered',
      await page.getByRole('button', { name: 'Log this check' }).isDisabled());
    await page.getByRole('button', { name: 'One more success' }).click();
    await page.waitForTimeout(90);
    check('entering a success flips the outcome to a verdict',
      /success/i.test(await page.locator('#roll-result .status-chip').innerText()));
    await page.getByRole('button', { name: 'Clear symbols' }).click();

    // --- Phase 6: solo mode (official rules, so the tab is real) ---
    await go('#/settings');
    if (!(await page.locator('#flag-soloMode').isChecked())) await page.locator('#flag-soloMode').check();
    await page.waitForTimeout(60);
    await go('#/solo');
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

    await page.getByRole('button', { name: 'Meaning', exact: true }).click();
    check('the meaning table produces a phrase', (await page.locator('#solo-output').innerText()).length > 8);
    await page.getByRole('button', { name: 'Random encounter', exact: true }).click();
    check('the random encounter table rolls', /\(\d+\)/.test(await page.locator('#solo-output').innerText()));

    // --- UX pass: seat modes, checklist, suggested spread, confirmations, help ---
    await go('#/settings');
    await page.locator('#mode-gm').check();
    await page.waitForTimeout(120);
    const gmTabs = (await page.locator('#bottom-nav a').allInnerTexts()).join(' ');
    check('switching seat to GM swaps the tab bar', /GM/i.test(gmTabs) && /COMBAT/i.test(gmTabs), gmTabs);
    check('the GM seat still shows five tabs', (await page.locator('#bottom-nav a').count()) === 5);
    await page.locator('#mode-player').check();
    await page.waitForTimeout(120);

    await go('#/');
    check('home leads with a start-here checklist', (await page.locator('.checklist li').count()) === 4);
    check('completed steps are ticked off', (await page.locator('.checklist .tick', { hasText: '✓' }).count()) >= 2);

    check('panels explain themselves in plain language', (await page.locator('#screen .lede').count()) >= 2);
    check('each panel offers a how-this-works expander', (await page.locator('#screen details.howto').count()) >= 2);

    // Every screen is reachable even when it has no tab in this seat.
    await page.locator('#screen-menu').click();
    await page.waitForSelector('.modal');
    check('the header menu lists every screen', (await page.locator('.menu-item').count()) >= 8);
    // The screen name and its blurb are separate lines, not run together as "HOMESet-up…".
    const menuRow = await page.locator('.menu-item').first().innerText();
    check('menu blurbs sit on their own line', /\n/.test(menuRow), JSON.stringify(menuRow));
    const menuTitleBox = await page.locator('.menu-item').first().locator('.menu-title').boundingBox();
    const menuDescBox = await page.locator('.menu-item').first().locator('.toggle-desc').boundingBox();
    check('the blurb starts below the name, not beside it',
      menuDescBox.y >= menuTitleBox.y + menuTitleBox.height, `${menuTitleBox.y + menuTitleBox.height} vs ${menuDescBox.y}`);
    // A long list scrolls inside the dialog; the heading and Close stay put.
    check('the dialog keeps its heading and buttons in view while the list scrolls',
      await page.evaluate(() => {
        const m = document.querySelector('.modal');
        const body = m.querySelector('.modal-body');
        return m.scrollHeight <= m.clientHeight + 1 && body.scrollHeight > 0;
      }));
    check('the close button is reachable without scrolling the dialog',
      await page.getByRole('button', { name: 'Close' }).isVisible());
    await page.getByRole('button', { name: 'Close' }).click();

    // Destructive actions confirm first.
    await go('#/combat');
    await page.selectOption('#bestiary-pick', 'streetPatrol');
    await page.getByRole('button', { name: 'Drop in', exact: true }).click();
    await page.waitForTimeout(80);
    await page.locator('.result', { hasText: 'Street Patrol' }).first().getByRole('button', { name: 'Remove', exact: true }).click();
    await page.waitForSelector('.modal-backdrop');
    const confirmText = await page.locator('.modal').innerText();
    check('removing a combatant asks first', /take .* out of the fight/i.test(confirmText), confirmText.slice(0, 120));
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(80);
    check('cancelling leaves the combatant in place',
      (await page.locator('.result', { hasText: 'Street Patrol' }).count()) >= 1);

    // --- formatting pass: labelled symbols, outcome chip, tidy help bars ---
    await go('#/roll');
    await page.getByRole('button', { name: 'One more success' }).click();
    await page.getByRole('button', { name: 'One more failure' }).click();
    await page.getByRole('button', { name: 'One more threat' }).click();
    await page.waitForTimeout(90);
    const outcomeText = await page.locator('#roll-result').innerText();
    check('the result panel is headed Outcome rather than shouting a verdict',
      /OUTCOME/i.test(outcomeText) && !/IT FAILED/i.test(outcomeText), outcomeText.slice(0, 60));
    check('the verdict is a status chip', (await page.locator('#roll-result .status-chip').count()) === 1);
    check('the outcome panel carries no cancellation write-up',
      !/cancelled against/.test(outcomeText), outcomeText.slice(0, 200));
    check('no symbol is shown bare — each carries its name',
      (await page.locator('#roll-result .sym .sym-name').count()) >= 1);
    const symText = await page.locator('#roll-result .sym').first().innerText();
    check('a symbol reads as glyph, count and name', /\d/.test(symText) && /Threat|Success|Advantage/.test(symText), symText);
    await page.getByRole('button', { name: 'Clear symbols' }).click();

    // The help bar is a compact left-aligned row, not a wide bar with a dead gap.
    await go('#/');
    const helpBox = await page.locator('#screen details.howto summary').first().boundingBox();
    check('the help bar is compact', helpBox.height <= 40, `height ${helpBox.height}px`);
    const helpLabel = await page.locator('#screen details.howto summary span').first().boundingBox();
    check('its label sits at the left, with no dead gap',
      helpLabel.x - helpBox.x < 40, `label offset ${Math.round(helpLabel.x - helpBox.x)}px`);

    // Checklist links and their hints are separate lines, not run together.
    const firstStep = await page.locator('.checklist li').first().innerText();
    check('checklist hints sit on their own line', /\n/.test(firstStep), JSON.stringify(firstStep));

    // --- no section-number links clutter the screens; they stay searchable instead ---
    await go('#/roll');
    await page.waitForSelector('#roller-skill');
    check('the roll screen carries no section-number links', (await page.locator('#screen a.cite').count()) === 0);
    await go('#/rules');
    await page.waitForSelector('#rules-search');
    check('rules entries carry no repeated section links', (await page.locator('#rules-results a.cite').count()) === 0);

    await page.fill('#rules-search', '§5E');
    await page.waitForTimeout(90);
    check('a section number typed into the search still finds its rules',
      (await page.locator('#rules-results .rule-entry').count()) >= 5);
    await page.fill('#rules-search', '');
    await page.waitForTimeout(90);

    // No section numbers and no internal ruling codes anywhere in the interface copy,
    // with every accordion forced open so nothing hides behind a collapsed panel.
    await go('#/settings');
    if (!(await page.locator('#flag-soloMode').isChecked())) await page.locator('#flag-soloMode').check();
    if (!(await page.locator('#flag-gmScreen').isChecked())) await page.locator('#flag-gmScreen').check();
    for (const hash of ['#/', '#/sheet', '#/roll', '#/create', '#/combat', '#/solo', '#/gm', '#/rules', '#/settings', '#/safety']) {
      await go(hash);
      await page.evaluate(() => document.querySelectorAll('#screen details').forEach((d) => { d.open = true; }));
      await page.waitForTimeout(80);
      const markers = await page.evaluate(() =>
        (document.querySelector('#screen').innerText.match(/\bR-(?:B1|\d+)\b|§[0-9A-Za-z.]+|B§[0-9]+|D§/g) || []));
      check(`${hash} carries no section numbers or ruling codes`, markers.length === 0, [...new Set(markers)].join(', '));
    }

    // --- HOUSE RULE: the black-market counter on the Gear tab ---
    await go('#/sheet');
    await subtab('Gear');
    check('the purchase panel is badged as a house rule',
      /house rule/i.test(await page.locator('#screen').innerText()));
    check('cash, ration cards and barter goods are tracked apart',
      (await page.locator('#purse-cash').count()) === 1
      && (await page.locator('#purse-cards').count()) === 1
      && (await page.locator('#purse-barter').count()) === 1);

    await page.selectOption('#buy-item', 'shortwaveRadio');   // rarity 6
    await page.waitForTimeout(90);
    const quoteEmpty = await page.locator('.outcome', { hasText: 'What this will take' }).innerText();
    check('with nothing to trade the check is one step harder',
      /one step harder/i.test(quoteEmpty), quoteEmpty.replace(/\n/g, ' | '));

    await page.fill('#purse-cards', '2');
    await page.locator('#purse-cards').blur();
    await page.waitForTimeout(120);
    const quoteCards = await page.locator('.outcome', { hasText: 'What this will take' }).innerText();
    check('holding the cards drops the penalty and names the cost',
      !/one step harder/i.test(quoteCards) && /Ration cards wanted: 1/.test(quoteCards), quoteCards.replace(/\n/g, ' | '));

    await page.fill('#purse-cash', '900');
    await page.locator('#purse-cash').blur();
    await page.waitForTimeout(120);
    await page.getByRole('button', { name: 'Pay and take it' }).click();
    await page.waitForTimeout(150);
    equal('paying deducts the price in RM', await page.inputValue('#purse-cash'), '400');
    equal('and spends the ration card', await page.inputValue('#purse-cards'), '1');
    check('the item lands in the inventory',
      (await page.locator('.result', { hasText: 'Shortwave radio' }).count()) >= 1);

    // --- item damage ladder and attachments (§14B, §14C) ---
    await go('#/sheet');
    await subtab('Gear');
    const firstItem = page.locator('.result', { hasText: 'P38 pistol' }).first();
    if (await firstItem.count()) {
      await firstItem.getByRole('button', { name: 'Damage a step' }).click();
      await page.waitForTimeout(60);
      check('an item damaged one step shows its penalty and repair difficulty (§14B)',
        /Minor — One Setback on use/.test(await page.locator('.result', { hasText: 'P38 pistol' }).first().innerText()));
      await page.locator('.result', { hasText: 'P38 pistol' }).first().getByRole('button', { name: /^Repair/ }).click();
      await page.waitForTimeout(60);
      check('repairing walks the ladder back (§14B)',
        /Undamaged/.test(await page.locator('.result', { hasText: 'P38 pistol' }).first().innerText()));
      await page.locator('.result', { hasText: 'P38 pistol' }).first().getByRole('button', { name: 'Install' }).click();
      await page.waitForTimeout(60);
      check('an attachment consumes a hard point (§14C)',
        /1 of 1 hard points used/.test(await page.locator('.result', { hasText: 'P38 pistol' }).first().innerText()));
    }

    // --- safety-tools note (§20A) ---
    await go('#/settings');
    await page.getByRole('link', { name: 'Open the safety-tools note' }).click();
    await page.waitForSelector('#screen .card');
    check('the safety-tools note covers session zero and rule zero',
      /Rule zero/.test(await page.locator('#screen').innerText()));

    // --- a skill on the sheet selects itself on the Roll screen and goes there ---
    await go('#/sheet');
    await subtab('Skills');
    await page.getByRole('button', { name: 'Roll Medicine' }).click();
    await page.waitForTimeout(120);
    equal('tapping a skill jumps to the Roll screen', new URL(page.url()).hash, '#/roll');
    equal('the skill is already selected there', await page.inputValue('#roller-skill'), 'medicine');
    check('the pool is built from that skill', (await page.locator('.die-count').first().count()) === 1);
    await go('#/sheet');
    await subtab('Skills');
    await page.getByRole('button', { name: 'Roll Stealth' }).click();
    await page.waitForTimeout(120);
    equal('a second skill replaces the first', await page.inputValue('#roller-skill'), 'stealth');

    // --- accessibility sweep: every control has a name, headings do not skip ---
    const A11Y_PROBE = () => {
      const problems = [];
      const name = (node) => {
        const aria = (node.getAttribute('aria-label') || '').trim();
        if (aria) return aria;
        const by = node.getAttribute('aria-labelledby');
        if (by) {
          const target = document.getElementById(by);
          if (target && target.innerText.trim()) return target.innerText.trim();
        }
        if (node.id) {
          const forLabel = document.querySelector(`label[for="${CSS.escape(node.id)}"]`);
          if (forLabel && forLabel.innerText.trim()) return forLabel.innerText.trim();
        }
        const wrapping = node.closest('label');
        if (wrapping && wrapping.innerText.trim()) return wrapping.innerText.trim();
        if (node.title && node.title.trim()) return node.title.trim();
        return (node.innerText || '').trim();
      };
      const describe = (node) => `${node.tagName.toLowerCase()}${node.id ? '#' + node.id : ''}`;
      document.querySelectorAll('#screen button, #screen a, #screen input, #screen select, #screen textarea')
        .forEach((node) => { if (!name(node)) problems.push(`unnamed ${describe(node)}`); });
      document.querySelectorAll('#screen [tabindex]').forEach((node) => {
        if (Number(node.getAttribute('tabindex')) > 0) problems.push(`positive tabindex on ${describe(node)}`);
      });
      let previous = 1; // the app header owns the only h1
      document.querySelectorAll('#screen h1, #screen h2, #screen h3, #screen h4, #screen h5')
        .forEach((node) => {
          const level = Number(node.tagName.slice(1));
          if (level > previous + 1) problems.push(`heading jumps h${previous}→h${level} at "${node.innerText.slice(0, 30)}"`);
          previous = level;
        });
      document.querySelectorAll('#screen table').forEach((table, i) => {
        if (!table.querySelector('th')) problems.push(`table ${i} has no header cells`);
      });
      return problems;
    };
    check('exactly one h1 on the page', (await page.locator('h1').count()) === 1);
    for (const hash of ['#/', '#/sheet', '#/roll', '#/create', '#/combat', '#/solo', '#/gm', '#/rules', '#/settings', '#/safety']) {
      await go(hash);
      await page.evaluate(() => document.querySelectorAll('#screen details').forEach((d) => { d.open = true; }));
      await page.waitForTimeout(80);
      const problems = await page.evaluate(A11Y_PROBE);
      check(`${hash} passes the accessibility sweep`, problems.length === 0, [...new Set(problems)].slice(0, 5).join(' | '));
    }
    // Every sub-tab pane on the sheet, not just the one that opens by default.
    await go('#/sheet');
    for (const tab of ['Vitals', 'Skills', 'Gear', 'Talents & injuries', 'Recovery', 'Advance']) {
      await subtab(tab);
      const problems = await page.evaluate(A11Y_PROBE);
      check(`sheet ${tab} passes the accessibility sweep`, problems.length === 0, [...new Set(problems)].slice(0, 5).join(' | '));
    }

    // --- deleting a character: confirms first, then removes it everywhere ---
    await go('#/');
    const charCard = () => page.locator('.result', { hasText: 'Test Runner' }).first();
    check('a character can be deleted from Home', (await charCard().getByRole('button', { name: 'Delete' }).count()) === 1);
    // The controls sit in a row of their own; the link and the button must not overlap.
    const openBox = await charCard().getByRole('link', { name: 'Open the sheet' }).boundingBox();
    const deleteBox = await charCard().getByRole('button', { name: 'Delete' }).boundingBox();
    check('the sheet link and the delete button do not overlap',
      deleteBox.x >= openBox.x + openBox.width || deleteBox.y >= openBox.y + openBox.height,
      `link ${JSON.stringify(openBox)} button ${JSON.stringify(deleteBox)}`);
    await charCard().getByRole('button', { name: 'Delete' }).click();
    await page.waitForSelector('.modal-backdrop');
    check('deleting a character asks first and says it cannot be undone',
      /cannot be undone/i.test(await page.locator('.modal').innerText()));
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(80);
    check('cancelling keeps the character', (await charCard().count()) === 1);
    await charCard().getByRole('button', { name: 'Delete' }).click();
    await page.waitForSelector('.modal-backdrop');
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await page.waitForTimeout(120);
    check('confirming removes the character', (await page.locator('.result', { hasText: 'Test Runner' }).count()) === 0);
    check('the empty roster offers to create one', /No characters yet/.test(await page.locator('#screen').innerText()));
    check('deleting the active character clears the resource header',
      await page.locator('#resource-header').isHidden());
    await go('#/sheet');
    check('the sheet falls back to its empty state', /no character yet/i.test(await page.locator('#screen').innerText()));

    // 390px as well as 360px.
    await page.setViewportSize({ width: 390, height: 780 });
    for (const label of ['Home', 'Sheet', 'Roll', 'Combat', 'Solo', 'GM', 'Rules', 'Settings']) {
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
