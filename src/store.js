// store.js — local persistence, the Cell entity, and JSON export/import.
// Cloud sync arrives in Phase 5 (sync.js); the local path always works with no config.

import { STORAGE_PREFIX, uid } from './core.js';
import { normalise, blankCharacter } from './derived.js';
import { Settings } from './settings.js';
import { STORY_POINTS } from '../data.js';

const K_CHARACTERS = STORAGE_PREFIX + 'characters';
const K_ACTIVE = STORAGE_PREFIX + 'activeCharacter';
const K_CELL = STORAGE_PREFIX + 'cell';

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// --- characters ---
export function listCharacters() {
  return readJson(K_CHARACTERS, []).map(normalise);
}

export function getCharacter(id) {
  return listCharacters().find((c) => c.id === id) || null;
}

export function saveCharacter(character) {
  const all = readJson(K_CHARACTERS, []);
  const record = normalise(character);
  if (!record.id) record.id = uid();
  const index = all.findIndex((c) => c.id === record.id);
  if (index >= 0) all[index] = record; else all.push(record);
  writeJson(K_CHARACTERS, all);
  document.dispatchEvent(new CustomEvent('store:changed', { detail: { kind: 'character', id: record.id } }));
  return record;
}

export function deleteCharacter(id) {
  writeJson(K_CHARACTERS, readJson(K_CHARACTERS, []).filter((c) => c.id !== id));
  if (activeCharacterId() === id) setActiveCharacter(null);
  document.dispatchEvent(new CustomEvent('store:changed', { detail: { kind: 'character', id } }));
}

export function activeCharacterId() {
  return localStorage.getItem(K_ACTIVE);
}

export function setActiveCharacter(id) {
  if (id) localStorage.setItem(K_ACTIVE, id); else localStorage.removeItem(K_ACTIVE);
  document.dispatchEvent(new CustomEvent('store:changed', { detail: { kind: 'active', id } }));
}

export function activeCharacter() {
  const id = activeCharacterId();
  return id ? getCharacter(id) : null;
}

// --- the Cell (CLAUDE.md §3.8): campaign-level shared state ---
export function blankCell(over = {}) {
  return {
    name: '',
    cellHeat: 0,                     // §17.2
    safehouseStatus: 'clear',        // clear | watched | blown
    roster: [],
    pools: {                         // §8, R-4
      storyPointsPlayer: Settings.storyPointsPerPc(),
      storyPointsGM: STORY_POINTS.startingGmPool
    },
    ...over
  };
}

export function getCell() {
  const stored = readJson(K_CELL, null);
  return stored ? { ...blankCell(), ...stored, pools: { ...blankCell().pools, ...(stored.pools || {}) } } : blankCell();
}

export function saveCell(cell) {
  writeJson(K_CELL, cell);
  document.dispatchEvent(new CustomEvent('store:changed', { detail: { kind: 'cell' } }));
  return cell;
}

// --- backup ---
export function exportAll() {
  return JSON.stringify({
    app: 'reich62-player',
    exportedAt: new Date().toISOString(),
    characters: listCharacters(),
    cell: getCell(),
    settings: Settings.raw()
  }, null, 2);
}

export function importAll(json) {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json;
  if (!parsed || parsed.app !== 'reich62-player') throw new Error('Not a REICH \'62 Player backup file.');
  writeJson(K_CHARACTERS, (parsed.characters || []).map(normalise));
  if (parsed.cell) writeJson(K_CELL, parsed.cell);
  if (parsed.settings) writeJson(STORAGE_PREFIX + 'settings', parsed.settings);
  document.dispatchEvent(new CustomEvent('store:changed', { detail: { kind: 'import' } }));
  return { characters: (parsed.characters || []).length };
}

export { blankCharacter };

// --- combat, tasks and lifecycle (Phase 4) ---
const K_COMBAT = STORAGE_PREFIX + 'combat';
const K_TASKS = STORAGE_PREFIX + 'tasks';
const K_UNDO = STORAGE_PREFIX + 'undo';

export function blankCombat() {
  return { active: false, round: 0, slots: [], combatants: {}, vehicles: {}, log: [] };
}

export function getCombat() {
  return { ...blankCombat(), ...readJson(K_COMBAT, null) };
}

export function saveCombat(combat) {
  writeJson(K_COMBAT, combat);
  document.dispatchEvent(new CustomEvent('store:changed', { detail: { kind: 'combat' } }));
  return combat;
}

export function listTasks() {
  return readJson(K_TASKS, []);
}

export function saveTasks(tasks) {
  writeJson(K_TASKS, tasks);
  document.dispatchEvent(new CustomEvent('store:changed', { detail: { kind: 'tasks' } }));
  return tasks;
}

/** One-step undo for lifecycle boundaries (§3.12): snapshot before, restore on undo. */
export function snapshot(label) {
  const state = {
    label,
    ts: Date.now(),
    characters: readJson(K_CHARACTERS, []),
    cell: readJson(K_CELL, null),
    combat: readJson(K_COMBAT, null),
    tasks: readJson(K_TASKS, [])
  };
  writeJson(K_UNDO, state);
  return state;
}

export function lastSnapshot() {
  return readJson(K_UNDO, null);
}

export function undoSnapshot() {
  const state = readJson(K_UNDO, null);
  if (!state) return null;
  writeJson(K_CHARACTERS, state.characters || []);
  if (state.cell) writeJson(K_CELL, state.cell);
  if (state.combat) writeJson(K_COMBAT, state.combat);
  writeJson(K_TASKS, state.tasks || []);
  localStorage.removeItem(K_UNDO);
  document.dispatchEvent(new CustomEvent('store:changed', { detail: { kind: 'undo' } }));
  return state;
}
