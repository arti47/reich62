// solo.js — the solo assistant. Official rules only (§18–§20, §23), so this tab is real
// rather than invented; it stays behind the soloMode flag.

import { el, clear, titleCase, rollDie, newTally, outcome, uid, STORAGE_PREFIX } from './core.js';
import { showToast, modal, confirmModal, renderTally, panel, accordion, emptyState, symbolGlyph } from './ui.js';
import { PANELS } from './help.js';
import { ORACLE, MEANING, ELEMENTS, RANDOM_EVENT, SOLO_LOOP, FATE_FOCUS } from '../data-solo.js';
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
const state = { likelihood: 'fiftyFifty', surveilled: false, expectation: '', entered: newTally(), lastAnswer: null };

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

// --- the prompt tables' log ---
// A rolled prompt is as much a record of play as an Oracle answer: it seeds a scene, and
// losing it the moment you roll the next one means writing it down by hand. It keeps its
// own log rather than crowding the Oracle's.
const IDEA_LOG_KEY = STORAGE_PREFIX + 'ideaLog';
const IDEA_LOG_CAP = 100;
const IDEA_LOG_PAGE = 12;
let ideaShown = IDEA_LOG_PAGE;

export function readIdeaLog() {
  try { return JSON.parse(localStorage.getItem(IDEA_LOG_KEY) || '[]'); } catch { return []; }
}

export function writeIdeaLog(entry) {
  const log = readIdeaLog();
  const stored = { id: uid(), ts: Date.now(), ...entry };
  log.unshift(stored);
  localStorage.setItem(IDEA_LOG_KEY, JSON.stringify(log.slice(0, IDEA_LOG_CAP)));
  return stored;
}

export function deleteIdeaLogEntry(id) {
  const log = readIdeaLog().filter((e) => e.id !== id);
  localStorage.setItem(IDEA_LOG_KEY, JSON.stringify(log));
  return log;
}

export function clearIdeaLog() { localStorage.removeItem(IDEA_LOG_KEY); }

/** The pool the chosen likelihood asks for (§18), in the same shape the roller uses. */
export function oraclePool(likelihoodId = state.likelihood) {
  const l = ORACLE.likelihoods.find((x) => x.id === likelihoodId) || ORACLE.likelihoods[1];
  return { ability: l.ability, proficiency: 0, difficulty: l.difficulty, challenge: 0, boost: 0, setback: 0 };
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
  return { ...rung, result };
}

/** The chaos dial for the "let chaos decide" band: the higher of the two suspicion tracks,
 *  doubled to cover the whole d10 (H-2). Heat 0 never turns the answer against you; Heat 5
 *  always does. */
export function focusChaos(character, cell) {
  const heat = Math.max(character ? (character.state.personalHeat || 0) : 0, cell ? (cell.cellHeat || 0) : 0);
  return heat * FATE_FOCUS.chaos.multiplier;
}

/** A band name already ending in punctuation ("As expected, but…") must not collect a
 *  second full stop when the note is joined onto it. */
export const focusHeading = (name) => (/[.!?…]$/.test(name) ? `${name} ` : `${name}. `);

const NET_MIN = Math.min(...FATE_FOCUS.bands.map((b) => b.net));
const NET_MAX = Math.max(...FATE_FOCUS.bands.map((b) => b.net));
const focusBand = (net) =>
  FATE_FOCUS.bands.find((b) => b.net === Math.max(NET_MIN, Math.min(NET_MAX, net)));

/** How to read the answer against what you expected (H-2), taken off the same roll: the
 *  Advantage and Threat the answer did not use. The sign says whose way it goes, the size
 *  how far from expectation it lands. Nothing extra is thrown except the suspicion die on
 *  the one result that says nothing either way. */
export function readFocus(result, { chaos = 0, chaosRoll = null } = {}) {
  const net = (result.netAdvantage || 0) - (result.netThreat || 0);
  let band = focusBand(net);
  const out = { net, chainsEvent: !!band.chainsEvent };

  if (band.chaosMayBend && chaos > 0) {
    const d10 = chaosRoll || rollDie(FATE_FOCUS.chaos.dieSides || 10);
    out.chaosRoll = d10;
    out.chaos = chaos;
    if (d10 <= chaos) {
      out.bentBySuspicion = true;
      band = FATE_FOCUS.bands.find((b) => b.id === FATE_FOCUS.chaos.bendsTo);
      out.chainsEvent = !!band.chainsEvent;
    }
  }

  out.id = band.id;
  out.name = band.name;
  out.note = band.note;
  return out;
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
  // What you expect is what the focus reads against, so it is captured with the question
  // rather than held in your head (H-2). Optional — blank still works.
  if (Settings.fateFocus()) {
    oracleCard.append(el('label', { class: 'small', for: 'oracle-expectation', text: 'What do you expect?' }));
    oracleCard.append(el('input', {
      type: 'text', id: 'oracle-expectation', value: state.expectation,
      placeholder: 'He waves me through', 'aria-label': 'What do you expect the answer to be',
      oninput: (e) => { state.expectation = e.target.value; }
    }));
  }

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
    // How to read that answer against what you expected (H-2).
    const focus = Settings.fateFocus()
      ? readFocus(verdict.result, { chaos: focusChaos(character, cell) })
      : null;

    // One event per question: either trigger fires it, never both (H-2).
    let event = null;
    if (verdict.event || (focus && focus.chainsEvent)) {
      event = rollRandomEvent();
      lines.push(`Random Event: ${event.category} (${event.categoryRoll}) concerning ${event.subject.toLowerCase()} (${event.subjectRoll}).${event.complication ? ` Complication: ${event.complication}.` : ''} ${verdict.event ? (RANDOM_EVENT.skewByAnswer[verdict.id] || '') : ''}`);
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
      focus,
      expectation: state.expectation,
      surveilled: state.surveilled,
      rolledByApp: rolled,
      lines
    });
    state.lastAnswer = {
      answer: verdict.answer, net: verdict.result.net, symbols: { ...tally },
      focus, expectation: state.expectation, lines
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
    const focused = state.lastAnswer.focus;
    // The focus is the reading: how this answer sits against what you were expecting (H-2).
    if (focused) {
      if (state.lastAnswer.expectation) {
        answerNode.append(el('p', { class: 'small muted', text: `You expected: ${state.lastAnswer.expectation}` }));
      }
      answerNode.append(el('p', { class: 'oracle-focus' }, [
        el('strong', { text: focusHeading(focused.name) }), focused.note
      ]));
    }
    // Strength, the catch and the dice are all evidence for the answer above, so they fold
    // away under it rather than crowding it.
    const evidence = [];
    evidence.push(el('p', { class: 'small muted', text: 'What came up' }));
    evidence.push(el('p', {}, [renderTally(state.lastAnswer.symbols || {})]));
    evidence.push(el('p', { class: 'small muted', text: 'What is left after cancelling' }));
    evidence.push(el('p', {}, [renderTally(state.lastAnswer.net)]));
    if (focused && focused.chaosRoll) {
      evidence.push(el('p', { class: 'small muted', text: `Nothing was left over either way, so suspicion decided it: rolled ${focused.chaosRoll} against ${focused.chaos}.` }));
    }
    answerNode.append(accordion('Show the dice', evidence, { key: 'oracle-dice', summary: 'how it landed' }));
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
  // A rolled prompt is written to its own log rather than replacing the last one on screen.
  const show = (table, text) => { writeIdeaLog({ table, text }); ideaShown = IDEA_LOG_PAGE; rerender(); };

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

  // Everything rolled here, newest first, kept until you clear it.
  const ideas = readIdeaLog();
  const ideaBody = el('div', { id: 'solo-output', 'aria-live': 'polite' });
  if (!ideas.length) {
    ideaBody.append(emptyState('Nothing rolled yet — tap a table above and it lands here.'));
  } else {
    tables.append(el('button', {
      type: 'button', class: 'secondary', id: 'idea-log-clear', text: `Clear all ${ideas.length}`,
      onclick: async () => {
        if (!(await confirmModal(`Delete all ${ideas.length} rolled prompts? This cannot be undone.`, { title: 'Clear the prompts', confirmLabel: 'Delete them' }))) return;
        clearIdeaLog();
        ideaShown = IDEA_LOG_PAGE;
        rerender();
      }
    }));
  }
  ideas.slice(0, ideaShown).forEach((item) => {
    ideaBody.append(el('div', { class: 'result log-row' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: item.table }),
        el('span', { class: 'cite', text: new Date(item.ts).toLocaleTimeString() })
      ]),
      el('p', { class: 'small', text: item.text }),
      el('button', {
        type: 'button', class: 'secondary log-delete', text: 'Delete',
        'aria-label': `Delete the ${item.table} prompt rolled at ${new Date(item.ts).toLocaleTimeString()}`,
        onclick: () => { deleteIdeaLogEntry(item.id); rerender(); }
      })
    ]));
  });
  tables.append(ideaBody);
  if (ideas.length > ideaShown) {
    tables.append(el('button', {
      type: 'button', class: 'secondary', id: 'idea-log-more',
      text: `Show ${Math.min(IDEA_LOG_PAGE, ideas.length - ideaShown)} more of ${ideas.length - ideaShown}`,
      onclick: () => { ideaShown += IDEA_LOG_PAGE; rerender(); }
    }));
  }
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
      if (item.expectation) row.append(el('p', { class: 'small muted', text: `You expected: ${item.expectation}` }));
      if (item.focus) row.append(el('p', { class: 'small', text: `${focusHeading(item.focus.name)}${item.focus.note}` }));
      // The row reads back the way it played: the answer, then how hard it landed.
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
