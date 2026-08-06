// solo.js — the solo assistant. Official rules only (§18–§20, §23), so this tab is real
// rather than invented; it stays behind the soloMode flag.

import { el, clear, titleCase, rollDie, newTally, outcome, uid, STORAGE_PREFIX } from './core.js';
import { showToast, modal, confirmModal, renderTally, panel, accordion, emptyState, symbolGlyph } from './ui.js';
import { PANELS } from './help.js';
import { ORACLE, MEANING, ELEMENTS, RANDOM_EVENT, SOLO_LOOP } from '../data-solo.js';
import { SYMBOLS } from '../data.js';
import { NPC_QUICKGEN } from '../data-npcs.js';
import { RANDOM_ENCOUNTERS, MINION_GROUPS } from '../data-monsters.js';
import { activeCharacter, getCell } from './store.js';
import { applyPersonalHeat } from './heat.js';
import { rollPool, diceToRoll, SYMBOL_HELP } from './roller.js';
import { Settings } from './settings.js';

// The Oracle pool is Ability against Difficulty, and per D§ neither die carries a Triumph
// or a Despair, so the hand-entry pad does not offer symbols that cannot come up (R-22).
const ORACLE_SYMBOLS = SYMBOLS
  .filter((s) => !['triumph', 'despair'].includes(s.id))
  .map((s) => s.id);

// The entered tally lives at module scope so it survives navigation, the way the Roll
// screen's does — an Oracle question part-way through entry is not lost by tapping Home.
const state = { likelihood: 'fiftyFifty', surveilled: false, entered: newTally(), lastAnswer: null };

// --- the Oracle's own log ---
// Oracle answers are their own kind of record, so they live apart from the Roll screen's
// check log rather than filling it with rows that have no skill and no difficulty.
const ORACLE_LOG_KEY = STORAGE_PREFIX + 'oracleLog';
const ORACLE_LOG_CAP = 100;
const ORACLE_LOG_PAGE = 12;
let oracleShown = ORACLE_LOG_PAGE;

export function readOracleLog() {
  try { return JSON.parse(localStorage.getItem(ORACLE_LOG_KEY) || '[]'); } catch { return []; }
}

export function writeOracleLog(entry) {
  const log = readOracleLog();
  const stored = { id: uid(), ...entry };
  log.unshift(stored);
  localStorage.setItem(ORACLE_LOG_KEY, JSON.stringify(log.slice(0, ORACLE_LOG_CAP)));
  return stored;
}

export function deleteOracleLogEntry(id) {
  const log = readOracleLog().filter((e) => e.id !== id);
  localStorage.setItem(ORACLE_LOG_KEY, JSON.stringify(log));
  return log;
}

export function clearOracleLog() { localStorage.removeItem(ORACLE_LOG_KEY); }

/** The pool the chosen likelihood asks for (§18), in the same shape the roller uses. */
export function oraclePool(likelihoodId = state.likelihood) {
  const l = ORACLE.likelihoods.find((x) => x.id === likelihoodId) || ORACLE.likelihoods[1];
  return { ability: l.ability, proficiency: 0, difficulty: l.difficulty, challenge: 0, boost: 0, setback: 0 };
}

/** How hard the answer lands, and what rides along with it (R-22). The direction comes from
 *  the rungs below; this grades it by how many symbols survived cancelling. */
export function oracleIntensity(result, answerId) {
  const yes = answerId.startsWith('yes');
  const weight = yes ? result.netSuccess : result.netFailure;
  const level = [...ORACLE.intensity.levels].reverse().find((l) => weight >= l.min);
  const riderCount = yes ? result.netThreat : result.netAdvantage;
  const rider = riderCount > 0
    ? [...ORACLE.intensity.riders].reverse().find((r) => riderCount >= r.min)
    : null;
  return {
    weight,
    level: level.id,
    note: level.note,
    rider: rider ? {
      count: riderCount,
      id: rider.id,
      text: (yes ? ORACLE.intensity.riderNote.threat : ORACLE.intensity.riderNote.advantage)
        .replace('{x}', yes ? rider.againstYou : rider.yourWay)
    } : null
  };
}

/** The Oracle answers from entered symbols, exactly like every other check (R-B1). */
export function interpretOracle(tally) {
  const result = outcome(tally);
  const emphatic = ORACLE.magnitude.andThreshold;
  // R-22 — the printed Oracle pool holds no Proficiency or Challenge die, so it can never
  // roll the Triumph or Despair §18.1 keys these two rows to. An emphatic result stands in
  // for the symbol; a symbol that does occur on an upgraded pool still reads the same way.
  const rung = (() => {
    if (result.triumph > 0) return { answer: 'Yes, and…', id: 'yesAnd', event: true };
    if (result.despair > 0) return { answer: 'No, and…', id: 'noAnd', event: true };
    if (result.netSuccess >= emphatic && result.netThreat === 0) return { answer: 'Yes, and…', id: 'yesAnd', event: true, byMagnitude: true };
    if (result.netFailure >= emphatic && result.netAdvantage === 0) return { answer: 'No, and…', id: 'noAnd', event: true, byMagnitude: true };
    if (result.success) return { answer: 'Yes', id: 'yes', event: false };
    if (result.netFailure > 0) return { answer: 'No', id: 'no', event: false };
    if (result.netAdvantage > 0) return { answer: 'Yes, but…', id: 'yesBut', event: false };
    if (result.netThreat > 0) return { answer: 'No, but…', id: 'noBut', event: false };
    return { answer: 'No', id: 'no', event: false };
  })();
  return { ...rung, result, intensity: oracleIntensity(result, rung.id) };
}

export function rollRandomEvent() {
  const categoryRoll = rollDie(10);
  const subjectRoll = rollDie(10);
  const category = RANDOM_EVENT.category.find((r) => categoryRoll >= r.min && categoryRoll <= r.max);
  const subject = RANDOM_EVENT.subject.find((r) => subjectRoll >= r.min && subjectRoll <= r.max);
  const out = { categoryRoll, subjectRoll, category: category.entry, subject: subject.entry };
  if (category.pairsWith === 'complication') {
    const roll = rollDie(10);
    out.complication = ELEMENTS.complication.find((r) => r.roll === roll).entry;
  }
  return out;
}

export function rollMeaning() {
  const a = rollDie(10);
  const s = rollDie(10);
  return {
    actionRoll: a, subjectRoll: s,
    phrase: `${MEANING.action.find((r) => r.roll === a).word} — ${MEANING.subject.find((r) => r.roll === s).word.toLowerCase()}`
  };
}

export function rollElement(kind) {
  const roll = rollDie(10);
  return { roll, entry: ELEMENTS[kind].find((r) => r.roll === roll).entry };
}

/** Passive Watch (B§2): a scene-start Oracle roll for the Informant Network, Unlikely by
 *  default and more likely when Heat has risen recently. */
export function passiveWatchLikelihood(character, cell) {
  const heat = Math.max(character ? character.state.personalHeat : 0, cell ? cell.cellHeat : 0);
  if (heat >= 4) return 'likely';
  if (heat >= 2) return 'fiftyFifty';
  return 'unlikely';
}

export function renderSolo(mount) {
  clear(mount);
  const rerender = () => renderSolo(mount);
  const character = activeCharacter();
  const cell = getCell();

  // --- Oracle ---
  const oracleCard = panel('Ask the Oracle', PANELS.soloOracle, []);
  const likelihood = el('select', { id: 'oracle-likelihood', 'aria-label': 'Likelihood', onchange: (e) => { state.likelihood = e.target.value; rerender(); } });
  ORACLE.likelihoods.forEach((l) => likelihood.append(el('option', {
    value: l.id, selected: state.likelihood === l.id,
    text: `${l.name} — ${l.ability} Ability vs ${l.difficulty} Difficulty`
  })));
  oracleCard.append(el('label', { class: 'small', for: 'oracle-likelihood', text: 'Likelihood' }), likelihood);
  oracleCard.append(el('div', { class: 'toggle-row' }, [
    el('input', { type: 'checkbox', id: 'oracle-surveilled', checked: state.surveilled, onchange: (e) => { state.surveilled = e.target.checked; } }),
    el('label', { for: 'oracle-surveilled' }, [el('span', { text: 'The question concerns somewhere the regime is watching, so an emphatic no draws attention' })])
  ]));

  // One button: it rolls the pool, shows what came up, and gives the answer. The Oracle is
  // the GM's die, not the character's, so the app rolls it — with a fallback below for
  // anyone using physical dice.
  const pool = oraclePool();
  // The likelihood picker above already says why the pool is what it is, and R-22's
  // substitution is stated in the panel's own "how this works" (§4).
  oracleCard.append(diceToRoll(pool, []));

  const answerNode = el('div', { id: 'oracle-answer', 'aria-live': 'polite' });
  const ask = (tally, { rolled = true } = {}) => {
    const verdict = interpretOracle(tally);
    const lines = [];

    // The Heat hook rides on the "No, and…" rung, however it was reached (R-22).
    if (state.surveilled && verdict.id === 'noAnd' && character) {
      const applied = applyPersonalHeat(character, 1, 'An emphatic no from the Oracle in a watched place');
      lines.push(`${verdict.byMagnitude ? 'An emphatic no' : 'Despair'} in a surveilled context: Personal Heat ${applied.before} → ${applied.after}.`);
      document.dispatchEvent(new CustomEvent('resource:refresh'));
    }
    let event = null;
    if (verdict.event) {
      event = rollRandomEvent();
      lines.push(`Random Event: ${event.category} (${event.categoryRoll}) concerning ${event.subject.toLowerCase()} (${event.subjectRoll}).${event.complication ? ` Complication: ${event.complication}.` : ''} ${RANDOM_EVENT.skewByAnswer[verdict.id] || ''}`);
    }

    writeOracleLog({
      ts: Date.now(),
      likelihood: state.likelihood,
      likelihoodName: ORACLE.likelihoods.find((l) => l.id === state.likelihood).name,
      pool: { ...pool },
      symbols: { ...tally },
      net: verdict.result.net,
      answer: verdict.answer,
      answerId: verdict.id,
      intensity: verdict.intensity,
      surveilled: state.surveilled,
      rolledByApp: rolled,
      lines
    });
    state.lastAnswer = {
      answer: verdict.answer, net: verdict.result.net, symbols: { ...tally },
      intensity: verdict.intensity, lines
    };
    state.entered = newTally();
    rerender();
  };

  oracleCard.append(el('button', {
    type: 'button', class: 'primary', id: 'oracle-ask', text: 'Ask the Oracle',
    onclick: () => {
      const rolled = rollPool(pool);
      if (!rolled.ok) { showToast(rolled.reason); return; }
      ask(rolled.tally, { rolled: true });
    }
  }));

  // The last answer stays on screen: what the dice showed, then what it means.
  if (state.lastAnswer) {
    // The answer, then one plain sentence saying how hard it landed, then the string
    // attached if there is one. No grading word on screen — it says what happened (R-22a).
    answerNode.append(el('h3', { text: state.lastAnswer.answer }));
    const power = state.lastAnswer.intensity;
    if (power) {
      answerNode.append(el('p', { class: 'oracle-degree', text: power.note }));
      if (power.rider) answerNode.append(el('p', { class: 'oracle-rider', text: power.rider.text }));
    }
    // The dice are evidence, not the answer, so they fold away under it.
    answerNode.append(accordion('Show the dice', [
      el('p', { class: 'small muted', text: 'What came up' }),
      el('p', {}, [renderTally(state.lastAnswer.symbols || {})]),
      el('p', { class: 'small muted', text: 'What is left after cancelling' }),
      el('p', {}, [renderTally(state.lastAnswer.net)])
    ], { key: 'oracle-dice', summary: 'what came up' }));
    (state.lastAnswer.lines || []).forEach((line) => answerNode.append(el('p', { class: 'small', text: line })));
  }
  oracleCard.append(answerNode);

  // Physical dice: the pad is still here for anyone who would rather roll their own (R-B1).
  const padBody = el('div', {});
  ORACLE_SYMBOLS.forEach((sym) => {
    padBody.append(el('div', { class: 'toggle-row' }, [
      el('label', { for: `oracle-${sym}` }, [
        symbolGlyph(sym, state.entered[sym]),
        el('span', { class: 'toggle-desc', text: SYMBOL_HELP[sym] })
      ]),
      el('button', { type: 'button', class: 'secondary', text: '−', 'aria-label': `One less oracle ${sym}`, onclick: () => { state.entered[sym] = Math.max(0, state.entered[sym] - 1); rerender(); } }),
      el('span', { id: `oracle-${sym}`, class: 'stat-value', text: String(state.entered[sym]) }),
      el('button', { type: 'button', class: 'secondary', text: '+', 'aria-label': `One more oracle ${sym}`, onclick: () => { state.entered[sym] += 1; rerender(); } })
    ]));
  });
  padBody.append(el('button', {
    type: 'button', class: 'secondary', id: 'oracle-ask-entered', text: 'Answer from these symbols',
    disabled: !Object.values(state.entered).some((n) => n > 0),
    onclick: () => ask(state.entered, { rolled: false })
  }));
  oracleCard.append(accordion('I rolled my own dice', [padBody], {
    key: 'oracle-manual', summary: 'tap in what came up'
  }));

  mount.append(oracleCard);

  // --- tables ---
  const tables = panel('Need an idea?', PANELS.soloTables, []);
  const output = el('div', { id: 'solo-output', 'aria-live': 'polite' });
  const show = (title, text) => { clear(output); output.append(el('h3', { text: title }), el('p', { class: 'small', text })); };

  tables.append(el('button', { type: 'button', class: 'secondary', text: 'Meaning', onclick: () => { const r = rollMeaning(); show('Meaning', `${r.phrase} (${r.actionRoll}, ${r.subjectRoll})`); } }));
  ['location', 'faction', 'complication'].forEach((kind) => {
    tables.append(el('button', {
      type: 'button', class: 'secondary', text: `${titleCase(kind)}`,
      onclick: () => { const r = rollElement(kind); show(titleCase(kind), `${r.entry} (${r.roll})`); }
    }));
  });
  tables.append(el('button', { type: 'button', class: 'secondary', text: 'Random Event', onclick: () => { const e = rollRandomEvent(); show('Random Event', `${e.category} (${e.categoryRoll}) concerning ${e.subject.toLowerCase()} (${e.subjectRoll}).${e.complication ? ` Complication: ${e.complication}.` : ''}`); } }));
  tables.append(el('button', {
    type: 'button', class: 'secondary', text: 'NPC quick-gen',
    onclick: () => {
      const a = rollDie(10), d = rollDie(10);
      const archetype = NPC_QUICKGEN.archetype.find((r) => a >= r.min && a <= r.max);
      const disposition = NPC_QUICKGEN.disposition.find((r) => d >= r.min && d <= r.max);
      show('NPC quick-gen', `${archetype.name} (${a}), ${disposition.name} (${d}). Build as ${archetype.tier}.`);
    }
  }));
  tables.append(el('button', {
    type: 'button', class: 'secondary', text: 'Random encounter',
    onclick: () => {
      const roll = rollDie(10);
      const row = RANDOM_ENCOUNTERS.table.find((r) => r.roll === roll);
      const escalate = roll === 10 && cell.cellHeat >= 4 ? ' Cell Heat is 4 or more — escalate toward a nemesis.' : '';
      show('Random encounter', `${row.entry} (${roll}).${escalate}`);
    }
  }));
  tables.append(output);
  mount.append(tables);

  // --- the Oracle's own log ---
  const log = readOracleLog();
  const shown = log.slice(0, oracleShown);
  const logCard = panel('Questions you have asked', PANELS.soloLog, [], { id: 'oracle-log' });
  if (!log.length) {
    logCard.append(emptyState('Nothing asked yet — put a question to the Oracle and it lands here.'));
  } else {
    logCard.append(el('button', {
      type: 'button', class: 'secondary', id: 'oracle-log-clear', text: `Clear all ${log.length}`,
      onclick: async () => {
        if (!(await confirmModal(`Delete all ${log.length} Oracle answers? This cannot be undone.`, { title: 'Clear the Oracle log', confirmLabel: 'Delete them' }))) return;
        clearOracleLog();
        oracleShown = ORACLE_LOG_PAGE;
        rerender();
      }
    }));
    shown.forEach((item) => {
      const row = el('div', { class: 'result log-row' }, [
        el('div', { class: 'result-head' }, [
          el('span', { class: 'result-title', text: item.answer }),
          el('span', { class: 'cite', text: new Date(item.ts).toLocaleTimeString() })
        ]),
        el('div', { class: 'log-symbols' }, [renderTally(item.net || {})])
      ]);
      // The row reads back the way it played: the answer, then how hard it landed.
      if (item.intensity) {
        row.append(el('p', { class: 'small', text: item.intensity.note }));
        if (item.intensity.rider) row.append(el('p', { class: 'small', text: item.intensity.rider.text }));
      }
      if (item.surveilled) row.append(el('p', { class: 'small muted', text: 'Asked about somewhere the regime is watching.' }));
      (item.lines || []).forEach((line) => row.append(el('p', { class: 'small muted', text: line })));
      row.append(el('button', {
        type: 'button', class: 'secondary log-delete', text: 'Delete',
        'aria-label': `Delete the ${item.likelihoodName} question answered ${item.answer} at ${new Date(item.ts).toLocaleTimeString()}`,
        onclick: () => { deleteOracleLogEntry(item.id); rerender(); }
      }));
      logCard.append(row);
    });
    if (log.length > shown.length) {
      logCard.append(el('button', {
        type: 'button', class: 'secondary', id: 'oracle-log-more',
        text: `Show more (${log.length - shown.length} older)`,
        onclick: () => { oracleShown += ORACLE_LOG_PAGE; rerender(); }
      }));
    }
  }
  mount.append(logCard);

  // --- scene start: Passive Watch (B§2) ---
  const watchLikelihood = passiveWatchLikelihood(character, cell);
  const network = MINION_GROUPS.find((m) => m.id === 'informantNetwork');
  mount.append(el('div', { class: 'card' }, [
    el('h2', { text: 'Scene start' }),
    el('p', { class: 'small muted', text: `${network.name}: ${network.hook}` }),
    el('p', { class: 'small', text: `Passive Watch is an Oracle roll at ${ORACLE.likelihoods.find((l) => l.id === watchLikelihood).name} given the current Heat.` })
  ]));

  // --- Heat 4+ raid timing (§23) ---
  if (character && character.state.personalHeat >= SOLO_LOOP.heatRule.fromLevel) {
    mount.append(el('div', { class: 'card' }, [
      el('h2', { text: 'Raid timing' }),
      el('p', { class: 'small', text: SOLO_LOOP.heatRule.note }),
      el('p', { class: 'small muted', text: `Personal Heat ${character.state.personalHeat}: ask the Oracle whether the raid lands this scene rather than deciding it.` })
    ]));
  }

  // --- the loop itself ---
  mount.append(el('div', { class: 'card' }, [
    el('h2', { text: 'Solo loop' }),
    el('ol', { class: 'small' }, SOLO_LOOP.steps.map((s) => el('li', { text: s })))
  ]));
}
