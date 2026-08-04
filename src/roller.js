// roller.js — the dice engine.
// R-B1: the manual never prints die face distributions, so manual symbol entry is the
// primary and default input. The app builds the pool, enforces the modification order,
// cancels symbols, applies spends, damage, Critical Injuries and Heat, and writes the log.

import { el, clear, titleCase, newTally, cancel, outcome, rollDie, clamp } from './core.js';
import { showToast, renderTally, modal } from './ui.js';
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
  context: 'combat',
  spendTriumphOnHeat: false
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

  if (character) {
    // Conditions that add dice.
    Object.entries(character.state.conditions || {}).forEach(([id, on]) => {
      if (on && id === 'disoriented') { modifications.push({ stage: 'add', die: 'setback', count: 1 }); notes.push('Disoriented adds 1 Setback (R-7)'); }
    });
    // Encumbrance (§5F).
    const enc = encumbranceState(character);
    if (enc.setbackDice && skillDef && ['brawn', 'agility'].includes(skillDef.characteristic)) {
      modifications.push({ stage: 'add', die: 'setback', count: enc.setbackDice });
      notes.push(`Encumbered by ${enc.over}: ${enc.setbackDice} Setback on Brawn and Agility checks (§5F)`);
    }
    // Heat thresholds (§17.3).
    const cell = getCell();
    const heatDice = heatSetbackDice({ personalHeat: character.state.personalHeat, cellHeat: cell.cellHeat, isPublicCheck: state.publicCheck });
    if (heatDice) {
      modifications.push({ stage: 'add', die: 'setback', count: heatDice });
      notes.push(`Heat adds ${heatDice} Setback on public checks (§17.3)`);
    }
  }

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

  const setup = el('div', { class: 'card' }, [el('h2', { text: 'Check' })]);

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
  setup.append(toggle('roller-public', 'Public check (Heat Setbacks apply)', state.publicCheck, (v) => { state.publicCheck = v; rerender(); }));
  mount.append(setup);

  const { pool, notes } = assemblePool(character);
  const poolCard = el('div', { class: 'card' }, [
    el('h3', { text: 'Pool' }),
    el('p', { class: 'dice-glyph', text: describePool(pool) }),
    el('ul', { class: 'small muted' }, notes.map((n) => el('li', { text: n })))
  ]);
  mount.append(poolCard);

  const entry = el('div', { class: 'card' }, [
    el('h3', { text: 'Enter the symbols you rolled' }),
    el('p', { class: 'small' }, [
      el('span', { class: 'badge badge-inferred', text: 'R-B1' }), ' ',
      DIE_FACES === null
        ? 'The manual never prints die face distributions, so the app cannot roll these dice for you. Roll them physically and tap what came up — everything after that is automatic.'
        : 'Face data is present; the simulated roller can be enabled in Settings.'
    ])
  ]);
  ['success', 'advantage', 'triumph', 'failure', 'threat', 'despair'].forEach((sym) => {
    entry.append(el('div', { class: 'toggle-row' }, [
      el('label', { for: `sym-${sym}` }, [el('span', { text: titleCase(sym) })]),
      el('button', { type: 'button', class: 'secondary', text: '−', 'aria-label': `One less ${sym}`, onclick: () => { state.entered[sym] = Math.max(0, state.entered[sym] - 1); rerender(); } }),
      el('span', { id: `sym-${sym}`, class: 'stat-value', text: String(state.entered[sym]) }),
      el('button', { type: 'button', class: 'secondary', text: '+', 'aria-label': `One more ${sym}`, onclick: () => { state.entered[sym] += 1; rerender(); } })
    ]));
  });
  mount.append(entry);

  const { result, heat } = resolve(character);
  const resultCard = el('div', { class: 'card', id: 'roll-result', 'aria-live': 'polite' }, [
    el('h3', { text: result.success ? 'Success' : 'Failure' }),
    el('p', {}, [renderTally(result.net)]),
    heat.reasons.length ? el('ul', { class: 'small' }, heat.reasons.map((r) => el('li', { text: r }))) : null
  ]);

  const spends = availableSpends(state.context, result.net);
  if (spends.length) {
    resultCard.append(el('h3', { text: 'Spends available' }));
    spends.slice(0, 8).forEach((row) => {
      resultCard.append(el('div', { class: 'result' }, [
        el('div', { class: 'result-head' }, [
          el('span', { class: 'result-title', text: row.effects[0] }),
          el('span', { class: 'cite', text: row.payWith === 'triumph' ? '1 Triumph' : row.payWith === 'despair' ? '1 Despair' : `${row.cost} ${row.payWith}` })
        ]),
        row.effects.length > 1 ? el('div', { class: 'result-body', text: row.effects.slice(1).join(' · ') }) : null
      ]));
    });
  }

  resultCard.append(el('button', {
    type: 'button', class: 'primary', text: 'Log this check',
    onclick: () => {
      const committed = commit(character);
      let message = `Logged: ${committed.entry.outcome}`;
      if (committed.heatApplied) message += ` · Personal Heat ${committed.heatApplied.before} → ${committed.heatApplied.after}`;
      showToast(message);
      state.entered = newTally();
      rerender();
      document.dispatchEvent(new CustomEvent('resource:refresh'));
    }
  }));
  resultCard.append(el('button', { type: 'button', class: 'secondary', text: 'Clear symbols', onclick: () => { state.entered = newTally(); rerender(); } }));
  mount.append(resultCard);

  const log = readLog().slice(0, 12);
  const logCard = el('div', { class: 'card' }, [el('h3', { text: 'Roll log' })]);
  if (!log.length) logCard.append(el('p', { class: 'muted small', text: 'Nothing logged yet.' }));
  log.forEach((item) => {
    logCard.append(el('div', { class: 'result' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: `${titleCase(item.skill)} — ${item.outcome}` }),
        el('span', { class: 'cite', text: new Date(item.ts).toLocaleTimeString() })
      ]),
      el('div', { class: 'result-body', text: `Pool ${describePool(item.poolInputs)} · entered ${describeTally(item.symbols)} · net ${describeTally(item.net)}${item.heatDelta ? ` · Heat ${item.heatDelta > 0 ? '+' : ''}${item.heatDelta}` : ''}` })
    ]));
  });
  mount.append(logCard);
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
