// journey.js — the §34 Journey framework as a working tracker, not a table to read.
// A journey is a start, a destination, and an ordered run of Stops. Each Stop is generated
// from the manual's own Element tables (§15B) plus a Blocker — the thing stopping the party
// simply passing through — and the party moves through them one at a time. Between Stops
// the Travel Encounter table (§35) is rolled; lingering at one rolls the Stop Countdown.
// Part of the optional Part V module, so nothing here appears until it is adopted.

import { el, rollDie, STORAGE_PREFIX, uid, plain } from './core.js';
import { showToast, confirmModal, panel, emptyState, accordion } from './ui.js';
import { PANELS } from './help.js';
import { JOURNEY, TRAVEL_ENCOUNTERS } from '../data-journey.js';
import { ELEMENTS } from '../data-solo.js';

const KEY = STORAGE_PREFIX + 'journey';

const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
const write = (j) => { if (j) localStorage.setItem(KEY, JSON.stringify(j)); else localStorage.removeItem(KEY); return j; };

export const getJourney = read;

/** A Stop: a place, who holds it, what has gone wrong there, and the Blocker. §15B supplies
 *  the first three; §34 says the Blocker is generated from the same faction or complication
 *  lists, or invented to match the location. */
export function rollStop() {
  const pick = (list) => { const n = rollDie(10); return list.find((r) => r.roll === n); };
  const location = pick(ELEMENTS.location);
  const faction = pick(ELEMENTS.faction);
  const complication = pick(ELEMENTS.complication);
  const blockerFromFaction = rollDie(2) === 1;
  const blocker = blockerFromFaction ? pick(ELEMENTS.faction) : pick(ELEMENTS.complication);
  return {
    id: uid(),
    location: location.entry,
    faction: faction.entry,
    complication: complication.entry,
    blocker: blocker.entry,
    blockerKind: blockerFromFaction ? 'faction' : 'complication',
    passed: false,
    countdown: []
  };
}

export function startJourney({ start = '', destination = '', lengthId = 'short', stops = null } = {}) {
  const length = JOURNEY.lengths.find((l) => l.id === lengthId) || JOURNEY.lengths[1];
  // The printed lengths are ranges ("2–4"); the low end is taken so a journey never opens
  // longer than the table's own floor for its size, and Stops can be added by hand.
  const count = stops || Number(String(length.stops).split('–')[0]);
  return write({
    start, destination, lengthId: length.id,
    stops: Array.from({ length: count }, () => rollStop()),
    at: 0, travelLog: [], startedAt: Date.now()
  });
}

export function addStop() {
  const j = read();
  if (!j) return null;
  j.stops.push(rollStop());
  return write(j);
}

/** Leaving a Stop rolls the road between it and the next one (§35). */
export function passStop() {
  const j = read();
  if (!j || j.at >= j.stops.length) return null;
  j.stops[j.at].passed = true;
  j.at += 1;
  const arrived = j.at >= j.stops.length;
  let encounter = null;
  if (!arrived) {
    const n = rollDie(10);
    const row = TRAVEL_ENCOUNTERS.table.find((r) => r.roll === n);
    encounter = { roll: n, entry: row.entry, deploys: row.deploys || null, ts: Date.now() };
    j.travelLog = [encounter, ...(j.travelLog || [])].slice(0, 12);
  }
  write(j);
  return { journey: j, arrived, encounter };
}

/** Lingering past a Stop's natural end rolls its own escalating pressure (§34). */
export function rollStopCountdown() {
  const j = read();
  if (!j || j.at >= j.stops.length) return null;
  const n = rollDie(10);
  const row = JOURNEY.stopCountdown.table.find((r) => r.roll === n);
  const stop = j.stops[j.at];
  stop.countdown = [{ roll: n, entry: row.entry, ts: Date.now() }, ...(stop.countdown || [])].slice(0, 6);
  write(j);
  return { roll: n, entry: row.entry, stop };
}

export function endJourney() { return write(null); }

/** The panel, used on the Combat tracker and the Solo screen alike. */
export function renderJourney(mount, { onChange = () => {}, title = 'The road' } = {}) {
  const j = read();
  const card = panel(title, PANELS.journey, []);

  if (!j) {
    const start = el('input', { type: 'text', id: 'journey-start', placeholder: 'Where you are now', 'aria-label': 'Where the journey starts' });
    const destination = el('input', { type: 'text', id: 'journey-destination', placeholder: 'Where you are trying to reach', 'aria-label': 'Where the journey ends' });
    const length = el('select', { id: 'journey-length', 'aria-label': 'How long the journey is' });
    JOURNEY.lengths.forEach((l) => length.append(el('option', { value: l.id, text: `${l.name} — ${l.stops} stops`, selected: l.id === 'short' })));
    card.append(el('label', { class: 'small', for: 'journey-start', text: 'Start' }), start);
    card.append(el('label', { class: 'small', for: 'journey-destination', text: 'Destination' }), destination);
    card.append(el('label', { class: 'small', for: 'journey-length', text: 'How far is it?' }), length);
    card.append(el('button', {
      type: 'button', class: 'primary', id: 'journey-start-btn', text: 'Plot the route',
      onclick: () => {
        startJourney({ start: start.value.trim(), destination: destination.value.trim(), lengthId: length.value });
        onChange();
      }
    }));
    card.append(emptyState('Each stop is rolled from the book\'s own location, faction and complication tables, with a blocker to get past.'));
    mount.append(card);
    return card;
  }

  const arrived = j.at >= j.stops.length;
  card.append(el('p', { class: 'small', id: 'journey-where', text: arrived
    ? `Arrived: ${j.destination || 'the destination'}. ${j.stops.length} stop${j.stops.length === 1 ? '' : 's'} behind you.`
    : `${j.start || 'Somewhere'} → ${j.destination || 'somewhere'}. Stop ${j.at + 1} of ${j.stops.length}.` }));

  j.stops.forEach((stop, i) => {
    const here = i === j.at && !arrived;
    if (stop.passed && !here) return; // passed stops fold into the history below
    const row = el('div', { class: 'result', id: here ? 'journey-here' : null }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: `Stop ${i + 1}: ${stop.location}` }),
        el('span', { class: 'cite', text: here ? 'you are here' : 'ahead' })
      ]),
      el('div', { class: 'result-body', text: `${stop.faction} holds it. ${stop.complication}.` }),
      el('p', { class: 'small', text: `Blocker: ${stop.blocker}.` })
    ]);
    if (here) {
      row.append(el('button', {
        type: 'button', class: 'secondary', id: 'journey-linger', text: 'They linger — roll the countdown',
        onclick: () => { const r = rollStopCountdown(); if (r) showToast(`${r.entry} (${r.roll}).`); onChange(); }
      }));
      row.append(el('button', {
        type: 'button', class: 'primary', id: 'journey-pass', text: 'Past the blocker — move on',
        onclick: () => {
          const moved = passStop();
          if (!moved) return;
          if (moved.arrived) showToast(`Arrived at ${j.destination || 'the destination'}.`);
          else if (moved.encounter) showToast(`On the road: ${moved.encounter.entry} (${moved.encounter.roll}).`);
          onChange();
        }
      }));
      (stop.countdown || []).forEach((c) => row.append(el('p', { class: 'small muted', text: `Pressure: ${c.entry} (${c.roll}).` })));
    }
    card.append(row);
  });

  if (!arrived) {
    card.append(el('button', {
      type: 'button', class: 'secondary', id: 'journey-add', text: 'Add a stop',
      onclick: () => { addStop(); onChange(); }
    }));
  }

  const behind = j.stops.filter((s) => s.passed);
  if (behind.length || (j.travelLog || []).length) {
    const body = el('div', { id: 'journey-history' });
    behind.forEach((s, i) => body.append(el('p', { class: 'small muted', text: `Stop ${i + 1}: ${s.location} — past.` })));
    (j.travelLog || []).forEach((t) => body.append(el('p', { class: 'small muted', text: `On the road: ${t.entry} (${t.roll}).` })));
    card.append(accordion('The road behind', [body], {
      key: 'journey-history', summary: `${behind.length} stop${behind.length === 1 ? '' : 's'} · ${(j.travelLog || []).length} encounter${(j.travelLog || []).length === 1 ? '' : 's'}`
    }));
  }

  card.append(el('button', {
    type: 'button', class: 'secondary danger', id: 'journey-end', text: arrived ? 'Clear the route' : 'Abandon the journey',
    onclick: async () => {
      if (!(await confirmModal('End this journey? The stops and the road behind are discarded.', { title: 'End the journey', confirmLabel: 'End it' }))) return;
      endJourney();
      onChange();
    }
  }));
  mount.append(card);
  return card;
}
