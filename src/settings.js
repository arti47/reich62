// settings.js — feature and content toggles (CLAUDE.md §9). All default off.

import { STORAGE_PREFIX, plain } from './core.js';
import { DIE_FACES, DIE_FACES_SOURCE } from '../data.js';
import { CREATION_RULES } from '../data.js';

const KEY = STORAGE_PREFIX + 'settings';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
  catch { return {}; }
}

function write(obj) {
  localStorage.setItem(KEY, JSON.stringify(obj));
}

export function get(flag) {
  const all = read();
  return all[flag];
}

export function set(flag, value) {
  const all = read();
  all[flag] = value;
  write(all);
  document.dispatchEvent(new CustomEvent('settings:changed', { detail: { flag, value } }));
  return value;
}

export const FLAGS = [
  { id: 'soloMode', label: 'Solo mode', desc: 'Adds the Solo tab: Oracle, random events, meaning and element tables.' },
  { id: 'gmScreen', label: 'GM screen', desc: 'Adds the GM tab with the bestiary browser and every rollable reference table.' },
  { id: 'digitalRoller', label: 'Simulated dice roller', desc: 'Rolls the pool for you instead of you tapping in what your physical dice showed. Entering symbols by hand always works and stays the default.',
    note: () => DIE_FACES === null ? 'No face table is loaded, so the app cannot roll for you.' : `Rolls against the supplied face table. ${plain(DIE_FACES_SOURCE.note)}`,
    blocked: () => DIE_FACES === null },
  { id: 'showNonSettingTalents', label: 'Show non-setting talents', desc: 'Reveals the 12 talents that reference things this setting does not have — hacking rules, bows, aircraft, cybernetics, animal companions.' },
  { id: 'fateFocus', defaultOn: true, label: 'Oracle focus table', desc: 'Reads every Oracle answer against what you expected before you asked — as expected, not quite, in your favour, against you, and so on. A house aid from another solo system, not a printed rule; on by default.' },
  { id: 'gmDiscretionaryDice', label: 'GM discretionary dice', desc: 'Exposes the outnumbered and ganging-up dice, which the book says to use sparingly rather than automatically.' },
  { id: 'advancedAutomation', label: 'Advanced automation', desc: 'Applies environmental dice, encumbrance penalties and Heat setbacks without prompting first.' }
];

export const MODE_KEY = 'mode';

export const Settings = {
  /** Which seat the user is in; the router shows only that seat's tabs. */
  mode: () => get(MODE_KEY) || 'player',
  setMode: (id) => set(MODE_KEY, id),
  modeChosen: () => !!get(MODE_KEY),

  soloMode: () => !!get('soloMode'),
  gmScreen: () => !!get('gmScreen'),
  // R-B1 — force-disabled while DIE_FACES is absent, whatever is stored.
  digitalRoller: () => DIE_FACES !== null && !!get('digitalRoller'),
  showNonSettingTalents: () => !!get('showNonSettingTalents'),
  gmDiscretionaryDice: () => !!get('gmDiscretionaryDice'),
  // H-2 — the one flag that starts on: the Oracle panel is built around the focus reading.
  fateFocus: () => get('fateFocus') !== false,
  advancedAutomation: () => !!get('advancedAutomation'),

  // R-8 — house aids, relabellable, never presented as printed rules.
  currencyLabel: () => get('currencyLabel') || CREATION_RULES.houseAid.currencyLabel,
  startingBudget: () => {
    const v = get('startingBudget');
    return Number.isFinite(v) ? v : CREATION_RULES.houseAid.startingBudget;
  },
  storyPointsPerPc: () => get('storyPointsPerPc') === 2 ? 2 : 1, // §8

  isBlocked: (flag) => {
    const def = FLAGS.find((f) => f.id === flag);
    return !!(def && def.blocked && def.blocked());
  },
  set,
  get,
  raw: read
};

export function theme() {
  return get('theme') || 'system';
}

export function applyTheme(next) {
  const value = next || theme();
  if (value === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', value);
  if (next) set('theme', next);
  return value;
}

export function cycleTheme() {
  const order = ['system', 'dark', 'light'];
  const current = theme();
  return applyTheme(order[(order.indexOf(current) + 1) % order.length]);
}
