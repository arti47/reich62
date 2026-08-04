// roller.js — the dice engine.
// R-B1: the manual never prints die face distributions, so manual symbol entry is the
// primary and default input. The app builds the pool, enforces the modification order,
// cancels symbols, applies spends, damage, Critical Injuries and Heat, and writes the log.

import { el, clear, titleCase, newTally, cancel, outcome, rollDie, rollFace, clamp } from './core.js';
import { showToast, renderTally, modal, panel, accordion, outcomeBox, numberStepper, emptyState, symbolGlyph } from './ui.js';
import { PANELS, label as termLabel, gloss } from './help.js';
import {
  SKILLS, DIFFICULTIES, SPEND_TABLES, STORY_POINTS, CRITICAL_INJURY_RULES, DIE_FACES,
  RANGED_DIFFICULTY_BY_RANGE, COMBAT_CHECK_PROCEDURE
} from '../data.js';
import {
  skill as skillById, buildPool, buildOpposedDifficulty, modifyPool, difficultyDice,
  criticalInjuryFor, criticalInjuryTotal
} from './rules.js';
import { activeCharacter, getCell, saveCell, saveCharacter } from './store.js';
import { soak as soakOf, woundThreshold, strainThreshold, criticalModifier } from './derived.js';
import { encumbranceState } from './derived.js';
import { heatFromCheck, applyPersonalHeat, heatSetbackDice } from './heat.js';
import { Settings } from './settings.js';
import { STORAGE_PREFIX } from './core.js';

/** One line per symbol, so the entry pad doubles as the legend. */
const SYMBOL_HELP = {
  success: 'Cancels a failure. One left over means the check works.',
  advantage: 'Cancels a threat. Left over, you spend it on something good.',
  triumph: 'Never cancels, always happens. The best result on the dice.',
  failure: 'Cancels a success.',
  threat: 'Cancels an advantage. Left over, the GM spends it against you.',
  despair: 'Never cancels, always happens. In public it draws attention.'
};

const LOG_KEY = STORAGE_PREFIX + 'rollLog';
const LOG_CAP = 100;

export function readLog() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { return []; }
}

export function writeLog(entry) {
  const log = readLog();
  log.unshift(entry);
  localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, LOG_CAP)));
  return entry;
}

export function clearLog() { localStorage.removeItem(LOG_KEY); }

// --- state for the open check ---
const blankPool = () => ({ ability: 0, proficiency: 0, difficulty: 0, challenge: 0, boost: 0, setback: 0 });

export const state = {
  skillId: 'perception',
  difficultyId: 'average',
  opposed: false,
  opponent: { skill: 0, characteristic: 0 },
  surveilled: false,
  publicCheck: true,
  entered: newTally(),
  lastDice: null,
  lastOutcome: null,
  context: 'combat',
  spendTriumphOnHeat: false,
  // Situational modifiers the manual defines (§5E, §5J) and the two Story Point die
  // modifications (§8), all applied in the §2.4 modification order.
  targetAdversary: 0,      // §12C — the Adversary talent upgrades checks against that NPC
  concealment: 0,          // §5E — Boost on the concealed character's Stealth, Setback against them
  concealmentRole: 'none', // 'hiding' | 'observing' | 'none'
  cover: false,            // §5E — ranged defence 1 plus a Boost on checks from behind it
  silhouetteDelta: 0,      // §5J — target silhouette minus your own
  // When `advancedAutomation` is off the automatic dice are shown as confirmable rows
  // rather than applied silently; the flag turns the prompting off.
  autoDice: { conditions: true, encumbrance: true, heat: true },
  upgradeAbility: 0,       // §8 / §2.4
  upgradeDifficulty: 0,
  downgradeAbility: 0,
  downgradeDifficulty: 0
};

/** Assemble the pool for the current check, applying automatic dice, in the manual's
 *  modification order (§2.4): assemble → add → upgrade → downgrade → remove. */
export function assemblePool(character = activeCharacter()) {
  const pool = blankPool();
  const modifications = [];
  const notes = [];

  const skillDef = skillById(state.skillId);
  if (character && skillDef) {
    const rank = (character.skills[skillDef.id] || { rank: 0 }).rank;
    const characteristic = character.attributes[skillDef.characteristic] || 0;
    const built = buildPool(rank, characteristic);
    pool.ability = built.ability;
    pool.proficiency = built.proficiency;
    notes.push(`${skillDef.name} ${rank} with ${titleCase(skillDef.characteristic)} ${characteristic} (§2)`);
  }

  if (state.opposed) {
    const opp = buildOpposedDifficulty(state.opponent.skill, state.opponent.characteristic);
    pool.difficulty = opp.difficulty;
    pool.challenge = opp.challenge;
    notes.push('Difficulty side built from the opponent\'s rating; only the active character rolls (§3A)');
  } else {
    pool.difficulty = difficultyDice(state.difficultyId);
  }

  // Environmental and size modifiers are properties of the situation, not the character,
  // so they apply whether or not a sheet is loaded (§5E, §5J).
  if (state.concealment > 0 && state.concealmentRole !== 'none') {
    const die = state.concealmentRole === 'hiding' ? 'boost' : 'setback';
    modifications.push({ stage: 'add', die, count: state.concealment });
    notes.push(state.concealmentRole === 'hiding'
      ? `Concealment adds ${state.concealment} Boost to Stealth (§5E)`
      : `Concealment adds ${state.concealment} Setback against a concealed target (§5E)`);
  }
  if (state.cover) {
    modifications.push({ stage: 'add', die: 'boost', count: 1 });
    notes.push('Cover adds 1 Boost on checks made from behind it, and grants ranged defence 1 (§5E)');
  }
  // The Adversary talent upgrades the difficulty of every combat check against that NPC,
  // once per rank (§12C).
  if (state.targetAdversary > 0) {
    modifications.push({ stage: 'upgrade', die: 'difficulty', count: state.targetAdversary });
    notes.push(`Target has Adversary ${state.targetAdversary}: the difficulty is upgraded ${state.targetAdversary} time(s) (§12C)`);
  }
  // Silhouette (§5J): two or more larger is one step easier, two or more smaller one harder.
  if (state.silhouetteDelta >= 2) {
    modifications.push({ stage: 'remove', die: 'difficulty', count: 1 });
    notes.push('Target is 2 or more silhouettes larger: one difficulty less (§5J)');
  } else if (state.silhouetteDelta <= -2) {
    modifications.push({ stage: 'add', die: 'difficulty', count: 1 });
    notes.push('Target is 2 or more silhouettes smaller: one difficulty more (§5J)');
  }

  if (character) {
    // Conditions that add dice.
    if (state.autoDice.conditions) {
      Object.entries(character.state.conditions || {}).forEach(([id, on]) => {
        if (on && id === 'disoriented') { modifications.push({ stage: 'add', die: 'setback', count: 1 }); notes.push('Disoriented adds 1 Setback (R-7)'); }
      });
    }
    // Encumbrance (§5F).
    const enc = encumbranceState(character);
    if (state.autoDice.encumbrance && enc.setbackDice && skillDef && ['brawn', 'agility'].includes(skillDef.characteristic)) {
      modifications.push({ stage: 'add', die: 'setback', count: enc.setbackDice });
      notes.push(`Encumbered by ${enc.over}: ${enc.setbackDice} Setback on Brawn and Agility checks (§5F)`);
    }
    // Heat thresholds (§17.3).
    const cell = getCell();
    const heatDice = state.autoDice.heat
      ? heatSetbackDice({ personalHeat: character.state.personalHeat, cellHeat: cell.cellHeat, isPublicCheck: state.publicCheck })
      : 0;
    if (heatDice) {
      modifications.push({ stage: 'add', die: 'setback', count: heatDice });
      notes.push(`Heat adds ${heatDice} Setback on public checks (§17.3)`);
    }
  }

  // Upgrades and downgrades resolve after every addition, per the modification order (§2.4).
  if (state.upgradeAbility) { modifications.push({ stage: 'upgrade', die: 'ability', count: state.upgradeAbility }); notes.push(`${state.upgradeAbility} Ability upgraded to Proficiency (§2.4, §8)`); }
  if (state.upgradeDifficulty) { modifications.push({ stage: 'upgrade', die: 'difficulty', count: state.upgradeDifficulty }); notes.push(`${state.upgradeDifficulty} Difficulty upgraded to Challenge (§2.4, §8)`); }
  if (state.downgradeAbility) { modifications.push({ stage: 'downgrade', die: 'proficiency', count: state.downgradeAbility }); notes.push(`${state.downgradeAbility} Proficiency downgraded to Ability (§2.4, §8)`); }
  if (state.downgradeDifficulty) { modifications.push({ stage: 'downgrade', die: 'challenge', count: state.downgradeDifficulty }); notes.push(`${state.downgradeDifficulty} Challenge downgraded to Difficulty (§2.4, §8)`); }

  return { pool: modifyPool(pool, modifications), notes, modifications };
}

/** Resolve the entered symbols (§1) and produce everything the log needs. */
export function resolve(character = activeCharacter()) {
  const { pool, notes } = assemblePool(character);
  const result = outcome(state.entered);
  const heat = heatFromCheck({
    despair: result.despair,
    triumph: result.triumph,
    surveilled: state.surveilled,
    skillId: state.skillId,
    spendTriumphOnHeat: state.spendTriumphOnHeat
  });
  return { pool, notes, result, heat };
}

export function commit(character = activeCharacter()) {
  const { pool, notes, result, heat } = resolve(character);
  let heatApplied = null;
  if (character && heat.personalHeat) heatApplied = applyPersonalHeat(character, heat.personalHeat);

  const entry = {
    ts: Date.now(),
    by: character ? character.id : null,
    characterName: character ? character.identity.name : 'No character',
    skill: state.skillId,
    difficulty: state.opposed ? 'opposed' : state.difficultyId,
    poolInputs: pool,
    symbols: { ...state.entered },
    net: result.net,
    outcome: result.success ? 'success' : 'failure',
    surveilled: state.surveilled,
    heatDelta: heat.personalHeat,
    notes
  };
  writeLog(entry);
  return { entry, result, heat, heatApplied };
}

/** Roll a pool digitally from the supplied face distributions (D§).
 *  Only reachable while `digitalRoller` is on, which needs DIE_FACES to exist (R-B1). */
export function rollPool(pool) {
  if (!DIE_FACES) return { ok: false, reason: 'No die face data is loaded (R-B1).' };
  const tally = newTally();
  const dice = [];
  Object.entries(pool).forEach(([dieType, count]) => {
    const faces = DIE_FACES[dieType];
    if (!faces) return;
    for (let i = 0; i < count; i += 1) {
      const rolled = rollFace(faces);
      rolled.symbols.forEach((symbol) => { tally[symbol] += 1; });
      dice.push({ die: dieType, face: rolled.face, symbols: rolled.symbols });
    }
  });
  return { ok: true, tally, dice };
}

// --- damage and Critical Injuries ---
/** Damage is weapon base plus one per uncancelled Success, reduced by soak (§5B). */
export function computeDamage({ baseDamage, netSuccess, targetSoak, pierce = 0 }) {
  const raw = baseDamage + netSuccess;
  const effectiveSoak = Math.max(0, targetSoak - pierce);
  return { raw, soaked: effectiveSoak, wounds: Math.max(0, raw - effectiveSoak) };
}

export function applyDamage(character, { wounds = 0, strain = 0 }) {
  character.state.wounds = Math.max(0, character.state.wounds + wounds);
  character.state.strain = Math.max(0, character.state.strain + strain);
  const wt = woundThreshold(character);
  const st = strainThreshold(character);
  character.state.incapacitated = character.state.wounds >= wt || character.state.strain >= st;
  saveCharacter(character);
  return { wounds: character.state.wounds, strain: character.state.strain, woundThreshold: wt, strainThreshold: st, incapacitated: character.state.incapacitated };
}

/** Critical Injury roll with every modifier the manual gives (§9, §5G, §5I, §10). R-14. */
export function rollCriticalInjury(character, { vicious = 0, fall = null, roll = null } = {}) {
  const mod = character ? criticalModifier(character) : { untreated: 0, durableMinus: 0 };
  const d100 = roll || rollDie(100);
  const total = criticalInjuryTotal({
    roll: d100,
    untreatedInjuries: mod.untreated,
    vicious,
    durable: mod.durableMinus / 10,
    fall
  });
  const injury = criticalInjuryFor(total);
  if (character && injury) {
    character.state.criticalInjuries.push({ roll: d100, total, severity: injury.severity, name: injury.name, healed: false });
    if (injury.condition) character.state.conditions[injury.condition] = true;
    if (injury.death) character.state.deathState = { kind: injury.death, roundsRemaining: injury.roundsRemaining ?? null };
    if (injury.apply && injury.apply.strain) character.state.strain += injury.apply.strain;
    saveCharacter(character);
  }
  return { roll: d100, total, injury, modifiers: mod };
}

/** Story Point spends move the point to the other pool once the effect resolves (§8). */
export function spendStoryPoint(side, spendId) {
  const cell = getCell();
  const from = side === 'player' ? 'storyPointsPlayer' : 'storyPointsGM';
  const to = side === 'player' ? 'storyPointsGM' : 'storyPointsPlayer';
  if (cell.pools[from] < 1) return { ok: false, reason: `The ${side} pool is empty (§8).` };
  cell.pools[from] -= 1;
  cell.pools[to] += 1;
  saveCell(cell);
  return { ok: true, spendId, pools: { ...cell.pools } };
}

/** Spend-table rows affordable with the symbols left over (§5C, §5C', §11, §12). R-12. */
export function availableSpends(context, net) {
  const table = SPEND_TABLES[context] || SPEND_TABLES.generic;
  const rows = [];
  table.positive.forEach((row) => {
    const byAdvantage = row.cost > 0 && net.advantage >= row.cost;
    const byTriumph = (row.triumph || row.triumphOnly) && net.triumph >= (row.triumphCount || 1);
    if (byAdvantage || byTriumph) rows.push({ ...row, side: 'positive', payWith: byAdvantage ? 'advantage' : 'triumph' });
  });
  table.negative.forEach((row) => {
    const byThreat = row.cost > 0 && net.threat >= row.cost;
    const byDespair = (row.despair || row.despairOnly) && net.despair >= 1;
    if (byThreat || byDespair) rows.push({ ...row, side: 'negative', payWith: byThreat ? 'threat' : 'despair' });
  });
  return rows;
}

/** Apply a chosen spend to the character's state where the effect is mechanical (§5C).
 *  Narrative rows are logged rather than applied. */
export function applySpend(character, row, effectIndex = 0) {
  const effect = row.effects[effectIndex];
  const applied = [];
  if (!character) return { ok: false, reason: 'No active character.' };

  if (/recover 1 strain/i.test(effect)) {
    character.state.strain = Math.max(0, character.state.strain - 1);
    applied.push('Recovered 1 strain (§5C).');
  } else if (/suffers 1 strain/i.test(effect)) {
    character.state.strain += 1;
    applied.push('Suffered 1 strain (§5C).');
  } else if (/falls prone/i.test(effect)) {
    character.state.conditions.prone = true;
    applied.push('Knocked prone (§5C).');
  } else if (/free maneuver/i.test(effect)) {
    applied.push('Take the free maneuver now — still capped at two per turn (§5A).');
  } else {
    applied.push('Narrative effect — logged rather than applied automatically.');
  }

  saveCharacter(character);
  writeLog({
    ts: Date.now(), by: character.id, characterName: character.identity.name,
    skill: state.skillId, difficulty: state.difficultyId, poolInputs: {}, symbols: {},
    net: {}, outcome: 'spend', surveilled: state.surveilled, heatDelta: 0,
    notes: [`Spend: ${effect}`, ...applied]
  });
  return { ok: true, applied };
}

/** Rank competitive-check results: Success, then Advantage, then Triumph, then simultaneous (R-3). */
export function compareCompetitive(a, b) {
  const na = cancel(a), nb = cancel(b);
  if (na.success !== nb.success) return nb.success - na.success;
  if (na.advantage !== nb.advantage) return nb.advantage - na.advantage;
  if (na.triumph !== nb.triumph) return nb.triumph - na.triumph;
  return 0; // simultaneous
}

// --- rendering ---
export function renderRoller(mount) {
  clear(mount);
  const character = activeCharacter();
  const rerender = () => renderRoller(mount);

  const setup = panel('What are you attempting?', PANELS.rollCheck, []);

  const skillSelect = el('select', { id: 'roller-skill', 'aria-label': 'Skill', onchange: (e) => { state.skillId = e.target.value; rerender(); } });
  SKILLS.forEach((s) => skillSelect.append(el('option', { value: s.id, text: `${s.name} (${titleCase(s.characteristic)})`, selected: state.skillId === s.id })));
  setup.append(el('label', { class: 'small', for: 'roller-skill', text: 'Skill' }), skillSelect);

  const diffSelect = el('select', { id: 'roller-difficulty', 'aria-label': 'Difficulty', disabled: state.opposed, onchange: (e) => { state.difficultyId = e.target.value; rerender(); } });
  DIFFICULTIES.forEach((d) => diffSelect.append(el('option', { value: d.id, text: `${d.name} (${d.dice})`, selected: state.difficultyId === d.id })));
  setup.append(el('label', { class: 'small', for: 'roller-difficulty', text: 'Difficulty' }), diffSelect);

  setup.append(toggle('roller-opposed', 'Opposed check (§3A)', state.opposed, (v) => { state.opposed = v; rerender(); }));
  if (state.opposed) {
    setup.append(el('p', { class: 'small muted', text: 'Only you roll. The difficulty side is built from the opponent\'s rating: the higher value sets Difficulty dice, the lower upgrades that many to Challenge.' }));
    setup.append(numberField('opp-skill', 'Opponent skill rank', state.opponent.skill, (v) => { state.opponent.skill = v; rerender(); }));
    setup.append(numberField('opp-char', 'Opponent characteristic', state.opponent.characteristic, (v) => { state.opponent.characteristic = v; rerender(); }));
  }
  setup.append(toggle('roller-surveilled', 'Surveilled context (§17.1)', state.surveilled, (v) => { state.surveilled = v; rerender(); }));
  setup.append(toggle('roller-triumph-heat', 'Spend a Triumph to reduce Personal Heat by 1 (§17.1)', state.spendTriumphOnHeat, (v) => { state.spendTriumphOnHeat = v; rerender(); }));
  setup.append(toggle('roller-public', 'Public check (Heat Setbacks apply)', state.publicCheck, (v) => { state.publicCheck = v; rerender(); }));
  mount.append(setup);

  // --- situational modifiers (§5E, §5J) and die modifications (§2.4, §8) ---
  const situationBody = el('div', {});
  const situational = panel('The situation', PANELS.rollSituation, [situationBody]);
  if (!Settings.advancedAutomation()) {
    situationBody.append(el('p', { class: 'small muted', text: 'Automatic dice are listed for confirmation. Switch on advanced automation in Settings to apply them without asking.' }));
    situationBody.append(toggle('auto-conditions', 'Apply condition dice (§3.9)', state.autoDice.conditions, (v) => { state.autoDice.conditions = v; rerender(); }));
    situationBody.append(toggle('auto-encumbrance', 'Apply encumbrance dice (§5F)', state.autoDice.encumbrance, (v) => { state.autoDice.encumbrance = v; rerender(); }));
    situationBody.append(toggle('auto-heat', 'Apply Heat threshold dice (§17.3)', state.autoDice.heat, (v) => { state.autoDice.heat = v; rerender(); }));
  } else {
    state.autoDice = { conditions: true, encumbrance: true, heat: true };
    situationBody.append(el('p', { class: 'small muted', text: 'Advanced automation is on: condition, encumbrance and Heat dice are applied without prompting.' }));
  }
  const concealSelect = el('select', { id: 'roller-concealment-role', 'aria-label': 'Concealment role', onchange: (e) => { state.concealmentRole = e.target.value; rerender(); } });
  [['none', 'No concealment'], ['hiding', 'I am the concealed one'], ['observing', 'My target is concealed']]
    .forEach(([value, label]) => concealSelect.append(el('option', { value, text: label, selected: state.concealmentRole === value })));
  situationBody.append(el('label', { class: 'small', for: 'roller-concealment-role', text: 'Concealment (§5E)' }), concealSelect);
  situationBody.append(numberField('roller-concealment', 'Concealment dice (1 mist · 2 fog or dusk · 3 night or smoke)', state.concealment, (v) => { state.concealment = v; rerender(); }));
  situationBody.append(toggle('roller-cover', 'Behind cover (§5E)', state.cover, (v) => { state.cover = v; rerender(); }));
  situationBody.append(numberField('roller-silhouette', 'Target silhouette minus mine (§5J)', state.silhouetteDelta, (v) => { state.silhouetteDelta = v; rerender(); }));
  situationBody.append(numberField('roller-adversary', 'Target\'s Adversary rank (§12C)', state.targetAdversary, (v) => { state.targetAdversary = v; rerender(); }));

  const modBody = el('div', {});
  situationBody.append(accordion('Change the dice by hand', [modBody], { key: 'roll-mods', summary: 'upgrade, downgrade, spend a story point' }));
  modBody.append(numberField('roller-upgrade-ability', 'Upgrade Ability → Proficiency', state.upgradeAbility, (v) => { state.upgradeAbility = v; rerender(); }));
  modBody.append(numberField('roller-downgrade-ability', 'Downgrade Proficiency → Ability', state.downgradeAbility, (v) => { state.downgradeAbility = v; rerender(); }));
  modBody.append(numberField('roller-upgrade-difficulty', 'Upgrade Difficulty → Challenge', state.upgradeDifficulty, (v) => { state.upgradeDifficulty = v; rerender(); }));
  modBody.append(numberField('roller-downgrade-difficulty', 'Downgrade Challenge → Difficulty', state.downgradeDifficulty, (v) => { state.downgradeDifficulty = v; rerender(); }));
  modBody.append(el('button', {
    type: 'button', class: 'secondary', id: 'spend-story-point-upgrade',
    text: 'Spend a Story Point to upgrade (§8)',
    onclick: () => {
      const result = spendStoryPoint('player', 'upgradeDowngrade');
      if (!result.ok) { showToast(result.reason); return; }
      state.upgradeAbility += 1;
      showToast(`Story Point spent — it moves to the GM pool (§8). Pools now ${result.pools.storyPointsPlayer}/${result.pools.storyPointsGM}`);
      document.dispatchEvent(new CustomEvent('resource:refresh'));
      rerender();
    }
  }));
  mount.append(situational);

  const { pool, notes } = assemblePool(character);
  const poolCard = panel('Your dice', PANELS.rollPool, [
    el('p', { class: 'dice-glyph', text: describePool(pool) }),
    el('ul', { class: 'small muted' }, notes.map((n) => el('li', { text: n })))
  ]);
  mount.append(poolCard);

  const entry = panel('What did you roll?', PANELS.rollEntry, [
    el('p', { class: 'small' }, [
      el('span', { class: 'badge badge-inferred', text: 'R-B1' }), ' ',
      DIE_FACES === null
        ? 'The manual never prints die face distributions, so the app cannot roll these dice for you. Roll them physically and tap what came up — everything after that is automatic.'
        : Settings.digitalRoller()
          ? 'Face distributions are loaded (D§), so the app can roll the pool for you. Entering symbols by hand still works and stays the default.'
          : 'Face distributions are loaded (D§) — switch on the simulated roller in Settings to have the app roll the pool for you.'
    ])
  ]);
  if (Settings.digitalRoller()) {
    entry.append(el('button', {
      type: 'button', class: 'primary', id: 'roll-digitally', text: 'Roll this pool',
      onclick: () => {
        const rolled = rollPool(pool);
        if (!rolled.ok) { showToast(rolled.reason); return; }
        state.entered = rolled.tally;
        state.lastDice = rolled.dice;
        showToast(`Rolled ${rolled.dice.length} dice from the supplied face table (D§)`);
        rerender();
      }
    }));
    if (state.lastDice && state.lastDice.length) {
      entry.append(el('p', { class: 'small muted', text: state.lastDice.map((d) => `${titleCase(d.die)} ${d.face}: ${d.symbols.length ? d.symbols.join(' + ') : 'blank'}`).join(' · ') }));
    }
  }
  ['success', 'advantage', 'triumph', 'failure', 'threat', 'despair'].forEach((sym) => {
    entry.append(el('div', { class: 'toggle-row' }, [
      el('label', { for: `sym-${sym}` }, [
        symbolGlyph(sym, state.entered[sym]),
        el('span', { class: 'toggle-desc', text: SYMBOL_HELP[sym] })
      ]),
      el('button', { type: 'button', class: 'secondary', text: '−', 'aria-label': `One less ${sym}`, onclick: () => { state.entered[sym] = Math.max(0, state.entered[sym] - 1); rerender(); } }),
      el('span', { id: `sym-${sym}`, class: 'stat-value', text: String(state.entered[sym]) }),
      el('button', { type: 'button', class: 'secondary', text: '+', 'aria-label': `One more ${sym}`, onclick: () => { state.entered[sym] += 1; rerender(); } })
    ]));
  });
  mount.append(entry);

  const { result, heat } = resolve(character);
  if (state.lastOutcome) mount.append(outcomeBox(state.lastOutcome, { title: 'Last check' }));

  const resultCard = panel('Outcome', PANELS.rollResult, [], { id: 'roll-result' });
  resultCard.querySelector('h2').append(el('span', {
    class: `status-chip status-${result.success ? 'success' : 'failure'}`,
    text: result.success ? 'Success' : 'Failure'
  }));
  resultCard.append(
    el('p', { class: 'small', text: explainCancellation(state.entered, result) }),
    el('p', {}, [renderTally(result.net)]),
    heat.reasons.length ? el('ul', { class: 'small' }, heat.reasons.map((r) => el('li', { text: r }))) : el('span', {})
  );

  const spends = availableSpends(state.context, result.net);
  if (spends.length) {
    resultCard.append(el('h3', { text: 'Spends available' }));
    spends.slice(0, 8).forEach((row) => {
      resultCard.append(el('div', { class: 'result' }, [
        el('div', { class: 'result-head' }, [
          el('span', { class: 'result-title', text: row.effects[0] }),
          el('span', { class: 'cite', text: row.payWith === 'triumph' ? '1 Triumph' : row.payWith === 'despair' ? '1 Despair' : `${row.cost} ${row.payWith}` })
        ]),
        row.effects.length > 1 ? el('div', { class: 'result-body', text: row.effects.slice(1).join(' · ') }) : null,
        el('button', {
          type: 'button', class: 'secondary', text: 'Apply',
          onclick: () => {
            const applied = applySpend(character, row);
            if (!applied.ok) { showToast(applied.reason); return; }
            applied.applied.forEach((a) => showToast(a));
            document.dispatchEvent(new CustomEvent('resource:refresh'));
            rerender();
          }
        })
      ]));
    });
  }

  resultCard.append(el('button', {
    type: 'button', class: 'primary', text: 'Log this check',
    onclick: () => {
      const committed = commit(character);
      const lines = [`Logged as a ${committed.entry.outcome}.`];
      committed.heat.reasons.forEach((r) => lines.push(r));
      if (committed.heatApplied) {
        lines.push(`Suspicion on you: ${committed.heatApplied.before} → ${committed.heatApplied.after}.`);
        committed.heatApplied.crossed.forEach((t) => lines.push(`Now at level ${t.level}: ${t.personal}`));
        if (committed.heatApplied.escalation) lines.push(`Network suspicion ${committed.heatApplied.escalation.before} → ${committed.heatApplied.escalation.after}: ${committed.heatApplied.escalation.reason}`);
      }
      state.lastOutcome = lines;
      state.entered = newTally();
      state.lastDice = null;
      rerender();
      document.dispatchEvent(new CustomEvent('resource:refresh'));
    }
  }));
  resultCard.append(el('button', { type: 'button', class: 'secondary', text: 'Clear symbols', onclick: () => { state.entered = newTally(); state.lastDice = null; rerender(); } }));
  mount.append(resultCard);

  const log = readLog().slice(0, 12);
  const logBody = el('div', {});
  const logCard = panel('Recent checks', PANELS.rollLog, [logBody]);
  if (!log.length) logBody.append(emptyState('Nothing logged yet — resolve a check and it lands here.'));
  log.forEach((item) => {
    logBody.append(el('div', { class: 'result' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: `${titleCase(item.skill)} — ${item.outcome}` }),
        el('span', { class: 'cite', text: new Date(item.ts).toLocaleTimeString() })
      ]),
      el('div', { class: 'result-body', text: `Pool ${describePool(item.poolInputs)} · entered ${describeTally(item.symbols)} · net ${describeTally(item.net)}${item.heatDelta ? ` · Heat ${item.heatDelta > 0 ? '+' : ''}${item.heatDelta}` : ''}` })
    ]));
  });
  mount.append(logCard);
}

/** Say why the check landed where it did, in one line: what cancelled what, and what
 *  survived (§1). */
export function explainCancellation(entered, result) {
  const parts = [];
  const cancelledSuccess = Math.min(entered.success, entered.failure);
  const cancelledAdvantage = Math.min(entered.advantage, entered.threat);

  if (cancelledSuccess) parts.push(`${cancelledSuccess} success cancelled against ${cancelledSuccess} failure`);
  if (result.netSuccess) parts.push(`${result.netSuccess} success left over, so the check succeeds`);
  else if (result.netFailure) parts.push(`${result.netFailure} failure left over, so the check fails`);
  else parts.push('nothing left on either side, and a check needs at least one success, so it fails');

  if (cancelledAdvantage) parts.push(`${cancelledAdvantage} advantage cancelled against ${cancelledAdvantage} threat`);
  if (result.netAdvantage) parts.push(`${result.netAdvantage} advantage to spend`);
  if (result.netThreat) parts.push(`${result.netThreat} threat for the GM to spend`);
  if (result.triumph) parts.push(`${result.triumph} triumph, which never cancels and always happens`);
  if (result.despair) parts.push(`${result.despair} despair, which never cancels and always happens`);

  return `${parts.join('; ')}.`;
}

function describePool(pool) {
  const parts = [];
  if (pool.ability) parts.push(`${pool.ability} Ability`);
  if (pool.proficiency) parts.push(`${pool.proficiency} Proficiency`);
  if (pool.difficulty) parts.push(`${pool.difficulty} Difficulty`);
  if (pool.challenge) parts.push(`${pool.challenge} Challenge`);
  if (pool.boost) parts.push(`${pool.boost} Boost`);
  if (pool.setback) parts.push(`${pool.setback} Setback`);
  return parts.join(' · ') || 'no dice';
}

function describeTally(tally) {
  const parts = Object.entries(tally).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`);
  return parts.join(', ') || 'none';
}

function toggle(id, label, value, onChange) {
  return el('div', { class: 'toggle-row' }, [
    el('input', { type: 'checkbox', id, checked: value, onchange: (e) => onChange(e.target.checked) }),
    el('label', { for: id }, [el('span', { text: label })])
  ]);
}

function numberField(id, label, value, onChange) {
  return el('div', { class: 'toggle-row' }, [
    el('label', { for: id }, [el('span', { text: label })]),
    el('input', { type: 'number', id, min: '0', max: '5', value: String(value), onchange: (e) => onChange(Number(e.target.value)) })
  ]);
}
