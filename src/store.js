// store.js — local persistence, the Cell entity, and JSON export/import.
// Cloud sync arrives in Phase 5 (sync.js); the local path always works with no config.

import { STORAGE_PREFIX, uid } from './core.js';
import { normalise, blankCharacter } from './derived.js';
import { Settings } from './settings.js';
import { STORY_POINTS } from '../data.js';

const K_CHARACTERS = STORAGE_PREFIX + 'characters';
const K_ACTIVE = STORAGE_PREFIX + 'activeCharacter';
const K_CELL = STORAGE_PREFIX + 'cell';
const K_COMBAT = STORAGE_PREFIX + 'combat';
const K_TASKS = STORAGE_PREFIX + 'tasks';

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

// --- the scene's watched flag (§17.1) ---
// Whether the regime is watching where you are is a fact about the scene, not about one
// screen, and both the Roll screen and the Oracle ask it. It lives on the character —
// `state.surveilledContext`, in the schema since day one and until now never read or
// written — so the two screens cannot disagree, and the End Scene boundary clears it.
// With no character loaded there is nothing to store it on, so it falls back to a
// module-level flag that lasts as long as the tab does.
let watchedWithoutCharacter = false;

export function sceneWatched() {
  const character = activeCharacter();
  return character ? !!character.state.surveilledContext : watchedWithoutCharacter;
}

export function setSceneWatched(on) {
  const character = activeCharacter();
  watchedWithoutCharacter = !!on;
  if (!character) return;
  character.state.surveilledContext = !!on;
  saveCharacter(character);
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
const K_LOG = STORAGE_PREFIX + 'rollLog';
// The solo screen keeps two logs of its own; a backup that dropped them would lose a
// session's questions and prompts.
const K_ORACLE_LOG = STORAGE_PREFIX + 'oracleLog';
const K_IDEA_LOG = STORAGE_PREFIX + 'ideaLog';

/** Everything that would be lost if this device went away: characters, the network, the
 *  settings, the roll log, the running encounter and the open progress tasks. */
export function exportAll() {
  return JSON.stringify({
    app: 'reich62-player',
    exportedAt: new Date().toISOString(),
    characters: listCharacters(),
    cell: getCell(),
    settings: Settings.raw(),
    rollLog: readJson(K_LOG, []),
    oracleLog: readJson(K_ORACLE_LOG, []),
    ideaLog: readJson(K_IDEA_LOG, []),
    combat: readJson(K_COMBAT, null),
    tasks: readJson(K_TASKS, [])
  }, null, 2);
}

/** What a backup file holds and what is on this device, so an import can be described
 *  before it happens rather than silently replacing everything. */
export function describeBackup(json) {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json;
  if (!parsed || parsed.app !== 'reich62-player') throw new Error('Not a REICH \'62 Player backup file.');
  const combat = parsed.combat || {};
  return {
    parsed,
    incoming: {
      characters: (parsed.characters || []).map((c) => (c.identity || {}).name || 'Unnamed'),
      cell: parsed.cell ? (parsed.cell.name || 'unnamed network') : null,
      cellHeat: parsed.cell ? parsed.cell.cellHeat : null,
      rollLog: (parsed.rollLog || []).length,
      oracleLog: (parsed.oracleLog || []).length,
      ideaLog: (parsed.ideaLog || []).length,
      combatRound: combat.active ? combat.round : null,
      tasks: (parsed.tasks || []).length
    },
    current: {
      characters: listCharacters().map((c) => c.identity.name || 'Unnamed'),
      rollLog: readJson(K_LOG, []).length,
      oracleLog: readJson(K_ORACLE_LOG, []).length,
      ideaLog: readJson(K_IDEA_LOG, []).length,
      tasks: listTasks().length
    }
  };
}

/** `mode` is 'replace' — everything on the device gives way to the file — or 'merge',
 *  which adds the file's characters alongside the ones already here. */
export function importAll(json, { mode = 'replace' } = {}) {
  const { parsed } = describeBackup(json);
  const incoming = (parsed.characters || []).map(normalise);

  if (mode === 'merge') {
    const existing = readJson(K_CHARACTERS, []);
    const byId = new Map(existing.map((c) => [c.id, c]));
    incoming.forEach((c) => byId.set(c.id, c));
    writeJson(K_CHARACTERS, [...byId.values()]);
  } else {
    writeJson(K_CHARACTERS, incoming);
    if (parsed.rollLog) localStorage.setItem(K_LOG, JSON.stringify(parsed.rollLog));
    if (parsed.oracleLog) localStorage.setItem(K_ORACLE_LOG, JSON.stringify(parsed.oracleLog));
    if (parsed.ideaLog) localStorage.setItem(K_IDEA_LOG, JSON.stringify(parsed.ideaLog));
    if (parsed.combat) writeJson(K_COMBAT, parsed.combat);
    if (parsed.tasks) writeJson(K_TASKS, parsed.tasks);
    if (parsed.cell) writeJson(K_CELL, parsed.cell);
    if (parsed.settings) writeJson(STORAGE_PREFIX + 'settings', parsed.settings);
  }
  document.dispatchEvent(new CustomEvent('store:changed', { detail: { kind: 'import' } }));
  return { characters: incoming.length, mode };
}

export { blankCharacter };

// --- combat, tasks and lifecycle (Phase 4) ---
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
