// solo.js — the solo assistant. Official rules only (§18–§20, §23), so this tab is real
// rather than invented; it stays behind the soloMode flag.

import { el, clear, titleCase, rollDie, newTally, outcome } from './core.js';
import { showToast, modal, renderTally, panel, emptyState } from './ui.js';
import { PANELS } from './help.js';
import { ORACLE, MEANING, ELEMENTS, RANDOM_EVENT, SOLO_LOOP } from '../data-solo.js';
import { NPC_QUICKGEN } from '../data-npcs.js';
import { RANDOM_ENCOUNTERS, MINION_GROUPS } from '../data-monsters.js';
import { activeCharacter, getCell } from './store.js';
import { applyPersonalHeat } from './heat.js';
import { writeLog } from './roller.js';

const state = { likelihood: 'fiftyFifty', surveilled: false, history: [] };

/** The Oracle answers from entered symbols, exactly like every other check (R-B1). */
export function interpretOracle(tally) {
  const result = outcome(tally);
  if (result.triumph > 0) return { answer: 'Yes, and…', id: 'yesAnd', event: true, result };
  if (result.despair > 0) return { answer: 'No, and…', id: 'noAnd', event: true, result };
  if (result.success) return { answer: 'Yes', id: 'yes', event: false, result };
  if (result.netFailure > 0) return { answer: 'No', id: 'no', event: false, result };
  if (result.netAdvantage > 0) return { answer: 'Yes, but…', id: 'yesBut', event: false, result };
  if (result.netThreat > 0) return { answer: 'No, but…', id: 'noBut', event: false, result };
  return { answer: 'No', id: 'no', event: false, result };
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
    el('label', { for: 'oracle-surveilled' }, [el('span', { text: 'The question concerns somewhere the regime is watching, so a despair draws attention' })])
  ]));

  const entered = newTally();
  const tallyRow = el('div');
  const drawTally = () => {
    clear(tallyRow);
    ['success', 'advantage', 'triumph', 'failure', 'threat', 'despair'].forEach((sym) => {
      tallyRow.append(el('div', { class: 'toggle-row' }, [
        el('label', { for: `oracle-${sym}` }, [el('span', { text: titleCase(sym) })]),
        el('button', { type: 'button', class: 'secondary', text: '−', 'aria-label': `One less oracle ${sym}`, onclick: () => { entered[sym] = Math.max(0, entered[sym] - 1); drawTally(); } }),
        el('span', { id: `oracle-${sym}`, class: 'stat-value', text: String(entered[sym]) }),
        el('button', { type: 'button', class: 'secondary', text: '+', 'aria-label': `One more oracle ${sym}`, onclick: () => { entered[sym] += 1; drawTally(); } })
      ]));
    });
  };
  drawTally();
  oracleCard.append(el('p', { class: 'small' }, [
    'Roll the listed dice physically and enter what came up; the Oracle reads them with the normal resolution rules.'
  ]), tallyRow);

  const answerNode = el('div', { id: 'oracle-answer', 'aria-live': 'polite' });
  oracleCard.append(el('button', {
    type: 'button', class: 'primary', text: 'Ask the Oracle',
    onclick: () => {
      const verdict = interpretOracle(entered);
      clear(answerNode);
      answerNode.append(el('h3', { text: verdict.answer }));
      answerNode.append(el('p', {}, [renderTally(verdict.result.net)]));

      if (state.surveilled && verdict.result.despair > 0 && character) {
        const applied = applyPersonalHeat(character, 1);
        answerNode.append(el('p', { class: 'small', text: `Despair in a surveilled context: Personal Heat ${applied.before} → ${applied.after}.` }));
        document.dispatchEvent(new CustomEvent('resource:refresh'));
      }
      if (verdict.event) {
        const event = rollRandomEvent();
        answerNode.append(el('p', { class: 'small', text: `Random Event: ${event.category} (${event.categoryRoll}) concerning ${event.subject.toLowerCase()} (${event.subjectRoll}).${event.complication ? ` Complication: ${event.complication}.` : ''} ${RANDOM_EVENT.skew}` }));
      }
      writeLog({
        ts: Date.now(), by: character ? character.id : null,
        characterName: character ? character.identity.name : 'Solo',
        skill: 'oracle', difficulty: state.likelihood, poolInputs: {}, symbols: { ...entered },
        net: verdict.result.net, outcome: verdict.answer, surveilled: state.surveilled,
        heatDelta: state.surveilled && verdict.result.despair > 0 ? 1 : 0, notes: ['Oracle']
      });
      Object.keys(entered).forEach((k) => { entered[k] = 0; });
      drawTally();
    }
  }), answerNode);
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
