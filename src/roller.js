// roller.js — the dice engine.
// R-B1: the manual never prints die face distributions, so manual symbol entry is the
// primary and default input. The app builds the pool, enforces the modification order,
// cancels symbols, applies spends, damage, Critical Injuries and Heat, and writes the log.

import { el, clear, titleCase, newTally, cancel, outcome, rollDie, rollFace, clamp, uid } from './core.js';
import { showToast, renderTally, modal, panel, accordion, outcomeBox, numberStepper, emptyState, symbolGlyph, confirmModal } from './ui.js';
import { PANELS, label as termLabel, gloss } from './help.js';
import {
  SKILLS, DIFFICULTIES, SPEND_TABLES, STORY_POINTS, CRITICAL_INJURY_RULES, DIE_FACES,
  RANGED_DIFFICULTY_BY_RANGE, COMBAT_CHECK_PROCEDURE, DICE, SILHOUETTE_RULE,
  CALLED_SHOTS, COMBAT_VARIANTS, SOCIAL_ENCOUNTERS, WEAPONS, RANGE_BANDS
} from '../data.js';
import {
  skill as skillById, buildPool, buildOpposedDifficulty, modifyPool, difficultyDice,
  criticalInjuryFor, criticalInjuryTotal, attackDifficulty, rangedDifficultyFor,
  weaponBaseDamage, weaponPierce, weapon as weaponById
} from './rules.js';
import { getCombat } from './store.js';
import { damageCombatant } from './combat.js';
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

const SYMBOL_ORDER = ['success', 'advantage', 'triumph', 'failure', 'threat', 'despair'];

const LOG_KEY = STORAGE_PREFIX + 'rollLog';
const LOG_CAP = 100;

export function readLog() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { return []; }
}

export function writeLog(entry) {
  const log = readLog();
  const stored = { id: uid(), spends: [], ...entry };
  log.unshift(stored);
  localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, LOG_CAP)));
  return stored;
}

export function clearLog() { localStorage.removeItem(LOG_KEY); }

export function deleteLogEntry(id) {
  const log = readLog().filter((e) => e.id !== id);
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
  return log;
}

/** A spend belongs to the check that produced it, so it is appended to that entry rather
 *  than filling the log with rows of its own. */
export function appendSpendToLastEntry(text) {
  const log = readLog();
  if (!log.length) return null;
  log[0].spends = [...(log[0].spends || []), text];
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
  return log[0];
}

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
  lastOutcome: null,
  context: 'combat',
  spendTriumphOnHeat: false,
  // Set when the check came from a black-market purchase, so the house rule's exposure
  // trigger applies on a bad failure.
  blackMarket: false,
  // Situational modifiers the manual defines (§5E, §5J) and the two Story Point die
  // modifications (§8), all applied in the §2.4 modification order.
  targetAdversary: 0,      // §12C — the Adversary talent upgrades checks against that NPC
  concealment: 0,          // §5E — Boost on the concealed character's Stealth, Setback against them
  concealmentRole: 'none', // 'hiding' | 'observing' | 'none'
  cover: false,            // §5E — ranged defence 1 plus a Boost on checks from behind it
  silhouetteDelta: 0,      // §5J — target silhouette minus your own
  calledShot: null,        // §10A — how many aim maneuvers were spent, or null for no called shot
  twoWeapon: false,        // §5H — the off-hand attack raises the difficulty a step
  audienceSize: null,      // §11 — group influence sets the difficulty from the crowd's size
  // The attack chain (§5B): a weapon, a range band and a target on the combat tracker.
  // With a weapon chosen the pool takes its skill, and the band sets the difficulty; with a
  // target chosen the soak, defence and Adversary rank come off that combatant.
  weaponId: null,
  rangeBand: null,
  targetId: null,
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
    notes.push(`${skillDef.name} ${rank} with ${titleCase(skillDef.characteristic)} ${characteristic}`);
  }

  if (state.opposed) {
    const opp = buildOpposedDifficulty(state.opponent.skill, state.opponent.characteristic);
    pool.difficulty = opp.difficulty;
    pool.challenge = opp.challenge;
    notes.push('Difficulty side built from the opponent\'s rating; only the active character rolls');
  } else if (state.audienceSize) {
    // Group influence: the crowd's size sets the difficulty outright (§11).
    const row = SOCIAL_ENCOUNTERS.groupInfluenceLadder.find((g) => g.audience === state.audienceSize);
    pool.difficulty = difficultyDice(row ? row.difficulty : state.difficultyId);
    notes.push(`Swaying ${state.audienceSize} people sets the difficulty at ${titleCase(row ? row.difficulty : state.difficultyId)}`);
  } else {
    pool.difficulty = difficultyDice(state.difficultyId);
  }

  // Two-weapon fighting takes the higher difficulty and raises it one more step (§5H).
  if (state.twoWeapon) {
    modifications.push({ stage: 'add', die: 'difficulty', count: COMBAT_VARIANTS.twoWeapon.extraDifficultySteps });
    notes.push(`Fighting with two weapons: ${COMBAT_VARIANTS.twoWeapon.extraDifficultySteps} more difficulty, and the pool uses the lower of the two skills and characteristics`);
  }

  // A called shot aims at something specific and pays for it in Setback dice (§10A).
  if (state.calledShot !== null) {
    const aim = CALLED_SHOTS.setbackByAim.find((a) => a.aimManeuvers === state.calledShot)
      || CALLED_SHOTS.setbackByAim[0];
    modifications.push({ stage: 'add', die: 'setback', count: aim.setback });
    notes.push(`${aim.label}: ${aim.setback} Setback, and ${CALLED_SHOTS.payoffAdvantageCost} Advantage on a hit disables the target instead of wounding them`);
  }

  // Environmental and size modifiers are properties of the situation, not the character,
  // so they apply whether or not a sheet is loaded (§5E, §5J).
  if (state.concealment > 0 && state.concealmentRole !== 'none') {
    const die = state.concealmentRole === 'hiding' ? 'boost' : 'setback';
    modifications.push({ stage: 'add', die, count: state.concealment });
    notes.push(state.concealmentRole === 'hiding'
      ? `Concealment adds ${state.concealment} Boost to Stealth`
      : `Concealment adds ${state.concealment} Setback against a concealed target`);
  }
  if (state.cover) {
    modifications.push({ stage: 'add', die: 'boost', count: 1 });
    notes.push('Cover adds 1 Boost on checks made from behind it, and grants ranged defence 1');
  }
  // The Adversary talent upgrades the difficulty of every combat check against that NPC,
  // once per rank (§12C).
  if (state.targetAdversary > 0) {
    modifications.push({ stage: 'upgrade', die: 'difficulty', count: state.targetAdversary });
    notes.push(`Target has Adversary ${state.targetAdversary}: the difficulty is upgraded ${state.targetAdversary} time(s)`);
  }
  // Silhouette (§5J): the thresholds and the direction both come from SILHOUETTE_RULE.
  const bigger = SILHOUETTE_RULE.largerTarget;
  const smaller = SILHOUETTE_RULE.smallerTarget;
  if (state.silhouetteDelta >= bigger.differenceAtLeast) {
    modifications.push({ stage: 'remove', die: 'difficulty', count: Math.abs(bigger.difficultySteps) });
    notes.push(`Target is ${bigger.differenceAtLeast} or more sizes larger: ${Math.abs(bigger.difficultySteps)} difficulty less`);
  } else if (state.silhouetteDelta <= -smaller.differenceAtLeast) {
    modifications.push({ stage: 'add', die: 'difficulty', count: Math.abs(smaller.difficultySteps) });
    notes.push(`Target is ${smaller.differenceAtLeast} or more sizes smaller: ${Math.abs(smaller.difficultySteps)} difficulty more`);
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
      notes.push(`Encumbered by ${enc.over}: ${enc.setbackDice} Setback on Brawn and Agility checks`);
    }
    // Heat thresholds (§17.3).
    const cell = getCell();
    const heatDice = state.autoDice.heat
      ? heatSetbackDice({ personalHeat: character.state.personalHeat, cellHeat: cell.cellHeat, isPublicCheck: state.publicCheck })
      : 0;
    if (heatDice) {
      modifications.push({ stage: 'add', die: 'setback', count: heatDice });
      notes.push(`Heat adds ${heatDice} Setback on public checks`);
    }
  }

  // Upgrades and downgrades resolve after every addition, per the modification order (§2.4).
  if (state.upgradeAbility) { modifications.push({ stage: 'upgrade', die: 'ability', count: state.upgradeAbility }); notes.push(`${state.upgradeAbility} Ability upgraded to Proficiency`); }
  if (state.upgradeDifficulty) { modifications.push({ stage: 'upgrade', die: 'difficulty', count: state.upgradeDifficulty }); notes.push(`${state.upgradeDifficulty} Difficulty upgraded to Challenge`); }
  if (state.downgradeAbility) { modifications.push({ stage: 'downgrade', die: 'proficiency', count: state.downgradeAbility }); notes.push(`${state.downgradeAbility} Proficiency downgraded to Ability`); }
  if (state.downgradeDifficulty) { modifications.push({ stage: 'downgrade', die: 'challenge', count: state.downgradeDifficulty }); notes.push(`${state.downgradeDifficulty} Challenge downgraded to Difficulty`); }

  return { pool: modifyPool(pool, modifications), notes, modifications };
}

// --- the attack chain (§5B): weapon → range → target → damage ---

/** Every weapon, with the ones this character carries first and flagged. The whole list
 *  stays reachable: a GM rolling for an NPC, or a player who has not logged their gear,
 *  still needs to pick up a rifle without going shopping first. */
export function availableWeapons(character) {
  const carriedIds = new Set((character ? character.inventory.items || [] : [])
    .filter((i) => i.kind === 'weapon').map((i) => i.id));
  const rank = (w) => (carriedIds.has(w.id) ? 0 : w.price === null ? 1 : 2);
  return WEAPONS
    .map((w) => ({ ...w, carried: carriedIds.has(w.id) }))
    .sort((a, b) => rank(a) - rank(b));
}

/** The chosen target on the combat tracker, if there is one. */
export function currentTarget() {
  if (!state.targetId) return null;
  return getCombat().combatants[state.targetId] || null;
}

/** Set the weapon, taking its skill and letting the range band set the difficulty (§5B).
 *  The difficulty picker is written to rather than silently overridden, so what the screen
 *  shows is what the pool used. */
export function chooseWeapon(weaponId) {
  state.weaponId = weaponId || null;
  const def = weaponById(state.weaponId);
  if (!def) { state.rangeBand = null; return null; }
  state.skillId = def.skill;
  if (!state.rangeBand) state.rangeBand = def.range;
  state.difficultyId = attackDifficulty(def, state.rangeBand);
  return def;
}

export function chooseRangeBand(band) {
  state.rangeBand = band || null;
  const def = weaponById(state.weaponId);
  if (def) state.difficultyId = attackDifficulty(def, state.rangeBand);
  return state.difficultyId;
}

/** Point the check at a combatant: their Adversary rank feeds the pool, their soak the damage. */
export function chooseTarget(combatantId) {
  state.targetId = combatantId || null;
  const target = currentTarget();
  state.targetAdversary = target ? (target.adversary || 0) : 0;
  return target;
}

/** What this attack does on a hit: weapon base + net Success, less soak after Pierce (§5B). */
export function attackDamage(character = activeCharacter(), net = null) {
  const def = weaponById(state.weaponId);
  if (!def) return null;
  const result = net || outcome(state.entered).net;
  const target = currentTarget();
  const base = weaponBaseDamage(def, character ? character.attributes.brawn : 0);
  const pierce = weaponPierce(def);
  const damage = computeDamage({
    baseDamage: base,
    netSuccess: result.success,
    targetSoak: target ? (target.soak || 0) : 0,
    pierce
  });
  return {
    ...damage, weapon: def, base, pierce, target,
    // A Critical Injury triggers when uncancelled Advantage meets the crit rating, or on a
    // Despair, or by spending two Advantage (§5B, §5.7).
    critical: result.advantage >= def.crit || result.despair > 0,
    critReason: result.despair > 0 ? 'an uncancelled despair' : `${def.crit} advantage`
  };
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
    spendTriumphOnHeat: state.spendTriumphOnHeat,
    blackMarket: state.blackMarket,
    failed: !result.success,
    threat: result.netThreat
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
  if (!DIE_FACES) return { ok: false, reason: 'No die face data is loaded, so the app cannot roll for you.' };
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
  if (cell.pools[from] < 1) return { ok: false, reason: `The ${side} pool is empty.` };
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
    applied.push('Recovered 1 strain.');
  } else if (/suffers 1 strain/i.test(effect)) {
    character.state.strain += 1;
    applied.push('Suffered 1 strain.');
  } else if (/falls prone/i.test(effect)) {
    character.state.conditions.prone = true;
    applied.push('Knocked prone.');
  } else if (/free maneuver/i.test(effect)) {
    applied.push('Take the free maneuver now — still capped at two per turn.');
  } else {
    applied.push('Narrative effect — logged rather than applied automatically.');
  }

  saveCharacter(character);
  appendSpendToLastEntry(effect);
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

  // What kind of check this is decides which spend table the Outcome offers (§5C, §11, §12).
  const contextSelect = el('select', {
    id: 'roller-context', 'aria-label': 'Kind of check',
    onchange: (e) => { state.context = e.target.value; rerender(); }
  });
  CHECK_CONTEXTS.forEach((c) => contextSelect.append(el('option', { value: c.id, text: c.label, selected: state.context === c.id })));
  setup.append(el('label', { class: 'small', for: 'roller-context', text: 'What kind of check is this?' }), contextSelect);
  setup.append(el('p', { class: 'small muted', text: 'It decides which list of things you can spend leftover advantage and threat on.' }));

  setup.append(toggle('roller-opposed', 'Opposed check', state.opposed, (v) => { state.opposed = v; rerender(); }));
  if (state.opposed) {
    setup.append(el('p', { class: 'small muted', text: 'Only you roll. The difficulty side is built from the opponent\'s rating: the higher value sets Difficulty dice, the lower upgrades that many to Challenge.' }));
    setup.append(numberField('opp-skill', 'Their skill rank', state.opponent.skill, (v) => { state.opponent.skill = v; rerender(); }));
    setup.append(numberField('opp-char', 'Their characteristic', state.opponent.characteristic, (v) => { state.opponent.characteristic = v; rerender(); }));
  }
  setup.append(toggle('roller-blackmarket', 'Black-market deal (house rule)', state.blackMarket, (v) => { state.blackMarket = v; rerender(); }));
  setup.append(toggle('roller-surveilled', 'Surveilled context', state.surveilled, (v) => { state.surveilled = v; rerender(); }));
  setup.append(toggle('roller-triumph-heat', 'Spend a Triumph to reduce Personal Heat by 1', state.spendTriumphOnHeat, (v) => { state.spendTriumphOnHeat = v; rerender(); }));
  setup.append(toggle('roller-public', 'Public check (Heat Setbacks apply)', state.publicCheck, (v) => { state.publicCheck = v; rerender(); }));
  mount.append(setup);

  // --- the attack: weapon, range and target (§5B) ---
  mount.append(attackPanel(character, rerender));

  // --- situational modifiers (§5E, §5J) and die modifications (§2.4, §8) ---
  const situationBody = el('div', {});
  // Everything here is at its default on most checks, so it folds away behind one row that
  // says what is currently set rather than occupying a third of the screen (B-1).
  const situational = panel('The situation', PANELS.rollSituation, []);
  if (!Settings.advancedAutomation()) {
    situationBody.append(el('p', { class: 'small muted', text: 'Automatic dice are listed for confirmation. Switch on advanced automation in Settings to apply them without asking.' }));
    situationBody.append(toggle('auto-conditions', 'Apply condition dice', state.autoDice.conditions, (v) => { state.autoDice.conditions = v; rerender(); }));
    situationBody.append(toggle('auto-encumbrance', 'Apply encumbrance dice', state.autoDice.encumbrance, (v) => { state.autoDice.encumbrance = v; rerender(); }));
    situationBody.append(toggle('auto-heat', 'Apply Heat threshold dice', state.autoDice.heat, (v) => { state.autoDice.heat = v; rerender(); }));
  } else {
    state.autoDice = { conditions: true, encumbrance: true, heat: true };
    situationBody.append(el('p', { class: 'small muted', text: 'Advanced automation is on: condition, encumbrance and Heat dice are applied without prompting.' }));
  }
  const concealSelect = el('select', { id: 'roller-concealment-role', 'aria-label': 'Concealment role', onchange: (e) => { state.concealmentRole = e.target.value; rerender(); } });
  [['none', 'No concealment'], ['hiding', 'I am the concealed one'], ['observing', 'My target is concealed']]
    .forEach(([value, label]) => concealSelect.append(el('option', { value, text: label, selected: state.concealmentRole === value })));
  situationBody.append(el('label', { class: 'small', for: 'roller-concealment-role', text: 'Concealment' }), concealSelect);
  situationBody.append(numberField('roller-concealment', 'How thick is it?', state.concealment, (v) => { state.concealment = v; rerender(); },
    { max: 3, hint: '1 mist or shadow · 2 fog, dusk or tall grass · 3 night, smoke or heavy fog' }));
  situationBody.append(toggle('roller-cover', 'Behind cover', state.cover, (v) => { state.cover = v; rerender(); }));
  situationBody.append(numberField('roller-silhouette', 'Size difference', state.silhouetteDelta, (v) => { state.silhouetteDelta = v; rerender(); },
    { min: -4, max: 4, hint: 'Target size minus your own. Two or more either way shifts the difficulty a step.' }));
  situationBody.append(numberField('roller-adversary', 'How hard is the target to hit?', state.targetAdversary, (v) => { state.targetAdversary = v; rerender(); },
    { max: 3, hint: 'Their Adversary rating, if they have one. Each rank makes this check one step harder.' }));

  // Called shots (§10A): aiming at a specific thing costs Setback and pays off in a spend.
  const calledSelect = el('select', {
    id: 'roller-called-shot', 'aria-label': 'Called shot',
    onchange: (e) => { state.calledShot = e.target.value === '' ? null : Number(e.target.value); rerender(); }
  });
  calledSelect.append(el('option', { value: '', text: 'Not aiming at anything in particular', selected: state.calledShot === null }));
  CALLED_SHOTS.setbackByAim.forEach((a) => calledSelect.append(el('option', {
    value: String(a.aimManeuvers), text: `${a.label} — ${a.setback} Setback`, selected: state.calledShot === a.aimManeuvers
  })));
  situationBody.append(
    el('label', { class: 'small', for: 'roller-called-shot', text: 'Aiming at something specific' }),
    calledSelect,
    el('p', { class: 'small muted', text: `Declare it before you roll. On a hit, spending ${CALLED_SHOTS.payoffAdvantageCost} advantage disables the thing you aimed at — a weapon, a tyre, a radio — instead of dealing damage.` })
  );

  // Two-weapon fighting (§5H).
  situationBody.append(toggle('roller-two-weapon', 'Attacking with a weapon in each hand', state.twoWeapon, (v) => { state.twoWeapon = v; rerender(); }));
  if (state.twoWeapon) {
    situationBody.append(el('p', { class: 'small muted', text: `Build the pool from the lower of the two skill ranks and the lower of the two characteristics. The primary weapon hits on a success; landing the off-hand one costs ${COMBAT_VARIANTS.twoWeapon.secondaryHit.advantage} advantage or ${COMBAT_VARIANTS.twoWeapon.secondaryHit.triumph} triumph.` }));
  }

  // Group influence (§11): the audience sets the difficulty outright.
  const audienceSelect = el('select', {
    id: 'roller-audience', 'aria-label': 'Audience size', disabled: state.opposed,
    onchange: (e) => { state.audienceSize = e.target.value || null; rerender(); }
  });
  audienceSelect.append(el('option', { value: '', text: 'Talking to one person', selected: !state.audienceSize }));
  SOCIAL_ENCOUNTERS.groupInfluenceLadder.forEach((g) => audienceSelect.append(el('option', {
    value: g.audience, text: `${g.audience} people — ${titleCase(g.difficulty)}`, selected: state.audienceSize === g.audience
  })));
  situationBody.append(
    el('label', { class: 'small', for: 'roller-audience', text: 'Swaying a crowd' }),
    audienceSelect,
    el('p', { class: 'small muted', text: 'Working a room instead of one person: the size of the audience sets the difficulty and overrides the picker above.' })
  );

  const modBody = el('div', {});
  situationBody.append(accordion('Change the dice by hand', [modBody], { key: 'roll-mods', summary: 'upgrade, downgrade, spend a story point' }));

  modBody.append(numberField('roller-upgrade-ability', 'Upgrade your dice', state.upgradeAbility, (v) => { state.upgradeAbility = v; rerender(); }));
  modBody.append(numberField('roller-downgrade-ability', 'Downgrade your dice', state.downgradeAbility, (v) => { state.downgradeAbility = v; rerender(); }));
  modBody.append(numberField('roller-upgrade-difficulty', 'Upgrade the difficulty', state.upgradeDifficulty, (v) => { state.upgradeDifficulty = v; rerender(); }));
  modBody.append(numberField('roller-downgrade-difficulty', 'Downgrade the difficulty', state.downgradeDifficulty, (v) => { state.downgradeDifficulty = v; rerender(); }));
  modBody.append(el('button', {
    type: 'button', class: 'secondary', id: 'spend-story-point-upgrade',
    text: 'Spend a story point to upgrade a die',
    onclick: () => {
      const result = spendStoryPoint('player', 'upgradeDowngrade');
      if (!result.ok) { showToast(result.reason); return; }
      state.upgradeAbility += 1;
      showToast(`Story Point spent — it moves to the GM pool. Pools now ${result.pools.storyPointsPlayer}/${result.pools.storyPointsGM}`);
      document.dispatchEvent(new CustomEvent('resource:refresh'));
      rerender();
    }
  }));
  situational.append(accordion('Anything unusual about this check?', [situationBody], {
    key: 'roll-situation',
    summary: situationSummary(character),
    defaultOpen: false
  }));
  mount.append(situational);

  // The pool's numbers live in the entry panel, beside the symbols they produce, and
  // update as soon as anything that feeds them changes.
  const { pool, notes } = assemblePool(character);
  const entry = panel('What did you roll?', PANELS.rollEntry, [], { id: 'roll-pool' });
  entry.append(...[
    diceToRoll(pool, notes),
    el('p', { class: 'small' }, [
      DIE_FACES === null
        ? 'The manual never prints die face distributions, so the app cannot roll these dice for you. Roll them physically and tap what came up — everything after that is automatic.'
        : Settings.digitalRoller()
          ? 'The app rolls the pool for you. Switch the simulated roller off in Settings to tap in what your own dice showed instead.'
          : 'Switch on the simulated roller in Settings to have the app roll the pool for you.'
    ])
  ]);
  if (Settings.digitalRoller()) {
    entry.append(el('button', {
      type: 'button', class: 'primary', id: 'roll-digitally', text: 'Roll this pool',
      onclick: () => {
        const rolled = rollPool(pool);
        if (!rolled.ok) { showToast(rolled.reason); return; }
        state.entered = rolled.tally;
        showToast(`Rolled ${rolled.dice.length} dice`);
        rerender();
      }
    }));
  }
  // The app rolled the dice, so there is nothing to key in: the symbols are shown as a
  // read-only list of what came up, and a symbol that did not come up is not listed.
  // With the simulated roller off, tapping in what your physical dice showed is the only
  // input there is (R-B1), so the pad stays.
  if (Settings.digitalRoller()) {
    entry.append(rolledSymbols(state.entered));
  } else {
    SYMBOL_ORDER.forEach((sym) => {
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
  }
  mount.append(entry);

  const { result, heat } = resolve(character);
  if (state.lastOutcome) mount.append(outcomeBox(state.lastOutcome, { title: 'Last check' }));

  // Nothing entered yet is not a failed check: the panel stays neutral until the player
  // has tapped in what their dice showed.
  const anyEntered = Object.values(state.entered).some((n) => n > 0);
  const resultCard = panel('Outcome', PANELS.rollResult, [], { id: 'roll-result' });
  resultCard.querySelector('h2').append(el('span', {
    class: `status-chip status-${anyEntered ? (result.success ? 'success' : 'failure') : 'pending'}`,
    text: anyEntered ? (result.success ? 'Success' : 'Failure') : 'Waiting for your dice'
  }));
  resultCard.append(
    anyEntered ? el('span', {}) : el('p', { class: 'small', text: 'Tap in the symbols above and the result works itself out here.' }),
    anyEntered ? el('p', {}, [renderTally(result.net)]) : el('span', {}),
    heat.reasons.length ? el('ul', { class: 'small' }, heat.reasons.map((r) => el('li', { text: r }))) : el('span', {})
  );

  // --- damage, when the check was an attack (§5B) ---
  if (anyEntered && state.weaponId) {
    const dmg = attackDamage(character, result.net);
    const damageBody = el('div', { id: 'attack-damage' });
    if (!result.success) {
      damageBody.append(el('p', { class: 'small muted', text: `The ${dmg.weapon.name} missed, so there is no damage to work out.` }));
    } else {
      damageBody.append(el('p', { class: 'small' }, [
        `${dmg.weapon.name}: ${dmg.base} base and ${result.net.success} from the successes is ${dmg.raw}`,
        dmg.target ? `, less ${dmg.soaked} soak${dmg.pierce ? ` after Pierce ${dmg.pierce}` : ''} — ` : ' — ',
        el('strong', { id: 'damage-wounds', text: `${dmg.target ? dmg.wounds : dmg.raw} wounds` }),
        dmg.target ? '.' : '. Pick a target above and the app takes their soak off for you.'
      ]));
      if (dmg.critical) {
        damageBody.append(el('p', { class: 'small', id: 'damage-critical' }, [
          el('span', { class: 'badge', text: 'critical' }), ' ',
          `${titleCase(dmg.critReason)} means this hit also causes a lasting injury.`
        ]));
      }
      if (dmg.target) {
        damageBody.append(el('button', {
          type: 'button', class: 'primary', id: 'apply-attack-damage',
          text: `Apply ${dmg.wounds} wounds to ${dmg.target.name}`,
          onclick: () => {
            const applied = damageCombatant(dmg.target.id, { wounds: dmg.wounds, critical: dmg.critical });
            if (!applied.ok && applied.reason) { showToast(applied.reason); return; }
            const lines = [`${dmg.wounds} wounds to ${dmg.target.name}.`, ...(applied.notes || [])];
            appendSpendToLastEntry(`${dmg.wounds} wounds to ${dmg.target.name}`);
            state.lastOutcome = lines;
            showToast(lines.join(' '));
            document.dispatchEvent(new CustomEvent('resource:refresh'));
            rerender();
          }
        }));
      } else if (character) {
        damageBody.append(el('button', {
          type: 'button', class: 'secondary', id: 'apply-attack-damage-self',
          text: `Take ${dmg.raw} wounds myself`,
          onclick: () => {
            const after = applyDamage(character, { wounds: Math.max(0, dmg.raw - soakOf(character)) });
            showToast(`Wounds now ${after.wounds}/${after.woundThreshold}${after.incapacitated ? ' — incapacitated' : ''}`);
            document.dispatchEvent(new CustomEvent('resource:refresh'));
            rerender();
          }
        }));
      }
    }
    resultCard.append(el('h3', { text: 'Damage' }), damageBody);
  }

  const spends = anyEntered ? availableSpends(state.context, result.net) : [];
  if (spends.length) {
    const contextLabel = (CHECK_CONTEXTS.find((c) => c.id === state.context) || CHECK_CONTEXTS[1]).label;
    resultCard.append(el('h3', { text: `What you can spend it on — ${contextLabel.toLowerCase()}` }));
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
    type: 'button', class: 'primary', text: 'Log this check', disabled: !anyEntered,
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
      rerender();
      document.dispatchEvent(new CustomEvent('resource:refresh'));
    }
  }));
  resultCard.append(el('button', { type: 'button', class: 'secondary', text: 'Clear symbols', onclick: () => { state.entered = newTally(); rerender(); } }));
  mount.append(resultCard);

  const log = readLog().slice(0, 12);
  const logBody = el('div', {});
  const logCard = panel('Recent checks', PANELS.rollLog, []);
  if (!log.length) {
    logBody.append(emptyState('Nothing logged yet — resolve a check and it lands here.'));
  } else {
    logCard.append(el('button', {
      type: 'button', class: 'secondary', id: 'clear-log', text: `Clear all ${readLog().length}`,
      onclick: async () => {
        if (!(await confirmModal(`Delete all ${readLog().length} logged checks? This cannot be undone.`, { title: 'Clear the log', confirmLabel: 'Delete them' }))) return;
        clearLog();
        rerender();
      }
    }));
  }
  logCard.append(logBody);
  log.forEach((item) => {
    const verdict = item.outcome === 'success' ? 'Success' : 'Failure';
    const row = el('div', { class: 'result log-row' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: `${titleCase(item.skill)} — ${verdict}` }),
        el('span', { class: 'cite', text: new Date(item.ts).toLocaleTimeString() })
      ]),
      el('div', { class: 'log-symbols' }, [renderTally(item.net || {})])
    ]);
    if (item.heatDelta) {
      row.append(el('p', { class: 'small muted', text: `Suspicion ${item.heatDelta > 0 ? '+' : ''}${item.heatDelta}` }));
    }
    (item.spends || []).forEach((spendText) => {
      row.append(el('p', { class: 'small muted', text: `Spent: ${spendText}` }));
    });
    row.append(el('button', {
      type: 'button', class: 'secondary log-delete', text: 'Delete',
      'aria-label': `Delete the ${titleCase(item.skill)} check logged at ${new Date(item.ts).toLocaleTimeString()}`,
      onclick: () => { deleteLogEntry(item.id); rerender(); }
    }));
    logBody.append(row);
  });
  mount.append(logCard);
}


/** The dice this check uses, as live per-type numbers: anything that feeds the pool —
 *  skill, characteristic, difficulty, opposition, cover, concealment, size, conditions,
 *  encumbrance, suspicion, upgrades — moves these the moment you touch it. */
/** A one-line account of what is currently pushing the dice around, so the collapsed
 *  situation panel never hides a modifier the player has forgotten about. */
function situationSummary(character) {
  const set = [];
  if (state.concealment > 0 && state.concealmentRole !== 'none') set.push('concealment');
  if (state.cover) set.push('cover');
  if (state.silhouetteDelta !== 0) set.push('size');
  if (state.targetAdversary > 0) set.push(`adversary ${state.targetAdversary}`);
  if (state.calledShot !== null) set.push('called shot');
  if (state.twoWeapon) set.push('two weapons');
  if (state.audienceSize) set.push(`crowd of ${state.audienceSize}`);
  if (state.upgradeAbility || state.upgradeDifficulty || state.downgradeAbility || state.downgradeDifficulty) set.push('hand-changed dice');
  if (character) {
    const conditions = Object.entries(character.state.conditions || {}).filter(([, on]) => on);
    if (state.autoDice.conditions && conditions.length) set.push('your condition');
    if (state.autoDice.encumbrance && encumbranceState(character).over) set.push('overloaded');
    if (state.autoDice.heat && heatSetbackDice({
      personalHeat: character.state.personalHeat, cellHeat: getCell().cellHeat, isPublicCheck: state.publicCheck
    })) set.push('suspicion');
  }
  return set.length ? set.join(' · ') : 'nothing set';
}

/** The four spend tables the manual prints, named in the words a player would use. */
export const CHECK_CONTEXTS = [
  { id: 'combat',  label: 'A fight' },
  { id: 'generic', label: 'Anything else' },
  { id: 'social',  label: 'Talking someone round' },
  { id: 'vehicle', label: 'Driving or flying' }
];

/** Weapon, range and target. Choosing a weapon takes its skill and lets the band set the
 *  difficulty; choosing a target takes their soak and Adversary rank off the tracker (§5B). */
function attackPanel(character, rerender) {
  const body = el('div', {});
  const weapons = availableWeapons(character);
  const combatants = Object.values(getCombat().combatants || {});

  const weaponSelect = el('select', {
    id: 'roller-weapon', 'aria-label': 'Weapon',
    onchange: (e) => { chooseWeapon(e.target.value); rerender(); }
  });
  weaponSelect.append(el('option', { value: '', text: 'Not attacking with a weapon', selected: !state.weaponId }));
  weapons.forEach((w) => weaponSelect.append(el('option', {
    value: w.id, selected: state.weaponId === w.id,
    text: `${w.carried ? '● ' : ''}${w.name} — ${titleCase(w.skill)}, damage ${w.damage}${w.damageType === 'plusBrawn' ? ' + Brawn' : ''}, crit ${w.crit}`
  })));
  body.append(el('label', { class: 'small', for: 'roller-weapon', text: 'Weapon' }), weaponSelect);
  body.append(el('p', { class: 'small muted', text: weapons.some((w) => w.carried)
    ? 'A dot marks what you are actually carrying; the rest of the list is there for borrowed and improvised weapons.'
    : 'Nothing in your inventory is a weapon, so the whole list is offered. Buy one on the Gear tab and it moves to the top with a dot.' }));

  if (state.weaponId) {
    const def = weaponById(state.weaponId);
    const isMelee = def.skill === 'brawl' || def.skill === 'melee';
    if (isMelee) {
      body.append(el('p', { class: 'small muted', id: 'roller-range-note', text: 'A melee attack is always an Average check, whatever the range.' }));
    } else {
      const rangeSelect = el('select', {
        id: 'roller-range', 'aria-label': 'Range to the target',
        onchange: (e) => { chooseRangeBand(e.target.value); rerender(); }
      });
      RANGE_BANDS.forEach((r) => rangeSelect.append(el('option', {
        value: r.id, selected: state.rangeBand === r.id,
        text: `${r.name} — ${titleCase(rangedDifficultyFor(r.id))}`
      })));
      body.append(el('label', { class: 'small', for: 'roller-range', text: 'How far away are they?' }), rangeSelect);
      body.append(el('p', { class: 'small muted', text: `${def.name} is built for ${def.range} range. Further out the difficulty climbs on its own.` }));
    }
  }

  const targetSelect = el('select', {
    id: 'roller-target', 'aria-label': 'Target',
    onchange: (e) => { chooseTarget(e.target.value); rerender(); }
  });
  targetSelect.append(el('option', { value: '', text: combatants.length ? 'No particular target' : 'Nobody on the combat tracker', selected: !state.targetId }));
  combatants.forEach((c) => targetSelect.append(el('option', {
    value: c.id, selected: state.targetId === c.id,
    text: `${c.name}${c.minionCount ? ` ×${c.minionCount}` : ''} — soak ${c.soak}, wounds ${c.wounds}/${c.woundThreshold ?? '—'}`
  })));
  body.append(el('label', { class: 'small', for: 'roller-target', text: 'Who are you shooting at?' }), targetSelect);
  const target = currentTarget();
  if (target) {
    body.append(el('p', { class: 'small muted', id: 'roller-target-note', text:
      `Soak ${target.soak} comes off the damage; defence ${target.meleeDef}/${target.rangedDef}${target.adversary ? `, and Adversary ${target.adversary} upgrades this check ${target.adversary} time(s)` : ''}.` }));
  } else if (!combatants.length) {
    body.append(el('p', { class: 'small muted', text: 'Drop an opponent into the Combat screen and it can work out the damage for you.' }));
  }

  const active = [state.weaponId, state.targetId].filter(Boolean).length;
  return panel('What are you attacking with?', PANELS.rollAttack, [
    accordion('Weapon, range and target', [body], {
      key: 'roll-attack',
      summary: state.weaponId ? `${weaponById(state.weaponId).name}${target ? ` → ${target.name}` : ''}` : 'nothing chosen',
      defaultOpen: active > 0
    })
  ], { id: 'roll-attack' });
}

function diceToRoll(pool, notes) {
  const wrap = el('div', { class: 'dice-to-roll' });
  wrap.append(el('h3', { class: 'dice-to-roll-title', text: 'Dice to roll' }));
  const grid = el('div', { class: 'dice-grid' });
  DICE.forEach((die) => {
    const count = pool[die.id] || 0;
    grid.append(el('div', {
      class: `die-count die-${die.colour}${count ? '' : ' is-empty'}`,
      title: `${die.name}: a ${die.colour} ${die.sides}-sided die`
    }, [
      el('span', { class: 'die-count-value', text: String(count) }),
      el('span', { class: 'die-count-name', text: die.name }),
      el('span', { class: 'die-count-sides', text: `d${die.sides}` })
    ]));
  });
  wrap.append(grid);
  const total = DICE.reduce((sum, die) => sum + (pool[die.id] || 0), 0);
  wrap.append(el('p', { class: 'small muted', text: total ? `${total} ${total === 1 ? 'die' : 'dice'} in total.` : 'No dice yet — pick a skill and a difficulty.' }));
  if (notes.length) {
    wrap.append(accordion('Why these dice', [el('ul', { class: 'small muted' }, notes.map((n) => el('li', { text: n })))],
      { key: 'roll-why', summary: `${notes.length} reason${notes.length === 1 ? '' : 's'}` }));
  }
  return wrap;
}

/** What the app rolled, read-only: one row per symbol that actually came up, with its
 *  count and what it does. Symbols at zero are left out entirely. */
function rolledSymbols(entered) {
  const wrap = el('div', { class: 'rolled-symbols', id: 'rolled-symbols', 'aria-live': 'polite' });
  const shown = SYMBOL_ORDER.filter((sym) => entered[sym] > 0);
  if (!shown.length) {
    wrap.append(el('p', { class: 'small muted', text: 'Nothing rolled yet — tap "Roll this pool" above.' }));
    return wrap;
  }
  shown.forEach((sym) => {
    wrap.append(el('div', { class: 'rolled-row' }, [
      symbolGlyph(sym, entered[sym]),
      el('span', { class: 'toggle-desc', text: SYMBOL_HELP[sym] })
    ]));
  });
  return wrap;
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

function toggle(id, label, value, onChange) {
  return el('div', { class: 'toggle-row' }, [
    el('input', { type: 'checkbox', id, checked: value, onchange: (e) => onChange(e.target.checked) }),
    el('label', { for: id }, [el('span', { text: label })])
  ]);
}

/** Label above, narrow input below: a long label never squeezes the field into a column. */
function numberField(id, label, value, onChange, { min = 0, max = 5, hint = '' } = {}) {
  return el('div', { class: 'field' }, [
    el('label', { class: 'field-label', for: id, text: label }),
    hint ? el('span', { class: 'toggle-desc', text: hint }) : null,
    el('input', {
      class: 'field-input', type: 'number', id, min: String(min), max: String(max), inputmode: 'numeric',
      value: String(value), onchange: (e) => onChange(Number(e.target.value))
    })
  ]);
}
