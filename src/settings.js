// settings.js — feature and content toggles (CLAUDE.md §9). All default off.

import { STORAGE_PREFIX } from './core.js';
import { DIE_FACES } from '../data.js';
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
  { id: 'soloMode', label: 'Solo mode', desc: 'Adds the Solo tab: Oracle, random events, meaning and element tables (§18–§20, §23).' },
  { id: 'gmScreen', label: 'GM screen', desc: 'Adds the GM tab with the bestiary browser and every rollable reference table (§3.21).' },
  { id: 'digitalRoller', label: 'Simulated dice roller', desc: 'Blocked: the manual never prints die face distributions (R-B1). Manual symbol entry is the primary input and is always available.', blocked: () => DIE_FACES === null },
  { id: 'showNonSettingTalents', label: 'Show non-setting talents', desc: 'Reveals the 12 talents referencing content this setting does not have (R-11).' },
  { id: 'gmDiscretionaryDice', label: 'GM discretionary dice', desc: 'Exposes the outnumbered and ganging-up dice controls (§5C\'\'), which the manual says not to apply automatically.' },
  { id: 'advancedAutomation', label: 'Advanced automation', desc: 'Applies environmental dice, encumbrance penalties and Heat setbacks without prompting first.' }
];

export const Settings = {
  soloMode: () => !!get('soloMode'),
  gmScreen: () => !!get('gmScreen'),
  // R-B1 — force-disabled while DIE_FACES is absent, whatever is stored.
  digitalRoller: () => DIE_FACES !== null && !!get('digitalRoller'),
  showNonSettingTalents: () => !!get('showNonSettingTalents'),
  gmDiscretionaryDice: () => !!get('gmDiscretionaryDice'),
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
