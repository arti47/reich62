// clocks.js — clocks (§8A).
// The manual prints a generalised countdown/progress track: a named clock with a size of
// 4, 6 or 8 and a direction, ticked by the symbols a check already produced rather than by
// any new roll. The named tracks — Heat, the Personal Threat Countdown, the Dragnet — stay
// under their own names and their own pacing; this is the one to reach for when the table
// invents a countdown on the fly. Storage is the same `tasks` list the combat tracker has
// always used, so nothing is duplicated.

import { el, clear, uid, clamp } from './core.js';
import { showToast, confirmModal, panel, emptyState } from './ui.js';
import { PANELS } from './help.js';
import { CLOCKS } from '../data.js';
import { ENCOUNTER_BLOCKS } from '../data-monsters.js';
import { listTasks, saveTasks } from './store.js';
import { dragnetRound } from './combat.js';
import { activeCharacter } from './store.js';

export const clockSizes = () => CLOCKS.sizes;
export const clockDirections = () => CLOCKS.directions;

/** Every clock, newest first. Repair jobs and the dragnet live in the same list and are
 *  shown here too, since they are the same shape. */
/** Everything on the track list. The Dragnet is a clock too — a published one — so it sits
 *  here with the rest rather than in a second panel saying the same thing. */
export function listClocks() {
  return listTasks().filter((t) => !t.closed);
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

/** What a resolved check does to the clock it was pointed at (§8A). The symbols are the
 *  ones left after cancelling, so this spends nothing the roller has not already worked out.
 *  `remaining` is how many segments the clock still needs, because a Triumph on your own
 *  clock fills it by everything it has left rather than by one. */
export function ticksFromCheck(net, direction, remaining = 1) {
  const rules = CLOCKS.ticks.filter((r) => r.direction === direction || r.direction === 'either');
  let amount = 0;
  const reasons = [];
  rules.forEach((rule) => {
    const count = net[rule.symbol] || 0;
    if (!count) return;
    if (rule.symbol === 'triumph') {
      // §8A — a Triumph fills the acting character's own clock by its full remaining need,
      // or clears one segment from a clock closing on them. The player picks; on a clock
      // pointed at from a check the app takes the reading that favours the roller.
      const signed = direction === 'against' ? -count : Math.max(0, remaining);
      if (!signed) return;
      amount += signed;
      reasons.push(direction === 'against'
        ? `${count} triumph → ${signed}`
        : `a triumph fills the remaining ${signed}`);
      return;
    }
    const step = rule.amount ? rule.amount * count : Math.floor(count / rule.per);
    if (!step) return;
    amount += step;
    reasons.push(`${count} ${rule.symbol} → +${step}`);
  });
  return { amount, reasons };
}

/** Apply a resolved check to a clock, if one was nominated. */
export function applyCheckToClock(clockId, net, reason = 'a check') {
  const clock = listTasks().find((t) => t.id === clockId);
  if (!clock) return null;
  const { amount, reasons } = ticksFromCheck(net, clock.direction || 'against', clock.target - clock.progress);
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
export function renderClocks(mount, { compact = false, onChange = () => {}, title = 'Clocks' } = {}) {
  const clocks = listClocks();
  const card = panel(title, PANELS.clocks, []);

  if (!compact) {
    const name = el('input', { type: 'text', id: 'clock-name', placeholder: 'What is coming?', 'aria-label': 'Clock name' });
    const size = el('select', { id: 'clock-size', 'aria-label': 'How many segments' });
    clockSizes().forEach((n) => size.append(el('option', { value: String(n), text: `${n} segments`, selected: n === CLOCKS.defaultSize })));
    const direction = el('select', { id: 'clock-direction', 'aria-label': 'Which way it runs' });
    clockDirections().forEach((d) => direction.append(el('option', { value: d.id, text: d.name })));
    // §8A names the Dragnet as one of the printed clocks, so it is offered as a kind
    // rather than left to be rebuilt by hand (B§6).
    const kind = el('select', { id: 'clock-kind', 'aria-label': 'What kind of clock' }, [
      el('option', { value: 'clock', text: 'Anything you name' }),
      el('option', { value: 'dragnet', text: 'Manhunt / Dragnet (from the book)' })
    ]);
    card.append(name, size, direction, kind, el('button', {
      type: 'button', class: 'secondary', id: 'clock-add', text: 'Start a clock',
      onclick: () => {
        const isDragnet = kind.value === 'dragnet';
        const block = ENCOUNTER_BLOCKS.find((b) => b.id === 'manhuntDragnet');
        const made = createClock({
          name: name.value || (isDragnet ? block.name : 'Clock'),
          size: Number(size.value),
          direction: isDragnet ? 'against' : direction.value,
          kind: kind.value
        });
        if (isDragnet) {
          const tasks = listTasks();
          const t = tasks.find((x) => x.id === made.id);
          t.oppositionDice = block.resolution.oppositionDiceStart;
          saveTasks(tasks);
        }
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

    // B§6 — the published track keeps its printed behaviour: escalating opposition, and a
    // failed round costing suspicion. §8A lists it as a size-4 scaling clock, so it lives
    // here with the rest but is never ticked by the generic table.
    if (clock.kind === 'dragnet') {
      row.append(el('p', { class: 'small muted', text: `Stealth or Streetwise against ${clock.oppositionDice || 2} opposition dice, rising by one per in-game hour to a maximum of four. Every failed round advances both suspicion tracks. Elapsed: ${clock.elapsedHours || 0}h.` }));
      row.append(el('button', {
        type: 'button', class: 'secondary', text: 'Failed round',
        'aria-label': `A failed round of ${clock.name}`,
        onclick: () => { const r = dragnetRound(clock.id, { failed: true, character: activeCharacter() }); (r.effects || []).forEach((e) => showToast(e)); onChange(); }
      }));
      row.append(el('button', {
        type: 'button', class: 'secondary', text: 'Survived round',
        'aria-label': `A survived round of ${clock.name}`,
        onclick: () => { const r = dragnetRound(clock.id, { failed: false }); (r.effects || []).forEach((e) => showToast(e)); onChange(); }
      }));
    }

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
