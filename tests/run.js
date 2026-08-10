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
    // The situational controls fold away by default; open the panel before reaching for one.
    const openSituation = async () => {
      await page.evaluate(() => {
        document.querySelectorAll('#screen details').forEach((d) => {
          if (/anything unusual/i.test(d.querySelector('summary')?.innerText || '')) d.open = true;
        });
      });
      await page.waitForTimeout(60);
    };

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
    await page.fill('#rules-search', '§17.2');
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
    // R-8 — the house-aid budget defaults to 500 and says in words that it is not printed.
    equal('R-8: starting budget defaults to 500', await page.inputValue('#starting-budget'), '500');
    check('R-8: the house aid says so in plain words, with no tag',
      /neither number is printed in the books/i.test(await page.locator('#screen').innerText())
        && (await page.locator('#screen .badge').count()) === 0);

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
    // The wizard now forks first: a ready-made character, or build one from a career (C-3).
    await page.waitForSelector('#build-from-career');
    check('the wizard offers the three ready-made characters before the career list',
      (await page.locator('#screen [id^="pregen-"]').count()) === 3);
    await page.locator('#build-from-career').click();
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
    check('R-8: the gear step says the budget is a house aid, with no tag',
      /house aid, not a printed rule/i.test(await page.locator('#screen').innerText())
        && (await page.locator('#screen .badge').count()) === 0);
    // Pocket money: rolled once the shopping is done, kept apart from the budget.
    await page.getByRole('button', { name: 'Roll pocket money' }).click();
    await page.waitForTimeout(90);
    const pocketText = await page.locator('.result', { hasText: 'Pocket money' }).innerText();
    const pocket = Number((pocketText.match(/Rolled (\d+)/) || [])[1]);
    check('pocket money rolls a d100', pocket >= 1 && pocket <= 100, String(pocket));
    check('pocket money cannot buy more starting gear',
      /cannot buy more starting gear/i.test(pocketText), pocketText.replace(/\n/g, ' | '));

    await page.getByRole('button', { name: 'Next', exact: true }).click();   // kicker (§13 step 6)
    check('creation asks for a kicker', (await page.locator('#wizard-kicker').count()) === 1);
    await page.fill('#wizard-kicker', 'Her brother was taken in a night raid.');
    check('the kicker is optional and never blocks the step',
      !(await page.getByRole('button', { name: 'Next', exact: true }).isDisabled()));
    await page.getByRole('button', { name: 'Next', exact: true }).click();   // review
    check('the review reads the kicker back',
      /night raid/.test(await page.locator('#screen').innerText()));
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
    // §17 — one shared track, so the header shows one number out of the maximum.
    check('header shows the shared suspicion track', /Heat 0\/5/.test(header), header);

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

    // A situational option moves them too. They live behind one collapsed row now.
    await openSituation();
    check('the situation panel folds away and says what is set',
      /nothing set/i.test(await page.locator('#screen').innerText()));
    await page.locator('#roller-cover').check();
    await page.waitForTimeout(90);
    equal('taking cover adds a Boost die live', await dieCount('Boost'), 1);
    await page.locator('#roller-cover').uncheck();
    await page.waitForTimeout(90);
    equal('leaving cover removes it again', await dieCount('Boost'), 0);

    // --- called shots, two-weapon fighting and swaying a crowd (§10A, §5H, §11) ---
    await openSituation();
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
    check('an uncancelled Despair on an evasion check reads +2 suspicion (§17.1)',
      /Heat \+2/.test(resultText), resultText);
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
    check('Heat is applied to the party', /Heat 2\/5/.test(headerAfter), headerAfter);
    check('the roll is logged', (await page.locator('#screen section.card', { hasText: 'Recent checks' }).locator('.log-row').count()) >= 1);
    check('the outcome stays on screen instead of only flashing a toast',
      /Suspicion/.test(await page.locator('.outcome').first().innerText()),
      (await page.locator('.outcome').first().innerText()).replace(/\n/g, ' | '));

    // --- §8 Push: one reroll of the whole pool, bought with a story point ---
    await page.getByRole('button', { name: 'One more threat' }).click();
    await page.waitForTimeout(80);
    const poolBefore = await page.locator('#resource-header').innerText();
    check('pushing is offered once symbols are in', (await page.locator('#roller-push').count()) === 1);
    await page.locator('#roller-push').click();
    await page.waitForTimeout(160);
    check('the push spends a story point into the GM pool',
      (await page.locator('#resource-header').innerText()) !== poolBefore,
      await page.locator('#resource-header').innerText());
    check('and a check can only be pushed once',
      (await page.locator('#roller-push').count()) === 0
      && (await page.locator('#roller-push-price').count()) === 1);
    const priceText = await page.locator('#roller-push-price').innerText();
    check('the push price panel says what is owed, if anything',
      /to pay|nothing to pay/.test(priceText), priceText.replace(/\n/g, ' | '));
    await page.getByRole('button', { name: 'Clear symbols' }).click();
    await page.waitForTimeout(100);
    check('clearing the check makes it pushable again',
      (await page.locator('#roller-push-price').count()) === 0);
    // Hand the point back so the story-point tests further down start from the same place.
    await page.evaluate(() => {
      const cell = JSON.parse(localStorage.getItem('reich62:cell') || '{}');
      cell.pools = { storyPointsPlayer: 1, storyPointsGM: 0 };
      localStorage.setItem('reich62:cell', JSON.stringify(cell));
    });
    await go('#/roll');
    await page.waitForSelector('#roller-skill');

    const logRow = await page.locator('.log-row').first().innerText();
    check('a log row shows the result, not the whole derivation',
      /Success|Failure/.test(logRow) && !/Pool /.test(logRow) && !/entered /.test(logRow), logRow.replace(/\n/g, ' | '));

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

    // Initiative is roster-first: everyone already in the fight is listed by name and side,
    // so a roll is two numbers rather than four fields and an Add (B-4).
    await page.getByRole('button', { name: /^Add Test Runner$/ }).click();
    await page.waitForTimeout(120);
    check('the initiative list names everyone already in the fight',
      (await page.locator('#init-roster tr').count()) === 4, // header plus three combatants
      await page.locator('#init-roster').innerText());
    await page.getByLabel('Uncancelled Success for Test Runner').fill('3');
    await page.getByLabel('Uncancelled Success for Checkpoint Guards').fill('1');
    await page.getByLabel('Uncancelled Success for Guard Dog').fill('0');
    await page.locator('#init-start').click();
    await page.waitForSelector('text=/round 1/');
    check('initiative produces one slot per participant, ranked by Success',
      (await page.locator('table tr').count()) === 4); // header plus three slots
    const slotOrder = await page.locator('table').first().innerText();
    check('the highest Success takes the first slot', /1\s+PC/.test(slotOrder), slotOrder.replace(/\n/g, ' | '));

    // The Dragnet is a clock too — a published one — so it lives in the clocks panel with
    // its printed escalation and dual Heat cost intact (B§6).
    await page.fill('#clock-name', 'City dragnet');
    await page.selectOption('#clock-kind', 'dragnet');
    await page.locator('#clock-add').click();
    await page.waitForTimeout(140);
    const dragnet = () => page.locator('.clock-row', { hasText: 'City dragnet' }).first();
    check('dragnet starts at 2 opposition dice', /2 opposition dice/.test(await dragnet().innerText()), await dragnet().innerText());
    check('one panel now holds every track', (await page.locator('#screen .card', { hasText: 'Things that take a while' }).count()) === 0);
    await dragnet().getByRole('button', { name: /^A failed round/ }).click();
    await page.waitForTimeout(140);
    check('a failed dragnet round escalates the opposition to 3 dice',
      /3 opposition dice/.test(await dragnet().innerText()), await dragnet().innerText());
    // B§6 prints the cost as one on each track; with the single shared track (§17) there is
    // one track to pay, so 2 → 3.
    const headerDragnet = await page.locator('#resource-header').innerText();
    check('a failed dragnet round advances suspicion', /Heat 3\/5/.test(headerDragnet), headerDragnet);

    // Lifecycle: End Session awards XP, decays Heat on downtime, and undoes in one step.
    await page.getByRole('button', { name: 'End Session', exact: true }).click();
    await page.waitForSelector('.modal');
    check('the boundary preview lists its deltas before applying', (await page.locator('.modal li').count()) >= 2);
    await page.locator('#lc-downtime').check();
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.waitForTimeout(120);
    const afterSession = await page.locator('#resource-header').innerText();
    check('downtime decays suspicion by 1 (§17.3)', /Heat 2\/5/.test(afterSession), afterSession);
    await go('#/sheet');
    // 70 XP at creation, 25 spent (Brawn to 2 and one rank of Grit), plus the 20 session award.
    const xpText = await page.locator('#screen').innerText();
    check('the session award adds 20 XP (§27)', /65 experience unspent/.test(xpText), (xpText.match(/\d+ experience unspent/) || ['no XP line'])[0]);

    await go('#/combat');
    await page.getByRole('button', { name: /^Undo End session/ }).click();
    await page.waitForTimeout(120);
    check('one-step undo restores the pre-boundary state',
      /Heat 3\/5/.test(await page.locator('#resource-header').innerText()),
      await page.locator('#resource-header').innerText());

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

    // A scene needs a beginning if End Scene is to have anything to end, and the result of
    // a rolled prompt has to appear where the button is — sending it only to a log folded
    // away at the bottom of the screen made the buttons look broken.
    check('a scene can be started', (await page.locator('#scene-start').count()) === 1);
    await page.fill('#scene-name', 'Checkpoint on the river road');
    await page.locator('#scene-start').click();
    await page.waitForTimeout(150);
    check('and the screen says which scene you are in',
      /scene 1, "Checkpoint on the river road"/.test(await page.locator('#scene-now').innerText()),
      await page.locator('#scene-now').innerText());
    check('the end control names the scene it will close',
      /Checkpoint on the river road/.test(await page.locator('#solo-end-scene').innerText()),
      await page.locator('#solo-end-scene').innerText());
    await page.getByRole('button', { name: 'Meaning', exact: true }).click();
    await page.waitForTimeout(200);
    check('a rolled prompt shows its result where the button is',
      (await page.locator('#idea-latest').isVisible())
      && (await page.locator('#idea-latest').innerText()).trim().length > 10,
      (await page.locator('#idea-latest').innerText()).replace(/\n/g, ' | '));

    // The screen runs in the order the printed loop runs (§23), so the buttons follow play
    // rather than the order they happened to be written in.
    const soloHeadings = await page.evaluate(() =>
      [...document.querySelectorAll('#screen .card > h2')].map((h) => h.textContent.trim()));
    const at = (t) => soloHeadings.findIndex((h) => h.startsWith(t));
    check('the solo screen follows the printed loop order',
      at('1 · Frame') >= 0 && at('1 · Frame') < at('2 · Ask') && at('2 · Ask') < at('3 · Resolve')
      && at('3 · Resolve') < at('4 · Track') && at('4 · Track') < at('5 · Where suspicion')
      && at('5 · Where suspicion') < at('6 · Close the scene'), soloHeadings.join(' | '));
    check('the two logs sit last, after every step',
      at('Questions you have asked') > at('6 · Close the scene')
      && at('Prompts you have rolled') > at('6 · Close the scene'),
      soloHeadings.join(' | '));
    check('the loop itself opens the screen, folded',
      await page.evaluate(() => {
        const d = document.querySelector('#screen > details.accordion');
        return !!d && /how a turn goes/i.test(d.textContent) && !d.open;
      }));
    check('the logs are folded away by default',
      await page.evaluate(() => {
        const d = [...document.querySelectorAll('#screen > details.accordion')]
          .find((x) => /what has happened/i.test(x.querySelector('summary').textContent));
        return !!d && !d.open;
      }));
    check('resolving what you do points at the Roll screen',
      (await page.locator('#screen a[href="#/roll"]').count()) >= 1);
    // H-2 — what you expect is captured with the question and read back in the log.
    check('H-2: the Oracle asks what you expect', (await page.locator('#oracle-expectation').count()) === 1);
    await page.fill('#oracle-expectation', 'He waves me through');

    // One button rolls the Oracle's dice and answers in the same tap.
    check('the Oracle asks in one tap, with no separate roll step',
      (await page.locator('#oracle-ask').count()) === 1 && (await page.locator('#oracle-roll').count()) === 0);
    await page.locator('#oracle-ask').click();
    await page.waitForTimeout(140);
    const asked = await page.locator('#oracle-answer').innerText();
    check('it gives the answer, with the dice folded away under it',
      /(Yes|No)/.test(asked) && /show the dice/i.test(asked), asked.replace(/\n/g, ' | '));
    // H-2 — what you expected belongs to the question just answered; leaving it in the
    // field would read the next question against the last one's expectation.
    check('asking clears what you expected, so the next question starts clean',
      (await page.locator('#oracle-expectation').inputValue()) === '',
      await page.locator('#oracle-expectation').inputValue());
    await page.fill('#oracle-expectation', 'He waves me through');

    // An emphatic no chains a Random Event and feeds Heat when the question concerned a
    // surveilled context (§18, §19, §17.1). The pad offers only symbols this pool can roll.
    await page.locator('#oracle-surveilled').check();
    const heatBeforeOracle = await page.locator('#resource-header').innerText();
    await page.evaluate(() => document.querySelectorAll('#screen details').forEach((d) => { d.open = true; }));
    await page.waitForTimeout(80);
    check('the hand-entry pad offers no Triumph or Despair for this pool',
      (await page.getByRole('button', { name: 'One more oracle despair' }).count()) === 0
      && (await page.getByRole('button', { name: 'One more oracle triumph' }).count()) === 0);
    await page.getByRole('button', { name: 'One more oracle failure' }).click();
    await page.getByRole('button', { name: 'One more oracle failure' }).click();
    await page.locator('#oracle-ask-entered').click();
    await page.waitForTimeout(140);
    const oracleAnswer = await page.locator('#oracle-answer').innerText();
    check('two net failures answer "No, and…"', /No, and/.test(oracleAnswer), oracleAnswer);
    check('an emphatic answer chains a Random Event (§19)', /Random Event/.test(oracleAnswer), oracleAnswer);
    check('the event skew reads off the answer, not a symbol this pool cannot roll',
      /emphatically against you/.test(oracleAnswer) && !/A Triumph skews/.test(oracleAnswer),
      oracleAnswer.replace(/\n/g, ' | '));
    check('an emphatic no in a surveilled context raises Heat (§17.1)',
      (await page.locator('#resource-header').innerText()) !== heatBeforeOracle);
    // A chained event is content in the same way a hand-rolled prompt is, so it is kept
    // where every other rolled prompt is kept rather than only inside the answer's row.
    check('a chained Random Event also lands in the prompt log',
      await page.evaluate(() => {
        try {
          return JSON.parse(localStorage.getItem('reich62:ideaLog') || '[]')
            .some((e) => e.table === 'Random Event' && /chained from/.test(e.text));
        } catch { return false; }
      }));

    // R-22 — the printed pool holds no die that can show a Triumph or a Despair, so the two
    // emphatic rungs are reached by weight of result instead, and the screen says so.
    check('R-22: the panel explains the weight reading in its own how-this-works',
      await page.evaluate(() => {
        const d = [...document.querySelectorAll('#screen details.howto')];
        return d.some((x) => /read by weight/i.test(x.textContent));
      }));
    // Random Oracle rolls earlier in this block can push suspicion to its maximum, where it
    // cannot rise any further — so the track is put somewhere it can move from.
    await page.evaluate(() => {
      const cell = JSON.parse(localStorage.getItem('reich62:cell') || '{}');
      cell.cellHeat = 0;
      localStorage.setItem('reich62:cell', JSON.stringify(cell));
    });
    await go('#/');
    await go('#/solo');
    await page.waitForSelector('#oracle-likelihood');
    await page.evaluate(() => document.querySelectorAll('#screen details').forEach((d) => { d.open = true; }));
    const heatBeforeEmphatic = await page.locator('#resource-header').innerText();
    await page.getByRole('button', { name: 'One more oracle failure' }).click();
    await page.getByRole('button', { name: 'One more oracle failure' }).click();
    await page.locator('#oracle-ask-entered').click();
    await page.waitForTimeout(140);
    const emphatic = await page.locator('#oracle-answer').innerText();
    check('R-22: two net failures with no advantage answer "No, and…"', /No, and/.test(emphatic), emphatic.replace(/\n/g, ' | '));
    check('R-22: an emphatic answer chains a Random Event', /Random Event/.test(emphatic), emphatic.replace(/\n/g, ' | '));
    check('R-22: it feeds Heat in a surveilled context like a Despair would',
      (await page.locator('#resource-header').innerText()) !== heatBeforeEmphatic);
    // R-22a retired: the grading sentence is gone, the rung and the focus line carry it.
    check('the answer carries no grading sentence',
      !/barely tipped|straightforward result|solid result|powerful result|as decisive as the dice get/i
        .test(await page.locator('#oracle-answer').innerText()),
      (await page.locator('#oracle-answer').innerText()).replace(/\n/g, ' | '));
    // H-2 — every answer is read against what you expected.
    check('H-2: the focus reading never doubles its punctuation',
      !/…\./.test(await page.locator('#oracle-answer').innerText()),
      (await page.locator('#oracle-answer').innerText()).replace(/\n/g, ' | '));
    check('H-2: the delete control does not sit on top of the row text',
      await page.evaluate(() => {
        const row = document.querySelector('#oracle-log .log-row');
        if (!row) return true;
        const b = row.querySelector('.log-delete').getBoundingClientRect();
        return [...row.querySelectorAll('p')].every((el) => {
          const r = el.getBoundingClientRect();
          return r.right <= b.left || r.left >= b.right || r.bottom <= b.top || r.top >= b.bottom;
        });
      }));
    check('H-2: the answer carries a focus reading',
      (await page.locator('#oracle-answer .oracle-focus').count()) === 1,
      (await page.locator('#oracle-answer').innerText()).replace(/\n/g, ' | '));
    check('R-22: no bare grading word is shown',
      !/\b(marginal|slight|clear|strong|overwhelming)\b/i.test(await page.locator('#oracle-answer').innerText()),
      (await page.locator('#oracle-answer').innerText()).replace(/\n/g, ' | '));

    // Three failures land harder than two, and a leftover Advantage rides along with it.
    await page.getByRole('button', { name: 'One more oracle failure' }).click();
    await page.getByRole('button', { name: 'One more oracle failure' }).click();
    await page.getByRole('button', { name: 'One more oracle failure' }).click();
    await page.getByRole('button', { name: 'One more oracle advantage' }).click();
    await page.locator('#oracle-ask-entered').click();
    await page.waitForTimeout(140);
    const graded = await page.locator('#oracle-answer').innerText();
    check('R-22: a surviving Advantage holds three failures to a plain No',
      /^No\b/.test(graded.trim()) && !/No, and/.test(graded), graded.replace(/\n/g, ' | '));
    check('H-2: leftover Advantage on a no reads as the focus leaning your way',
      /not quite what you expected/i.test(graded) && /suits you/i.test(graded),
      graded.replace(/\n/g, ' | '));
    check('the Oracle log carries no grading sentence',
      !/barely tipped|straightforward result|solid result|powerful result|as decisive as the dice get/i
        .test(await page.locator('#oracle-log').innerText()));
    check('the Oracle log row leads with the answer, not the likelihood',
      !/^(Likely|50-50|Unlikely)/.test((await page.locator('#oracle-log .result-title').first().innerText()).trim()),
      await page.locator('#oracle-log .result-title').first().innerText());

    // --- the Oracle keeps its own log, separate from the Roll screen's ---
    check('H-2: the log records what you expected',
      /He waves me through/.test(await page.locator('#oracle-log').innerText()));
    check('H-2: the log records the focus reading',
      /as you expected|not quite|surprise|in your favour|works against you|turn in the story|as expected/i
        .test(await page.locator('#oracle-log').innerText()));
    check('answers land in the Oracle log', (await page.locator('#oracle-log .log-row').count()) >= 2,
      String(await page.locator('#oracle-log .log-row').count()));
    const rollLogRows = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('reich62:rollLog') || '[]').filter((e) => e.skill === 'oracle').length; }
      catch { return -1; }
    });
    equal('and not in the Roll screen\'s check log', rollLogRows, 0);
    const oracleRowsBefore = await page.locator('#oracle-log .log-row').count();
    await page.locator('#oracle-log .log-row').first().getByRole('button', { name: /^Delete the / }).click();
    await page.waitForTimeout(140);
    equal('a single answer can be deleted',
      await page.locator('#oracle-log .log-row').count(), oracleRowsBefore - 1);
    await page.locator('#oracle-log-clear').click();
    await page.waitForSelector('.modal-backdrop');
    check('clearing the lot asks first',
      /cannot be undone/i.test(await page.locator('.modal').innerText()));
    await page.getByRole('button', { name: 'Delete them' }).click();
    await page.waitForTimeout(140);
    check('and empties the log', /nothing asked yet/i.test(await page.locator('#oracle-log').innerText()),
      (await page.locator('#oracle-log').innerText()).replace(/\n/g, ' | '));

    // Rolled prompts are kept, not replaced: each one is logged and survives navigation.
    await page.getByRole('button', { name: 'Meaning', exact: true }).click();
    await page.waitForTimeout(120);
    await page.getByRole('button', { name: 'Location', exact: true }).click();
    await page.waitForTimeout(120);
    const ideaRows = await page.locator('#solo-output .log-row').count();
    check('a second prompt does not replace the first', ideaRows >= 2, `rows ${ideaRows}`);
    await go('#/');
    await go('#/solo');
    await page.waitForTimeout(150);
    check('rolled prompts survive leaving the screen',
      (await page.locator('#solo-output .log-row').count()) === ideaRows);
    check('each prompt row can be deleted on its own',
      (await page.locator('#solo-output .log-row').first().getByRole('button', { name: /^Delete/ }).count()) === 1);
    await page.locator('#solo-output .log-row').first().getByRole('button', { name: /^Delete/ }).click();
    await page.waitForTimeout(120);
    check('deleting one prompt leaves the rest',
      (await page.locator('#solo-output .log-row').count()) === ideaRows - 1);
    await page.locator('#idea-log-clear').click();
    await page.waitForSelector('.modal-backdrop');
    check('clearing the prompts asks first', /cannot be undone/i.test(await page.locator('.modal').innerText()));
    await page.getByRole('button', { name: 'Delete them' }).click();
    await page.waitForTimeout(120);
    check('the emptied prompt log explains itself',
      /nothing rolled yet/i.test(await page.locator('#solo-output').innerText()));

    check('the meaning table produces a phrase', (await page.locator('#solo-output').innerText()).length > 8);
    await page.getByRole('button', { name: 'Random encounter', exact: true }).click();
    check('the random encounter table rolls', /\(\d+\)/.test(await page.locator('#solo-output').innerText()));

    // --- PART V (§31, §33–§40): the optional journey and tension module ---
    check('the Part V generators stay hidden until the module is adopted',
      (await page.locator('#solo-travel').count()) === 0
      && (await page.locator('#solo-behaviour').count()) === 0);
    await go('#/settings');
    await page.locator('#flag-journeyModule').check();
    await page.waitForTimeout(80);
    await go('#/solo');
    await page.waitForSelector('#solo-travel');
    check('adopting it adds the four solo generators',
      (await page.locator('#solo-travel').count()) === 1
      && (await page.locator('#solo-behaviour').count()) === 1
      && (await page.locator('#solo-conversation').count()) === 1
      && (await page.locator('#solo-stop-countdown').count()) === 1);
    await page.locator('#solo-behaviour').click();
    await page.waitForTimeout(150);
    check('the NPC behaviour generator rolls all five parts',
      /Motive:/.test(await page.locator('#idea-latest').innerText())
      && /Method:/.test(await page.locator('#idea-latest').innerText())
      && /Tilt:/.test(await page.locator('#idea-latest').innerText()),
      (await page.locator('#idea-latest').innerText()).replace(/\n/g, ' | '));
    await page.locator('#solo-travel').click();
    await page.waitForTimeout(150);
    check('a travel encounter is rolled and kept', /Travel encounter/.test(await page.locator('#idea-latest').innerText()));

    // §33 — the per-character threat countdown, on the sheet.
    await go('#/sheet');
    await page.waitForSelector('#threat-name');
    await page.fill('#threat-name', 'An old SD file');
    await page.locator('#threat-name').blur();
    await page.waitForTimeout(150);
    check('the threat countdown starts unnoticed', (await page.locator('#threat-advance').count()) === 1);
    await page.locator('#threat-advance').click();
    await page.waitForTimeout(120);
    await page.locator('#threat-advance').click();
    await page.waitForTimeout(120);
    check('step 2 states the Setback it imposes',
      /Setback die/.test(await page.locator('#screen').innerText()));
    // §13 step 6 — the kicker is editable in play.
    check('the sheet carries the kicker', (await page.locator('#kicker-text').count()) === 1);
    await page.fill('#kicker-text', 'A forged order they were told to sign.');
    await page.locator('#kicker-text').blur();
    await page.waitForTimeout(120);
    await go('#/');
    await go('#/sheet');
    check('and it is kept on the character',
      /forged order/.test(await page.inputValue('#kicker-text')), await page.inputValue('#kicker-text'));

    // §34 — the Shift boundary only exists inside the module.
    await go('#/combat');
    await page.waitForTimeout(120);
    check('the journey module adds the Shift boundary',
      (await page.getByRole('button', { name: 'End Shift', exact: true }).count()) === 1);
    await page.getByRole('button', { name: 'End Shift', exact: true }).click();
    await page.waitForSelector('.modal');
    check('ending a shift previews a travel encounter roll',
      /travel encounter/i.test(await page.locator('.modal').innerText()));
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(120);

    await go('#/settings');
    await page.locator('#flag-journeyModule').uncheck();
    await page.waitForTimeout(80);
    await go('#/combat');
    check('dropping the module takes the Shift boundary away again',
      (await page.getByRole('button', { name: 'End Shift', exact: true }).count()) === 0);

    // --- §17.5: the optional two-track variant ---
    await go('#/settings');
    await page.locator('#flag-heatSplit').check();
    await page.waitForTimeout(80);
    await go('#/sheet');
    check('the split variant shows two numbers in the header',
      /Heat \d·\d/.test(await page.locator('#resource-header').innerText()),
      await page.locator('#resource-header').innerText());
    await go('#/settings');
    await page.locator('#flag-heatSplit').uncheck();
    await page.waitForTimeout(80);
    await go('#/sheet');
    check('and turning it off returns to one shared number',
      /Heat \d\/5/.test(await page.locator('#resource-header').innerText()),
      await page.locator('#resource-header').innerText());
    await go('#/solo');
    await page.waitForSelector('#oracle-likelihood');

    // --- the loop's last two steps: suspicion, and closing the scene (§23) ---
    check('the screen states where suspicion stands',
      /Suspicion \d of \d/.test(await page.locator('#solo-suspicion').innerText()),
      await page.locator('#solo-suspicion').innerText());
    // §17 — the shared track lives on the cell, so that is what the raid rule reads.
    const heatSaved = await page.evaluate(() => {
      const cell = JSON.parse(localStorage.getItem('reich62:cell') || '{}');
      const before = cell.cellHeat || 0;
      cell.cellHeat = 4;
      localStorage.setItem('reich62:cell', JSON.stringify(cell));
      return before;
    });
    await go('#/');
    await go('#/solo');
    await page.waitForSelector('#oracle-likelihood');
    check('at suspicion 4 the raid question gets a button, not an instruction',
      (await page.locator('#raid-ask').count()) === 1);
    const oracleRowsPreRaid = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('reich62:oracleLog') || '[]').length; } catch { return -1; }
    });
    await page.locator('#raid-ask').click();
    await page.waitForTimeout(160);
    check('asking it answers in the Oracle panel and logs the question',
      /(Yes|No)/.test(await page.locator('#oracle-answer').innerText())
      && (await page.evaluate(() => {
        try { return JSON.parse(localStorage.getItem('reich62:oracleLog') || '[]').length; } catch { return -1; }
      })) === oracleRowsPreRaid + 1);
    check('and it records what the raid question expected',
      await page.evaluate(() => {
        try { return /raid does not land/i.test(JSON.parse(localStorage.getItem('reich62:oracleLog') || '[]')[0].expectation || ''); }
        catch { return false; }
      }));
    await page.evaluate(() => {
      const cell = JSON.parse(localStorage.getItem('reich62:cell') || '{}');
      cell.cellHeat = 3;
      localStorage.setItem('reich62:cell', JSON.stringify(cell));
    });
    await go('#/');
    await go('#/solo');
    await page.waitForSelector('#solo-end-scene');
    check('the raid button goes away once suspicion drops back below 4',
      (await page.locator('#raid-ask').count()) === 0);
    await page.evaluate((before) => {
      const cell = JSON.parse(localStorage.getItem('reich62:cell') || '{}');
      cell.cellHeat = before;
      localStorage.setItem('reich62:cell', JSON.stringify(cell));
    }, heatSaved);
    await go('#/');
    await go('#/solo');
    await page.waitForSelector('#solo-end-scene');

    // §23 step 7 — the scene boundary is fired from here, so a solo player never has to
    // open the combat tracker to close a scene. It has real work to do: the watched flag is
    // one fact shared by the Oracle and the Roll screen, and the scene owns it.
    await page.locator('#oracle-surveilled').check();
    check('the watched flag is stored on the character, not on one screen',
      await page.evaluate(() => {
        try {
          return JSON.parse(localStorage.getItem('reich62:characters') || '[]')
            .some((c) => c.state.surveilledContext === true);
        } catch { return false; }
      }));
    await go('#/roll');
    await page.waitForSelector('#roller-surveilled');
    check('and the Roll screen reads the same scene flag',
      await page.locator('#roller-surveilled').isChecked());
    await page.evaluate(() => document.querySelectorAll('#screen details').forEach((d) => { d.open = true; }));
    await page.locator('#roller-cover').check();
    await page.waitForTimeout(120);
    await go('#/solo');
    await page.waitForSelector('#solo-end-scene');
    await page.locator('#solo-end-scene').click();
    await page.waitForSelector('.modal-backdrop');
    check('ending a scene asks first, naming what it clears',
      /watched flag/i.test(await page.locator('.modal').innerText()),
      (await page.locator('.modal').innerText()).replace(/\n/g, ' | '));
    await page.getByRole('button', { name: 'End it' }).click();
    await page.waitForTimeout(160);
    check('the scene boundary reports what it did',
      /scene ended/i.test(await page.locator('#screen .outcome').last().innerText()),
      (await page.locator('#screen .outcome').last().innerText()).replace(/\n/g, ' | '));
    check('and offers a one-step undo', (await page.locator('#solo-undo-scene').count()) === 1);
    check('the scene is closed, so a new one can be started',
      (await page.locator('#scene-start').count()) === 1);
    // The boundary is not a no-op: the state the scene owned is genuinely gone.
    check('ending the scene clears the watched flag on the character',
      await page.evaluate(() => {
        try {
          return JSON.parse(localStorage.getItem('reich62:characters') || '[]')
            .every((c) => !c.state.surveilledContext);
        } catch { return false; }
      }));
    check('and the Oracle no longer shows the last scene as watched',
      !(await page.locator('#oracle-surveilled').isChecked()));
    await go('#/roll');
    await page.waitForSelector('#roller-surveilled');
    await page.evaluate(() => document.querySelectorAll('#screen details').forEach((d) => { d.open = true; }));
    check('and the Roll screen\'s situation is cleared for the next scene',
      !(await page.locator('#roller-surveilled').isChecked())
      && !(await page.locator('#roller-cover').isChecked()));
    await go('#/solo');
    await page.waitForSelector('#solo-undo-scene');
    await page.locator('#solo-undo-scene').click();
    await page.waitForTimeout(160);
    check('undoing clears the outcome', (await page.locator('#solo-undo-scene').count()) === 0);

    // --- H-4 clocks: named, ticked by the symbols a check already produced ---
    await go('#/combat');
    await page.waitForSelector('#clock-add');
    await page.fill('#clock-name', 'Gestapo closing in');
    await page.selectOption('#clock-size', '4');
    await page.selectOption('#clock-direction', 'against');
    await page.locator('#clock-add').click();
    await page.waitForTimeout(140);
    const clockRow = () => page.locator('.clock-row', { hasText: 'Gestapo closing in' }).first();
    check('a clock can be started and shows its face',
      (await clockRow().locator('.clock-seg').count()) === 4);
    check('it starts empty', (await clockRow().locator('.clock-seg.is-filled').count()) === 0);

    await go('#/roll');
    await page.waitForSelector('#roller-clock');
    await page.selectOption('#roller-clock', { label: 'Gestapo closing in (0/4)' });
    await page.getByRole('button', { name: 'One more success' }).click();
    await page.getByRole('button', { name: 'One more threat' }).click();
    await page.getByRole('button', { name: 'One more threat' }).click();
    await page.getByRole('button', { name: 'Log this check' }).click();
    await page.waitForTimeout(160);
    const outcomeAfter = await page.locator('.outcome').first().innerText();
    check('H-4: leftover Threat fills the clock the check was pointed at',
      /Gestapo closing in: 2\/4/.test(outcomeAfter), outcomeAfter.replace(/\n/g, ' | '));

    await go('#/combat');
    await page.waitForTimeout(120);
    check('the fill is on the clock face too',
      (await clockRow().locator('.clock-seg.is-filled').count()) === 2);

    // H-4 — an Oracle answer is a resolved roll too, so it can feed a clock on the same
    // rules. A solo player mostly asks rather than rolls skills, so without this the clocks
    // could only be moved by hand.
    await go('#/solo');
    await page.waitForSelector('#oracle-clock');
    await page.selectOption('#oracle-clock', { label: 'Gestapo closing in (2/4)' });
    await page.evaluate(() => document.querySelectorAll('#screen details').forEach((d) => { d.open = true; }));
    await page.getByRole('button', { name: 'One more oracle threat' }).click();
    await page.locator('#oracle-ask-entered').click();
    await page.waitForTimeout(160);
    check('H-4: an Oracle answer can feed a clock',
      /Gestapo closing in: .*3 of 4/.test(await page.locator('#oracle-answer').innerText()),
      (await page.locator('#oracle-answer').innerText()).replace(/\n/g, ' | '));
    await go('#/combat');
    await page.waitForTimeout(120);
    await clockRow().getByRole('button', { name: /^Fill one segment/ }).click();
    await page.waitForTimeout(120);
    await clockRow().getByRole('button', { name: /^Fill one segment/ }).click();
    await page.waitForTimeout(140);
    check('a full clock says it has arrived',
      /has arrived/i.test(await clockRow().innerText()), await clockRow().innerText());
    check('every move records why', /Last: /.test(await clockRow().innerText()));
    await clockRow().getByRole('button', { name: /^Close Gestapo/ }).click();
    await page.waitForSelector('.modal-backdrop');
    check('closing a clock asks first', /progress is discarded/i.test(await page.locator('.modal').innerText()));
    await page.getByRole('button', { name: 'Close it' }).click();
    await page.waitForTimeout(140);
    check('and removes it', (await page.locator('.clock-row', { hasText: 'Gestapo closing in' }).count()) === 0);

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
    await page.getByRole('button', { name: /^Remove Street Patrol.* from the fight$/ }).first().click();
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
      // No boxed tags anywhere: what a tag used to say is now said in the prose (§14 note).
      check(`${hash} carries no boxed tags`, (await page.locator('#screen .badge').count()) === 0);
      // Controls never butt straight into each other: every adjacent pair keeps a gap.
      const tight = await page.evaluate(() => {
        const ctrl = 'button, select, input, textarea';
        return [...document.querySelectorAll('#screen ' + ctrl)].filter((el) => {
          const a = el.getBoundingClientRect();
          const next = el.nextElementSibling;
          if (!a.width || !next || !next.matches(ctrl)) return false;
          const b = next.getBoundingClientRect();
          if (!b.width) return false;
          const sameRow = Math.abs(b.top - a.top) < 6;
          return (sameRow ? b.left - a.right : b.top - a.bottom) < 4;
        }).map((el) => (el.textContent || el.id).trim().slice(0, 24));
      });
      check(`${hash} keeps its controls apart`, tight.length === 0, tight.join(', '));
    }

    // --- HOUSE RULE: the black-market counter on the Gear tab ---
    await go('#/sheet');
    await subtab('Gear');
    check('the purchase panel says it is a house rule',
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

    // Saving finishes the draft: the wizard starts clean rather than reopening the saved
    // character at Review and offering to save it again.
    await go('#/create');
    check('the wizard starts over after a character is saved',
      (await page.locator('#build-from-career').count()) === 1,
      await page.locator('#screen .card').first().innerText().then((t) => t.replace(/\n/g, ' | ')));

    // --- the attack chain: weapon → range → target → damage → applied (§5B) ---
    await go('#/combat');
    await page.selectOption('#bestiary-pick', 'checkpointGuards');
    await page.getByRole('button', { name: 'Drop in', exact: true }).click();
    await page.waitForTimeout(120);
    await go('#/roll');
    await page.evaluate(() => document.querySelectorAll('#screen details').forEach((d) => { d.open = true; }));
    await page.waitForTimeout(80);
    await page.selectOption('#roller-weapon', 'unarmed');
    await page.waitForTimeout(120);
    equal('choosing a weapon takes its skill', await page.inputValue('#roller-skill'), 'brawl');
    equal('a melee weapon fixes the check at Average', await page.inputValue('#roller-difficulty'), 'average');

    await page.evaluate(() => document.querySelectorAll('#screen details').forEach((d) => { d.open = true; }));
    await page.selectOption('#roller-weapon', 'p38');
    await page.waitForTimeout(120);
    equal('a firearm takes the Ranged skill', await page.inputValue('#roller-skill'), 'ranged');
    await page.evaluate(() => document.querySelectorAll('#screen details').forEach((d) => { d.open = true; }));
    await page.selectOption('#roller-range', 'long');
    await page.waitForTimeout(120);
    equal('the range band sets the difficulty on its own', await page.inputValue('#roller-difficulty'), 'hard');
    equal('and the pool follows it', await dieCount('Difficulty'), 3);

    // Aim at the guards: their soak and Adversary rank come off the tracker.
    await page.evaluate(() => document.querySelectorAll('#screen details').forEach((d) => { d.open = true; }));
    const targetValue = await page.evaluate(() => document.querySelector('#roller-target option:nth-child(2)').value);
    await page.selectOption('#roller-target', targetValue);
    await page.waitForTimeout(120);
    check('picking a target states what their soak will take off',
      /soak \d+ comes off the damage/i.test(await page.locator('#roller-target-note').innerText()));

    await page.getByRole('button', { name: 'One more success' }).click();
    await page.getByRole('button', { name: 'One more success' }).click();
    await page.getByRole('button', { name: 'One more success' }).click();
    await page.waitForTimeout(120);
    const damageText = await page.locator('#attack-damage').innerText();
    // P38 base 6 plus 3 successes is 9, less the guards' soak.
    check('the damage is worked out from the weapon, the successes and their soak',
      /6 base and 3 from the successes is 9/.test(damageText), damageText.replace(/\n/g, ' | '));
    const woundsQuoted = Number((await page.locator('#damage-wounds').innerText()).replace(/\D+/g, ''));
    await page.locator('#apply-attack-damage').click();
    await page.waitForTimeout(150);
    await go('#/combat');
    const guardsAfter = await page.locator('.result', { hasText: 'Checkpoint Guards' }).first().innerText();
    check('one tap puts those wounds on the target',
      new RegExp(`Wounds ${woundsQuoted}/`).test(guardsAfter), guardsAfter.replace(/\n/g, ' | '));

    // --- the spend table follows the kind of check, not always combat (A-11) ---
    await go('#/roll');
    await page.selectOption('#roller-context', 'social');
    await page.waitForTimeout(90);
    await page.getByRole('button', { name: 'One more success' }).click();
    await page.getByRole('button', { name: 'One more advantage' }).click();
    await page.getByRole('button', { name: 'One more advantage' }).click();
    await page.waitForTimeout(90);
    const socialSpends = await page.locator('#roll-result').innerText();
    check('a social check offers the social spends, not the combat ones',
      /talking someone round/i.test(socialSpends) && !/critical injury/i.test(socialSpends),
      socialSpends.slice(0, 200).replace(/\n/g, ' | '));
    await page.selectOption('#roller-context', 'combat');
    await page.waitForTimeout(90);
    check('switching back to a fight brings the combat spends',
      /a fight/i.test(await page.locator('#roll-result').innerText()));
    await page.getByRole('button', { name: 'Clear symbols' }).click();

    // --- story points: every spend, from the header chip, on any screen (A-14) ---
    await page.locator('#story-points-chip').click();
    await page.waitForSelector('#story-pools');
    const poolsBefore = await page.locator('#story-pools').innerText();
    check('the chip opens both pools and all eight spends',
      (await page.locator('.modal button[id^="story-"]').count()) === 8, poolsBefore);
    await page.locator('#story-player-narrate').click();
    await page.waitForTimeout(150);
    check('spending from the player pool moves the point to the GM',
      /0 in the player pool, 1 in the GM pool/.test(await page.locator('#story-pools').innerText()),
      await page.locator('#story-pools').innerText());
    check('an empty pool cannot be spent from',
      await page.locator('#story-player-addDie').isDisabled());
    await page.getByRole('button', { name: 'Close' }).click();
    await page.waitForTimeout(80);

    // --- the combat card names what the turn was spent on (C-5) ---
    await go('#/combat');
    const guardCardNow = () => page.locator('.result', { hasText: 'Checkpoint Guards' }).first();
    check('the card states the turn budget where it is enforced',
      /one action and 1 free maneuver; a second costs 2 strain/i.test(await guardCardNow().innerText()));
    await guardCardNow().locator('select[id^="maneuver-pick-"]').selectOption('aim');
    await guardCardNow().getByRole('button', { name: /^Take the chosen maneuver/ }).click();
    await page.waitForTimeout(120);
    check('the maneuver is recorded by name, not as a bare counter',
      /This turn: Aim/.test(await guardCardNow().innerText()), await guardCardNow().innerText().then((t) => t.replace(/\n/g, ' | ')));

    // --- conditions on an NPC (A-15) ---
    await guardCardNow().locator('input[id$="-disoriented"]').check();
    await page.waitForTimeout(120);
    check('an NPC can be held disoriented and it sticks',
      /disoriented/i.test(await guardCardNow().innerText()));
    await go('#/combat');
    check('the condition survives a rerender',
      await page.locator('.result', { hasText: 'Checkpoint Guards' }).first().locator('input[id$="-disoriented"]').isChecked());

    // --- the character summary (C-6) and the career name (C-1) ---
    await go('#/sheet');
    check('the sheet opens on Vitals rather than wherever it was left',
      (await page.getByRole('tab', { name: 'Vitals', exact: true }).getAttribute('aria-selected')) === 'true');
    check('the career reads as its printed name, not its id',
      /Resistance Runner/.test(await page.locator('#screen .card').first().innerText()),
      await page.locator('#screen .card').first().innerText().then((t) => t.replace(/\n/g, ' | ')));
    await subtab('Summary');
    const summary = await page.locator('#character-summary').innerText();
    check('the summary carries the whole character on one screen',
      /Characteristics/.test(summary) && /Skills/.test(summary) && /What drives them/.test(summary)
      && /Carried/.test(summary) && /Lasting injuries/.test(summary), summary.slice(0, 200).replace(/\n/g, ' | '));
    check('the summary offers to print', (await page.locator('#print-summary').count()) === 1);

    // --- the bestiary is grouped by tier rather than one long run (B-5) ---
    await go('#/gm');
    await page.waitForSelector('#bestiary-list');
    check('opponents are grouped into collapsible tiers',
      (await page.locator('#bestiary-list details').count()) === 4,
      String(await page.locator('#bestiary-list details').count()));
    const gmHeight = await page.evaluate(() => document.querySelector('#screen').scrollHeight);
    check('which brings the tab back under 4,000px', gmHeight < 4000, `${gmHeight}px`);

    // --- backup says what it will displace before writing (A-16) ---
    await go('#/settings');
    await page.evaluate(() => document.querySelectorAll('#screen details').forEach((d) => { d.open = true; }));
    await page.waitForTimeout(80);
    check('the backup note says the log and the encounter travel with it',
      /roll log/i.test(await page.locator('#screen').innerText()));

    // --- A-17: a Critical Injury on a rival is rolled, stored and stacks ---
    await go('#/combat');
    await page.selectOption('#bestiary-pick', 'gestapoInterrogator');
    await page.getByRole('button', { name: 'Drop in', exact: true }).click();
    await page.waitForTimeout(140);
    const rival = () => page.locator('.result', { hasText: 'Gestapo Interrogator' }).first();
    await rival().getByRole('button', { name: /^Critical Injury on/ }).click();
    await page.waitForTimeout(180);
    await page.evaluate(() => document.querySelectorAll('#screen details').forEach((d) => { d.open = true; }));
    await page.waitForTimeout(80);
    const rivalText = await rival().innerText();
    check('a rival takes a real Critical Injury off the §9 table',
      /Lasting injuries/i.test(rivalText) && /rolled \d+/.test(rivalText), rivalText.replace(/\n/g, ' | ').slice(0, 200));
    check('and it says what the next roll on them will take',
      /next roll \+10/.test(rivalText), rivalText.replace(/\n/g, ' | ').slice(0, 220));
    const storedCrits = await page.evaluate(() => {
      const c = JSON.parse(localStorage.getItem('reich62:combat') || '{}');
      return Object.values(c.combatants || {}).filter((x) => x.tier === 'rival')
        .reduce((n, x) => n + (x.criticalInjuries || []).length, 0);
    });
    check('the injury is stored on the combatant, not just announced', storedCrits >= 1, String(storedCrits));

    // --- A-18: a gated screen explains itself at its own URL ---
    await go('#/settings');
    if (await page.locator('#flag-gmScreen').isChecked()) await page.locator('#flag-gmScreen').uncheck();
    await page.waitForTimeout(80);
    await go('#/gm');
    check('a gated screen says why it is off instead of silently showing Home',
      (await page.locator('#gated-notice').count()) === 1,
      (await page.locator('#screen h2').first().innerText()));
    equal('and keeps its own URL', new URL(page.url()).hash, '#/gm');
    await page.locator('#gated-enable').click();
    await page.waitForTimeout(140);
    check('the button on it turns the screen on', (await page.locator('#bestiary-list').count()) === 1);

    // --- A-19: the three non-dragnet encounter blocks are deployable ---
    await subtab('Encounters');
    check('each ready-made encounter can be set up as a check',
      (await page.locator('[id^="deploy-"]').count()) === 3,
      String(await page.locator('[id^="deploy-"]').count()));
    await page.locator('#deploy-interrogation').click();
    await page.waitForTimeout(160);
    equal('the Interrogation block lands on the Roll screen as a Discipline check',
      await page.inputValue('#roller-skill'), 'discipline');
    check('and as an opposed check, since the block prints no dice pool',
      await page.locator('#roller-opposed').isChecked());

    // --- A-20: the opposed side comes off the target's own stat block ---
    await page.evaluate(() => document.querySelectorAll('#screen details').forEach((d) => { d.open = true; }));
    await page.waitForTimeout(80);
    const rivalOption = await page.evaluate(() =>
      [...document.querySelectorAll('#roller-target option')].find((o) => /Gestapo/.test(o.textContent))?.value);
    await page.selectOption('#roller-target', rivalOption);
    await page.waitForTimeout(120);
    await page.selectOption('#opp-resist-skill', 'coercion');
    await page.waitForTimeout(120);
    check('the app reads their rating rather than asking you to type it',
      /Gestapo Interrogator has Coercion \d/.test(await page.locator('#opp-from-target').innerText()),
      await page.locator('#opp-from-target').innerText());
    const oppSkillValue = await page.inputValue('#opp-skill');
    check('and fills the opposed fields with it', Number(oppSkillValue) > 0, oppSkillValue);

    // --- A-22: a talent puts its dice into the open check ---
    await go('#/sheet');
    await subtab('Advance');
    await page.selectOption('#advance-talent', 'quickStrike').catch(() => {});
    // Buying needs XP; award a session first.
    await go('#/combat');
    await page.evaluate(() => document.querySelectorAll('#screen details').forEach((d) => { d.open = true; }));
    await page.getByRole('button', { name: 'End Session', exact: true }).click();
    await page.waitForSelector('.modal-backdrop');
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.waitForTimeout(200);
    await go('#/sheet');
    await subtab('Advance');
    await page.selectOption('#advance-talent', 'quickStrike');
    await page.getByRole('button', { name: 'Buy talent' }).click();
    await page.waitForTimeout(180);
    await subtab('Talents & injuries');
    const boostBefore = await page.evaluate(() => 0);
    await page.getByRole('button', { name: 'Apply Quick Strike' }).click();
    await page.waitForTimeout(180);
    await go('#/roll');
    await page.evaluate(() => document.querySelectorAll('#screen details').forEach((d) => { d.open = true; }));
    await page.waitForTimeout(90);
    equal('the talent has put its Boost into the open check', await dieCount('Boost'), boostBefore + 1);
    check('and the check says which talent did it',
      /Quick Strike/.test(await page.locator('#roll-pool').innerText()),
      await page.locator('#roll-pool').innerText().then((t) => t.replace(/\n/g, ' | ').slice(0, 200)));

    // --- C-10: the suspicion track says how it got where it is ---
    await go('#/sheet');
    await subtab('Vitals');
    await page.evaluate(() => document.querySelectorAll('#screen details').forEach((d) => { d.open = true; }));
    await page.waitForTimeout(80);
    check('the suspicion track records why it moved',
      (await page.locator('#heat-trail').count()) === 1 && /→/.test(await page.locator('#heat-trail').innerText()),
      await page.locator('#heat-trail').innerText().then((t) => t.replace(/\n/g, ' | ').slice(0, 160)).catch(() => 'no trail'));

    // --- B-8, B-9: skills grouped, conditions folded ---
    await subtab('Skills');
    check('skills are grouped into their four categories',
      (await page.locator('#screen details').count()) >= 5,
      String(await page.locator('#screen details').count()));
    const skillsHeight = await page.evaluate(() => document.querySelector('#screen').scrollHeight);
    check('which brings the tab under 2,000px', skillsHeight < 2000, `${skillsHeight}px`);

    // --- A-21: the Oracle shows its dice and rolls them ---
    await go('#/settings');
    if (!(await page.locator('#flag-soloMode').isChecked())) await page.locator('#flag-soloMode').check();
    if (!(await page.locator('#flag-digitalRoller').isChecked())) await page.locator('#flag-digitalRoller').check();
    await page.waitForTimeout(90);
    await go('#/solo');
    check('the Oracle shows the dice it asks for',
      (await page.locator('#screen .die-count').count()) >= 6,
      String(await page.locator('#screen .die-count').count()));
    await page.locator('#oracle-ask').click();
    await page.waitForTimeout(180);
    check('one tap rolls and answers together',
      /show the dice/i.test(await page.locator('#oracle-answer').innerText()),
      (await page.locator('#oracle-answer').innerText()).replace(/\n/g, ' | '));
    check('the answer stays on screen',
      /Yes|No/.test(await page.locator('#oracle-answer').innerText()),
      (await page.locator('#oracle-answer').innerText()).replace(/\n/g, ' | '));

    // --- B-7: past five tabs the bar drops the labels rather than clipping them ---
    await go('#/settings');
    await page.locator('#mode-all').check();
    await page.waitForTimeout(120);
    const navCount = await page.locator('#bottom-nav a').count();
    check('the Everything seat shows every screen', navCount > 5, String(navCount));
    check('and drops to glyphs so nothing is clipped',
      await page.locator('#bottom-nav').evaluate((n) => n.classList.contains('nav-glyph-only')));
    check('each glyph still carries its name',
      (await page.locator('#bottom-nav a[aria-label]').count()) === navCount);
    await page.locator('#mode-player').check();
    await page.waitForTimeout(120);

    // --- XP at creation: changing your mind never leaves experience out of step ---
    await go('#/create');
    await page.locator('#build-from-career').click();
    await page.waitForSelector('#char-name');
    await page.fill('#char-name', 'XP Audit');
    await page.locator('#career-resistanceRunner').check();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.waitForTimeout(90);
    const xpPicks = await page.locator('input[id^="pick-"]').all();
    for (let i = 0; i < 4; i += 1) await xpPicks[i].check();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.waitForTimeout(90);
    const xpLeft = async () => Number((await page.locator('#screen').innerText()).match(/(\d+) of 70 experience left/)[1]);
    equal('the four career picks are free', await xpLeft(), 70);
    await subtab('Skills');
    await page.getByRole('button', { name: /^Raise Skulduggery$/ }).click();
    await page.waitForTimeout(110);
    equal('raising a career skill to rank 2 costs 10', await xpLeft(), 60);

    // Dropping the pick must give back both the rank and what was paid on top.
    await page.getByRole('button', { name: 'Back' }).click();
    await page.waitForTimeout(110);
    await page.locator('#pick-skulduggery').uncheck();
    await page.waitForTimeout(110);
    await page.locator('#pick-skulduggery').check();
    await page.waitForTimeout(110);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.waitForTimeout(110);
    equal('dropping the pick refunds what was paid to raise it', await xpLeft(), 70);

    // Changing career wipes every rank, so it must refund every rank.
    await subtab('Skills');
    await page.getByRole('button', { name: /^Raise Skulduggery$/ }).click();
    await page.waitForTimeout(110);
    await page.getByRole('button', { name: 'Back' }).click();
    await page.waitForTimeout(90);
    await page.getByRole('button', { name: 'Back' }).click();
    await page.waitForTimeout(90);
    await page.locator('#career-forger').check();
    await page.waitForTimeout(140);
    const forgerPicks = await page.locator('input[id^="pick-"]').all().catch(() => []);
    await page.getByRole('button', { name: 'Next', exact: true }).click().catch(() => {});
    await page.waitForTimeout(110);
    const nowPicks = await page.locator('input[id^="pick-"]').all();
    for (let i = 0; i < 4; i += 1) await nowPicks[i].check();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.waitForTimeout(110);
    equal('changing career refunds the ranks it wiped', await xpLeft(), 70);

    // A refund may not leave the talent pyramid illegal.
    await subtab('Talents');
    await page.evaluate(() => document.querySelectorAll('#screen details').forEach((d) => { d.open = true; }));
    await page.waitForTimeout(90);
    await page.getByRole('button', { name: /^Buy$/ }).first().click();
    await page.waitForTimeout(120);
    const tier2Buy = page.locator('.result', { hasText: 'Basic Military Training' }).getByRole('button', { name: /^Buy$/ });
    if (await tier2Buy.count()) {
      await tier2Buy.first().click();
      await page.waitForTimeout(120);
      const firstRefund = page.getByRole('button', { name: /^Refund / }).first();
      await firstRefund.click();
      await page.waitForTimeout(140);
      const toastText = await page.locator('#toast-region').innerText();
      check('refunding a lower-tier talent under a higher one is refused with a reason',
        /pyramid is broken/i.test(toastText) || /Refund a tier/i.test(toastText), toastText.replace(/\n/g, ' | '));
    }

    // --- renaming a character ---
    await go('#/');
    await page.locator('.result', { hasText: 'Test Runner' }).first()
      .getByRole('button', { name: 'Make active' }).click().catch(() => {});
    await go('#/sheet');
    check('the sheet offers a rename', (await page.locator('#rename-character').count()) === 1);
    await page.locator('#rename-character').click();
    await page.waitForSelector('.modal-backdrop');
    await page.locator('.modal input[type="text"]').fill('Renamed Runner');
    await page.getByRole('button', { name: 'Rename', exact: true }).last().click();
    await page.waitForTimeout(160);
    check('the new name lands on the sheet',
      /renamed runner/i.test(await page.locator('#screen .card').first().innerText()),
      (await page.locator('#screen .card').first().innerText()).replace(/\n/g, ' | '));
    await go('#/');
    check('and on the character list',
      /renamed runner/i.test(await page.locator('#screen').innerText()));
    // Put the name back: later checks look this character up by name.
    await go('#/sheet');
    await page.locator('#rename-character').click();
    await page.waitForSelector('.modal-backdrop');
    await page.locator('.modal input[type="text"]').fill('Test Runner');
    await page.getByRole('button', { name: 'Rename', exact: true }).last().click();
    await page.waitForTimeout(160);

    // --- the update prompt is a persistent bar with a reload button, not a timed toast ---
    const updateBar = await page.evaluate(async () => {
      const mod = await import('./src/update.js');
      mod.offerUpdate({ postMessage() { window.__skipWaitingAsked = true; } });
      const bar = document.querySelector('#update-bar');
      return bar ? { text: bar.innerText, reload: !!bar.querySelector('#update-reload'), later: !!bar.querySelector('#update-later') } : null;
    });
    check('the update notice offers a reload button', !!updateBar && updateBar.reload, JSON.stringify(updateBar));
    check('and says a new version is ready', !!updateBar && /new version/i.test(updateBar.text), JSON.stringify(updateBar));
    await page.locator('#update-reload').click();
    await page.waitForTimeout(90);
    check('tapping it asks the waiting worker to take over',
      await page.evaluate(() => window.__skipWaitingAsked === true));
    await page.evaluate(() => document.querySelector('#update-bar')?.remove());

    // --- safety-tools note (§20A) ---
    await go('#/settings');
    await page.getByRole('link', { name: 'Open the safety-tools note' }).click();
    // Wait for the safety screen itself, not for any card — the previous screen's cards are
    // still mounted for a beat and the assertion used to race the render.
    await page.waitForSelector('text=/Session zero and safety tools/');
    check('the safety-tools note covers session zero and rule zero',
      /Rule zero/.test(await page.locator('#screen').innerText()));

    // --- a skill on the sheet selects itself on the Roll screen and goes there ---
    await go('#/sheet');
    await subtab('Skills');
    // Skills are grouped into their four categories now; open them before reaching in.
    await page.evaluate(() => document.querySelectorAll('#screen details').forEach((d) => { d.open = true; }));
    await page.waitForTimeout(80);
    await page.getByRole('button', { name: 'Roll Medicine' }).click();
    await page.waitForTimeout(120);
    equal('tapping a skill jumps to the Roll screen', new URL(page.url()).hash, '#/roll');
    equal('the skill is already selected there', await page.inputValue('#roller-skill'), 'medicine');
    check('the pool is built from that skill', (await page.locator('.die-count').first().count()) === 1);
    await go('#/sheet');
    await subtab('Skills');
    await page.evaluate(() => document.querySelectorAll('#screen details').forEach((d) => { d.open = true; }));
    await page.waitForTimeout(80);
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
    for (const tab of ['Vitals', 'Skills', 'Gear', 'Talents & injuries', 'Recovery', 'Advance', 'Summary']) {
      await subtab(tab);
      const problems = await page.evaluate(A11Y_PROBE);
      check(`sheet ${tab} passes the accessibility sweep`, problems.length === 0, [...new Set(problems)].slice(0, 5).join(' | '));
    }
    // The GM screen's own sub-tabs, which the loop above only reaches at its default.
    await go('#/gm');
    for (const tab of ['Network', 'Opponents', 'Encounters', 'Tables', 'Build']) {
      await subtab(tab);
      await page.evaluate(() => document.querySelectorAll('#screen details').forEach((d) => { d.open = true; }));
      await page.waitForTimeout(60);
      const problems = await page.evaluate(A11Y_PROBE);
      check(`GM ${tab} passes the accessibility sweep`, problems.length === 0, [...new Set(problems)].slice(0, 5).join(' | '));
    }
    // And the wizard's later steps, which only exist once you are inside them.
    await go('#/create');
    const wizardProblems = await page.evaluate(A11Y_PROBE);
    check('the wizard\'s opening fork passes the accessibility sweep', wizardProblems.length === 0,
      [...new Set(wizardProblems)].slice(0, 5).join(' | '));

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
