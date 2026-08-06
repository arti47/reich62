// clocks.js — named progress clocks (H-4, house aid).
// The books publish one extended track, the Dragnet (B§6), and two 0–5 suspicion tracks
// (§17). This is that shape generalised: a named clock with a size and a direction, ticked
// by the symbols a check already produced rather than by any new roll. Storage is the same
// `tasks` list the combat tracker has always used, so nothing is duplicated.

import { el, clear, uid, clamp } from './core.js';
import { showToast, confirmModal, panel, emptyState } from './ui.js';
import { PANELS } from './help.js';
import { CLOCKS } from '../data.js';
import { listTasks, saveTasks } from './store.js';

export const clockSizes = () => CLOCKS.sizes;
export const clockDirections = () => CLOCKS.directions;

/** Every clock, newest first. Repair jobs and the dragnet live in the same list and are
 *  shown here too, since they are the same shape. */
export function listClocks() {
  // The Dragnet is published with its own escalating opposition and dual Heat cost (B§6),
  // so it keeps the card built for it on the Combat tab rather than appearing here twice.
  return listTasks().filter((t) => !t.closed && t.kind !== 'dragnet');
}

export function createClock({ name, size = CLOCKS.defaultSize, direction = 'against', kind = 'clock', note = '' }) {
  const tasks = listTasks();
  const clock = {
    id: uid(), name: name || 'Clock', kind,
    progress: 0, target: size, direction, note,
    contributors: [], oppositionDice: null, elapsedHours: 0,
    closed: false, createdAt: Date.now(), trail: []
  };
  tasks.push(clock);
  saveTasks(tasks);
  return clock;
}

/** Move a clock, recording why. Returns the clock and whether it just filled. */
export function tickClock(clockId, amount = 1, reason = '') {
  const tasks = listTasks();
  const clock = tasks.find((t) => t.id === clockId);
  if (!clock) return { ok: false, reason: 'Unknown clock.' };
  const before = clock.progress;
  clock.progress = clamp(clock.progress + amount, 0, clock.target);
  if (clock.progress !== before) {
    clock.trail = [...(clock.trail || []), { ts: Date.now(), from: before, to: clock.progress, reason }].slice(-12);
  }
  const filled = clock.progress >= clock.target && before < clock.target;
  saveTasks(tasks);
  return { ok: true, clock, before, filled };
}

export function closeClock(clockId) {
  saveTasks(listTasks().filter((t) => t.id !== clockId));
}

/** What a resolved check does to the clock it was pointed at (H-4). The symbols are the
 *  ones left after cancelling, so this spends nothing the roller has not already worked out. */
export function ticksFromCheck(net, direction) {
  const rules = CLOCKS.ticks.filter((r) => r.direction === direction || r.direction === 'either');
  let amount = 0;
  const reasons = [];
  rules.forEach((rule) => {
    const count = net[rule.symbol] || 0;
    if (!count) return;
    const step = rule.amount ? rule.amount * count : Math.floor(count / rule.per);
    if (!step) return;
    // A Triumph clears a segment from something closing on you rather than filling it.
    const signed = rule.symbol === 'triumph' && direction === 'against' ? -step : step;
    amount += signed;
    reasons.push(`${count} ${rule.symbol} → ${signed > 0 ? '+' : ''}${signed}`);
  });
  return { amount, reasons };
}

/** Apply a resolved check to a clock, if one was nominated. */
export function applyCheckToClock(clockId, net, reason = 'a check') {
  const clock = listTasks().find((t) => t.id === clockId);
  if (!clock) return null;
  const { amount, reasons } = ticksFromCheck(net, clock.direction || 'against');
  if (!amount) return { clock, amount: 0, reasons, filled: false };
  const moved = tickClock(clockId, amount, `${reason}: ${reasons.join(', ')}`);
  return { clock: moved.clock, amount, reasons, filled: moved.filled };
}

/** A clock drawn as filled and empty segments, so it reads at a glance. */
export function clockFace(clock) {
  const wrap = el('span', { class: 'clock-face', 'aria-label': `${clock.progress} of ${clock.target} filled` });
  for (let i = 0; i < clock.target; i += 1) {
    wrap.append(el('span', { class: `clock-seg${i < clock.progress ? ' is-filled' : ''}`, 'aria-hidden': 'true' }));
  }
  return wrap;
}

/** The clocks panel, used on Combat, Roll and Solo alike. */
export function renderClocks(mount, { compact = false, onChange = () => {} } = {}) {
  const clocks = listClocks();
  const card = panel('Clocks', PANELS.clocks, []);

  if (!compact) {
    const name = el('input', { type: 'text', id: 'clock-name', placeholder: 'What is coming?', 'aria-label': 'Clock name' });
    const size = el('select', { id: 'clock-size', 'aria-label': 'How many segments' });
    clockSizes().forEach((n) => size.append(el('option', { value: String(n), text: `${n} segments`, selected: n === CLOCKS.defaultSize })));
    const direction = el('select', { id: 'clock-direction', 'aria-label': 'Which way it runs' });
    clockDirections().forEach((d) => direction.append(el('option', { value: d.id, text: d.name })));
    card.append(name, size, direction, el('button', {
      type: 'button', class: 'secondary', id: 'clock-add', text: 'Start a clock',
      onclick: () => {
        createClock({ name: name.value, size: Number(size.value), direction: direction.value });
        onChange();
      }
    }));
  }

  if (!clocks.length) {
    card.append(emptyState('No clocks running. Start one for anything you want to see coming.'));
    mount.append(card);
    return card;
  }

  clocks.forEach((clock) => {
    const dir = clockDirections().find((d) => d.id === (clock.direction || 'against')) || clockDirections()[0];
    const row = el('div', { class: 'result clock-row' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: clock.name }),
        el('span', { class: 'cite', text: `${clock.progress}/${clock.target}` })
      ]),
      clockFace(clock),
      el('div', { class: 'result-body', text: dir.name })
    ]);
    if (clock.progress >= clock.target) row.append(el('p', { class: 'small', text: CLOCKS.full }));
    row.append(el('button', {
      type: 'button', class: 'secondary', text: '+1', 'aria-label': `Fill one segment of ${clock.name}`,
      onclick: () => { tickClock(clock.id, 1, 'by hand'); onChange(); }
    }));
    row.append(el('button', {
      type: 'button', class: 'secondary', text: '−1', 'aria-label': `Clear one segment of ${clock.name}`,
      onclick: () => { tickClock(clock.id, -1, 'by hand'); onChange(); }
    }));
    row.append(el('button', {
      type: 'button', class: 'secondary danger', text: 'Close', 'aria-label': `Close ${clock.name}`,
      onclick: async () => {
        if (!(await confirmModal(`Close "${clock.name}"? Its progress is discarded.`, { title: 'Close clock', confirmLabel: 'Close it' }))) return;
        closeClock(clock.id);
        onChange();
      }
    }));
    if ((clock.trail || []).length) {
      row.append(el('p', { class: 'small muted', text: `Last: ${clock.trail[clock.trail.length - 1].reason}` }));
    }
    card.append(row);
  });

  mount.append(card);
  return card;
}
