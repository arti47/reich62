// solo.js — the solo assistant. Official rules only (§18–§20, §23), so this tab is real
// rather than invented; it stays behind the soloMode flag.

import { el, clear, titleCase, rollDie, newTally, outcome, uid, STORAGE_PREFIX } from './core.js';
import { showToast, modal, confirmModal, renderTally, panel, accordion, emptyState, outcomeBox, symbolGlyph } from './ui.js';
import { PANELS } from './help.js';
import { ORACLE, MEANING, ELEMENTS, RANDOM_EVENT, SOLO_LOOP, FATE_FOCUS } from '../data-solo.js';
import { SYMBOLS } from '../data.js';
import { NPC_QUICKGEN } from '../data-npcs.js';
import { RANDOM_ENCOUNTERS } from '../data-monsters.js';
import { activeCharacter, getCell, sceneWatched, setSceneWatched } from './store.js';
import { applyPersonalHeat } from './heat.js';
import { rollPool, diceToRoll, SYMBOL_HELP } from './roller.js';
import { renderClocks, listClocks, applyCheckToClock } from './clocks.js';
import { previewBoundary, fireBoundary, undoLastBoundary } from './combat.js';
import { HEAT } from '../data.js';
import { Settings } from './settings.js';

// The Oracle pool is Ability against Difficulty, and per D§ neither die carries a Triumph
// or a Despair, so the hand-entry pad does not offer symbols that cannot come up (R-22).
const ORACLE_SYMBOLS = SYMBOLS
  .filter((s) => !['triumph', 'despair'].includes(s.id))
  .map((s) => s.id);

// The entered tally lives at module scope so it survives navigation, the way the Roll
// screen's does — an Oracle question part-way through entry is not lost by tapping Home.
const state = { likelihood: 'fiftyFifty', surveilled: false, expectation: '', entered: newTally(), lastAnswer: null, clockId: null };

// The scene boundary is fired from this screen too, so a solo player never has to open the
// combat tracker to close a scene (§23 step 7). Its outcome stays on screen with the undo.
let lastScene = null;

/** What on this screen belonged to the scene that just ended. The Oracle's last answer is
 *  about that scene, the clock it was feeding was this scene's choice, and the watched flag
 *  is cleared on the character by the boundary itself. The logs are history and stay. */
export function resetSoloScene() {
  state.surveilled = false;
  state.expectation = '';
  state.entered = newTally();
  state.lastAnswer = null;
  state.clockId = null;
}

document.addEventListener('scene:end', resetSoloScene);

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

export function renderSolo(mount) {
  clear(mount);
  const rerender = () => renderSolo(mount);
  const character = activeCharacter();
  const cell = getCell();
  // The watched flag belongs to the scene, shared with the Roll screen and cleared when the
  // scene ends, rather than being this screen's own memory.
  state.surveilled = sceneWatched();

  // The screen runs in the order the printed loop runs (§23): what a turn is, then frame the
  // scene, ask the Oracle, resolve your own attempt, track what is closing in, and only then
  // read back what has already happened.
  mount.append(accordion('How a turn goes', [
    el('ol', { class: 'small' }, SOLO_LOOP.steps.map((s) => el('li', { text: s })))
  ], { key: 'solo-loop', summary: `${SOLO_LOOP.steps.length} steps`, defaultOpen: false }));

  // --- Oracle ---
  const oracleCard = panel('2 · Ask the Oracle', PANELS.soloOracle, []);
  const likelihood = el('select', { id: 'oracle-likelihood', 'aria-label': 'Likelihood', onchange: (e) => { state.likelihood = e.target.value; rerender(); } });
  ORACLE.likelihoods.forEach((l) => likelihood.append(el('option', {
    value: l.id, selected: state.likelihood === l.id,
    text: `${l.name} — ${l.ability} Ability vs ${l.difficulty} Difficulty`
  })));
  oracleCard.append(el('label', { class: 'small', for: 'oracle-likelihood', text: 'Likelihood' }), likelihood);
  oracleCard.append(el('div', { class: 'toggle-row' }, [
    el('input', { type: 'checkbox', id: 'oracle-surveilled', checked: state.surveilled, onchange: (e) => { state.surveilled = e.target.checked; setSceneWatched(e.target.checked); } }),
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

  // H-4 — the same control the Roll screen carries: does this answer feed a clock?
  const runningClocks = listClocks();
  if (runningClocks.length) {
    const clockSelect = el('select', { id: 'oracle-clock', 'aria-label': 'Clock this answer feeds', onchange: (e) => { state.clockId = e.target.value || null; } });
    clockSelect.append(el('option', { value: '', text: 'No clock', selected: !state.clockId }));
    runningClocks.forEach((c) => clockSelect.append(el('option', {
      value: c.id, selected: state.clockId === c.id, text: `${c.name} (${c.progress}/${c.target})`
    })));
    oracleCard.append(el('label', { class: 'small', for: 'oracle-clock', text: 'Does this answer feed a clock?' }), clockSelect);
  } else if (state.clockId) {
    state.clockId = null;
  }

  const pool = oraclePool();
  // The likelihood picker above already says why the pool is what it is, and R-22's
  // substitution is stated in the panel's own "how this works" (§4).
  oracleCard.append(diceToRoll(pool, []));

  const answerNode = el('div', { id: 'oracle-answer', 'aria-live': 'polite' });
  // `forPool` is passed explicitly so a question asked from further down the screen — the
  // raid-timing button — logs the pool it actually rolled rather than the one on screen.
  const ask = (tally, { rolled = true, forPool = null } = {}) => {
    const verdict = interpretOracle(tally);
    const lines = [];

    // The Heat hook rides on the "No, and…" rung, however it was reached (R-22).
    if (state.surveilled && verdict.id === 'noAnd') {
      if (character) {
        const applied = applyPersonalHeat(character, 1, 'An emphatic no from the Oracle in a watched place');
        lines.push(`${verdict.byMagnitude ? 'An emphatic no' : 'Despair'} in a surveilled context: Personal Heat ${applied.before} → ${applied.after}.`);
        document.dispatchEvent(new CustomEvent('resource:refresh'));
      } else {
        // The toggle promises a consequence; with no sheet loaded there is nothing to
        // move, and saying so is better than the rule silently not firing.
        lines.push('An emphatic no in a watched place would raise Personal Heat, but no character is loaded to take it.');
      }
    }
    // How to read that answer against what you expected (H-2).
    const focus = Settings.fateFocus()
      ? readFocus(verdict.result, { chaos: focusChaos(character, cell) })
      : null;

    // One event per question: either trigger fires it, never both (H-2).
    let event = null;
    if (verdict.event || (focus && focus.chainsEvent)) {
      event = rollRandomEvent();
      const text = `${event.category} (${event.categoryRoll}) concerning ${event.subject.toLowerCase()} (${event.subjectRoll}).${event.complication ? ` Complication: ${event.complication}.` : ''}${verdict.event ? ` ${RANDOM_EVENT.skewByAnswer[verdict.id] || ''}` : ''}`;
      lines.push(`Random Event: ${text}`);
      // A chained event is content in exactly the way a hand-rolled one is, so it lands in
      // the prompt log with the rest rather than only inside this answer's row.
      writeIdeaLog({ table: 'Random Event', text: `${text} (chained from "${verdict.answer}")` });
    }

    // H-4 — an Oracle answer is a resolved roll like any other, so it can feed a clock on
    // the same tick rules. Without this a solo player, who mostly asks rather than rolls
    // skills, could never move a clock except by hand.
    if (state.clockId) {
      const ticked = applyCheckToClock(state.clockId, verdict.result.net, 'an Oracle answer');
      if (ticked && ticked.amount) {
        lines.push(`${ticked.clock.name}: ${ticked.reasons.join(', ')} — now ${ticked.clock.progress} of ${ticked.clock.target}.${ticked.filled ? ' It has arrived.' : ''}`);
      } else if (ticked) {
        lines.push(`${ticked.clock.name}: nothing left over pointed its way, so it does not move.`);
      }
    }

    writeOracleLog({
      ts: Date.now(),
      likelihood: state.likelihood,
      likelihoodName: ORACLE.likelihoods.find((l) => l.id === state.likelihood).name,
      pool: { ...(forPool || pool) },
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
    // What you expected belongs to the question that was just answered. Leaving it in the
    // field means the next question is silently read against the last one's expectation.
    state.expectation = '';
    ideaShown = IDEA_LOG_PAGE;
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

  // --- frame the scene (§23 step 1) ---
  const tables = panel('1 · Frame the scene', PANELS.soloTables, []);
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

  mount.append(tables);
  mount.append(oracleCard);

  // --- resolve it yourself (§23 step 4) ---
  // The Oracle says what the world does; what the character attempts is an ordinary check,
  // and that lives on the Roll screen. Without this the loop has a step with no door.
  mount.append(panel('3 · Resolve what you do', PANELS.soloResolve, [
    el('a', { class: 'empty-action', href: '#/roll', text: 'Open the Roll screen' })
  ]));

  // --- track what is closing in (§23 step 6) ---
  renderClocks(mount, { onChange: rerender, title: '4 · Track what is closing in' });

  // Suspicion is the loop's own track, and the raid rule keys off it, so the screen states
  // where it stands rather than making you go and look (§23 step 6).
  const suspicion = panel('5 · Where suspicion stands', PANELS.soloSuspicion, []);
  if (character) {
    suspicion.append(el('p', { class: 'small', text: `${character.identity.name || 'Your character'}: Personal ${character.state.personalHeat} of ${HEAT.max}. The network: Cell ${cell.cellHeat} of ${HEAT.max}, safehouse ${cell.safehouseStatus}.` }));
  } else {
    suspicion.append(el('p', { class: 'small muted', text: `No character is loaded, so nothing here can take suspicion. The network sits at Cell ${cell.cellHeat} of ${HEAT.max}.` }));
  }
  // Raid timing is a suspicion consequence, and the one place the loop hands a decision
  // straight to the Oracle — so it gets a button rather than an instruction.
  if (character && character.state.personalHeat >= SOLO_LOOP.heatRule.fromLevel) {
    suspicion.append(el('p', { class: 'small', text: SOLO_LOOP.heatRule.note }));
    suspicion.append(el('button', {
      type: 'button', class: 'primary', id: 'raid-ask', text: 'Ask whether the raid lands this scene',
      onclick: () => {
        state.expectation = 'The raid does not land this scene';
        const raidPool = oraclePool();
        const rolled = rollPool(raidPool);
        if (!rolled.ok) { showToast(rolled.reason); return; }
        ask(rolled.tally, { rolled: true, forPool: raidPool });
        showToast('Answered in the Oracle panel above.');
      }
    }));
  }
  mount.append(suspicion);

  // --- close the scene (§23 step 7) ---
  // The lifecycle bundles live on the combat tracker, which a solo player never opens, so
  // the one boundary the solo loop names is fired from here too — same preview, same undo.
  const sceneCard = panel('6 · Close the scene', PANELS.soloScene, []);
  const scenePreview = previewBoundary('scene');
  sceneCard.append(el('ul', { class: 'small' }, scenePreview.deltas.map((d) => el('li', { text: d }))));
  sceneCard.append(el('button', {
    type: 'button', class: 'secondary', id: 'solo-end-scene', text: 'End the scene, start the next',
    onclick: async () => {
      if (!(await confirmModal('End the scene? The watched flag, the last Oracle answer, the clock it was feeding and the check setup on the Roll screen are all cleared for the next scene.', { title: 'End the scene', confirmLabel: 'End it' }))) return;
      const fired = fireBoundary('scene');
      lastScene = fired.deltas;
      document.dispatchEvent(new CustomEvent('resource:refresh'));
      rerender();
    }
  }));
  if (lastScene) {
    sceneCard.append(outcomeBox(lastScene, { title: 'The scene ended' }));
    sceneCard.append(el('button', {
      type: 'button', class: 'secondary', id: 'solo-undo-scene', text: 'Undo that',
      onclick: () => {
        const undone = undoLastBoundary();
        showToast(undone.ok ? `Undone: ${undone.label}.` : undone.reason);
        lastScene = null;
        document.dispatchEvent(new CustomEvent('resource:refresh'));
        rerender();
      }
    }));
  }
  mount.append(sceneCard);

  // --- what has happened ---
  // Both logs are a read-back of play, not a step in it, so they sit last and folded.
  const ideas = readIdeaLog();
  const ideaCard = panel('Prompts you have rolled', PANELS.soloIdeaLog, []);
  const ideaBody = el('div', { id: 'solo-output', 'aria-live': 'polite' });
  if (!ideas.length) {
    ideaBody.append(emptyState('Nothing rolled yet — tap a table above and it lands here.'));
  } else {
    ideaCard.append(el('button', {
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
  ideaCard.append(ideaBody);
  if (ideas.length > ideaShown) {
    ideaCard.append(el('button', {
      type: 'button', class: 'secondary', id: 'idea-log-more',
      text: `Show ${Math.min(IDEA_LOG_PAGE, ideas.length - ideaShown)} more of ${ideas.length - ideaShown}`,
      onclick: () => { ideaShown += IDEA_LOG_PAGE; rerender(); }
    }));
  }

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
  mount.append(accordion('What has happened', [logCard, ideaCard], {
    key: 'solo-history',
    summary: `${log.length} answer${log.length === 1 ? '' : 's'} · ${ideas.length} prompt${ideas.length === 1 ? '' : 's'}`,
    defaultOpen: false
  }));
}
