// combat.js — the combat tracker (initiative slots, turn budget, combatant cards),
// the generic progress-task tracker, and the scene/session lifecycle engine.

import { el, clear, titleCase, uid, clamp, rollDie } from './core.js';
import { showToast, confirmModal, modal, panel, accordion, emptyState, outcomeBox } from './ui.js';
import { PANELS } from './help.js';
import {
  MANEUVER_RULES, COMBAT_SEQUENCE, LIFECYCLE, RECOVERY, HEAT, XP_AWARDS, RANGE_BANDS
} from '../data.js';
import { BESTIARY, ENCOUNTER_BLOCKS } from '../data-monsters.js';
import { VEHICLES, VEHICLE_RULES } from '../data.js';
import { minionGroupWoundThreshold, minionGroupSkillRanks, bestiaryEntry, encounterBlock } from './rules.js';
import { woundThreshold, strainThreshold, soak, derivedFor } from './derived.js';
import {
  getCombat, saveCombat, blankCombat, listTasks, saveTasks, activeCharacter, listCharacters,
  saveCharacter, getCell, saveCell, snapshot, undoSnapshot, lastSnapshot
} from './store.js';
import { applyCellHeat, applyPersonalHeat, safehouseFor } from './heat.js';

// ---------------------------------------------------------------------------
// Initiative slots (§5, §5A')
// ---------------------------------------------------------------------------

/** Rank initiative rolls into slots. Ties break by Advantage, then PC before NPC (§5). */
export function buildSlots(rolls) {
  const ordered = [...rolls].sort((a, b) => {
    if (b.success !== a.success) return b.success - a.success;
    if (b.advantage !== a.advantage) return b.advantage - a.advantage;
    if (a.owner !== b.owner) return a.owner === 'pc' ? -1 : 1;
    return 0;
  });
  return ordered.map((roll, index) => ({
    id: uid(), order: index + 1, owner: roll.owner, label: roll.label || titleCase(roll.owner),
    success: roll.success, advantage: roll.advantage, filledBy: null
  }));
}

export function startEncounter(rolls) {
  const combat = blankCombat();
  combat.active = true;
  combat.round = 1;
  combat.slots = buildSlots(rolls);
  combat.combatants = getCombat().combatants || {};
  Object.values(combat.combatants).forEach(resetTurn);
  return saveCombat(combat);
}

/** Slot ownership is fixed for the encounter; the owning side picks who fills each slot. */
export function fillSlot(slotId, combatantId) {
  const combat = getCombat();
  const slot = combat.slots.find((s) => s.id === slotId);
  const combatant = combat.combatants[combatantId];
  if (!slot || !combatant) return { ok: false, reason: 'Unknown slot or combatant.' };
  if (combatant.side !== slot.owner) return { ok: false, reason: `That slot belongs to the ${slot.owner.toUpperCase()} side (§5A').` };
  if (combatant.actedThisRound) return { ok: false, reason: 'That combatant has already acted this round.' };
  if (slot.filledBy) return { ok: false, reason: 'That slot is already taken this round.' };
  slot.filledBy = combatantId;
  combatant.actedThisRound = true;
  saveCombat(combat);
  return { ok: true };
}

export function nextRound() {
  const combat = getCombat();
  combat.round += 1;
  combat.slots.forEach((s) => { s.filledBy = null; });
  Object.values(combat.combatants).forEach(resetTurn);
  // Reinforcements (B§2): at three rounds or more the GM may add a minion to the group.
  const eligible = Object.values(combat.combatants).filter((c) => (c.abilities || []).includes('reinforcements'));
  const notes = combat.round >= 3 && eligible.length
    ? eligible.map((c) => `${c.name}: Reinforcements may add one minion this round (B§2).`)
    : [];
  saveCombat(combat);
  return { round: combat.round, notes };
}

function resetTurn(combatant) {
  combatant.actedThisRound = false;
  combatant.maneuversUsed = 0;
  combatant.actionUsed = false;
}

export function endEncounterState() {
  const combat = getCombat();
  combat.active = false;
  combat.slots = [];
  saveCombat(combat);
  return combat;
}

// ---------------------------------------------------------------------------
// Turn budget (§5A, §5B): one action plus one free maneuver; a second maneuver costs
// 2 strain; never more than two maneuvers.
// ---------------------------------------------------------------------------

export function spendManeuver(combatantId) {
  const combat = getCombat();
  const c = combat.combatants[combatantId];
  if (!c) return { ok: false, reason: 'Unknown combatant.' };
  if (c.maneuversUsed >= MANEUVER_RULES.maxPerTurn) {
    return { ok: false, reason: `Never more than ${MANEUVER_RULES.maxPerTurn} maneuvers in a turn (§5A).` };
  }
  const strainCost = c.maneuversUsed >= MANEUVER_RULES.freePerTurn ? MANEUVER_RULES.secondManeuverStrainCost : 0;
  if (strainCost && c.tier === 'minion') {
    return { ok: false, reason: 'Minions cannot choose to suffer strain (§12C).' };
  }
  c.maneuversUsed += 1;
  if (strainCost) c.strain = (c.strain || 0) + strainCost;
  saveCombat(combat);
  return { ok: true, strainCost, maneuversUsed: c.maneuversUsed };
}

export function spendAction(combatantId) {
  const combat = getCombat();
  const c = combat.combatants[combatantId];
  if (!c) return { ok: false, reason: 'Unknown combatant.' };
  if (c.actionUsed) return { ok: false, reason: 'The action for this turn is already spent (§5B).' };
  c.actionUsed = true;
  saveCombat(combat);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Combatants
// ---------------------------------------------------------------------------

/** Drop a published bestiary entry straight in. Printed stats load verbatim (R-15). */
export function addFromBestiary(entryId, { groupSize = null, side = 'npc' } = {}) {
  const source = bestiaryEntry(entryId);
  if (!source) return { ok: false, reason: 'Unknown bestiary entry.' };
  const combat = getCombat();
  const id = uid();
  const size = groupSize ?? source.defaultGroupSize ?? 1;
  const combatant = {
    id, name: source.name, side, tier: source.tier, kind: source.kind,
    sourceId: source.id, sourceBook: source.sourceBook, derivedFrom: source.derivedFrom, // R-15
    characteristics: source.characteristics, skills: source.skills || {},
    soak: source.soak ?? 0,
    meleeDef: (source.defense || {}).melee ?? 0,   // R-17
    rangedDef: (source.defense || {}).ranged ?? 0, // R-17
    silhouette: source.silhouette ?? 1,
    abilities: source.abilities || [],
    adversary: source.adversary || 0,
    promotable: !!source.promotable, // R-16
    wounds: 0, strain: 0,
    strainThreshold: source.strainThreshold ?? null, // nemeses only (§12C)
    woundThresholdPerMember: source.woundThresholdPerMember ?? null,
    minionCount: source.tier === 'minion' ? size : null,
    woundThreshold: source.tier === 'minion'
      ? minionGroupWoundThreshold(source.woundThresholdPerMember || 0, size) // R-18
      : source.woundThreshold,
    conditions: {}, criticalInjuries: [], actedThisRound: false, maneuversUsed: 0, actionUsed: false
  };
  combat.combatants[id] = combatant;
  saveCombat(combat);
  return { ok: true, combatant };
}

export function addPlayerCharacter(characterId, { side = 'pc' } = {}) {
  const character = listCharacters().find((c) => c.id === characterId);
  if (!character) return { ok: false, reason: 'Unknown character.' };
  const combat = getCombat();
  const id = uid();
  const derived = derivedFor(character);
  combat.combatants[id] = {
    id, name: character.identity.name || 'Unnamed', side, tier: 'pc', kind: 'pc',
    characterId: character.id, derivedFrom: 'pc',
    soak: derived.soak, meleeDef: derived.meleeDefense, rangedDef: derived.rangedDefense,
    silhouette: 1, abilities: [], adversary: 0,
    wounds: character.state.wounds, strain: character.state.strain,
    woundThreshold: derived.woundThreshold, strainThreshold: derived.strainThreshold,
    minionCount: null, woundThresholdPerMember: null,
    conditions: {}, criticalInjuries: [], actedThisRound: false, maneuversUsed: 0, actionUsed: false
  };
  saveCombat(combat);
  return { ok: true, combatant: combat.combatants[id] };
}

/** Resize a minion group: group Wound Threshold recomputes as per-member × count (R-18). */
export function resizeMinionGroup(combatantId, count) {
  const combat = getCombat();
  const c = combat.combatants[combatantId];
  if (!c || c.tier !== 'minion') return { ok: false, reason: 'Not a minion group.' };
  c.minionCount = Math.max(0, count);
  c.woundThreshold = minionGroupWoundThreshold(c.woundThresholdPerMember || 0, c.minionCount);
  saveCombat(combat);
  return { ok: true, woundThreshold: c.woundThreshold, groupSkillRanks: minionGroupSkillRanks(c.minionCount) };
}

/** R-16 — the Guard Dog ships as a minion and can be promoted to Rival in one tap. */
export function promoteToRival(combatantId) {
  const combat = getCombat();
  const c = combat.combatants[combatantId];
  if (!c || !c.promotable) return { ok: false, reason: 'This combatant is not promotable.' };
  const source = bestiaryEntry(c.sourceId);
  c.tier = 'rival';
  c.minionCount = null;
  c.woundThreshold = source.woundThreshold; // printed value is kept (R-16)
  saveCombat(combat);
  return { ok: true, tier: 'rival', woundThreshold: c.woundThreshold };
}

/** Apply damage. Minion groups drop a member per share of the group threshold (§12C). */
export function damageCombatant(combatantId, { wounds = 0, strain = 0, critical = false }) {
  const combat = getCombat();
  const c = combat.combatants[combatantId];
  if (!c) return { ok: false, reason: 'Unknown combatant.' };
  const notes = [];

  // Minions and rivals have no strain track: strain effects inflict wounds instead (§12C).
  let woundDelta = wounds;
  if (strain && (c.tier === 'minion' || c.tier === 'rival')) {
    woundDelta += strain;
    notes.push('No strain track at this tier — the strain became wounds (§12C).');
  } else if (strain) {
    c.strain = clamp((c.strain || 0) + strain, 0, 999);
  }
  c.wounds = clamp((c.wounds || 0) + woundDelta, 0, 999);

  if (c.tier === 'minion') {
    const perMember = c.woundThresholdPerMember || 1;
    if (critical) {
      // Any Critical Injury takes one minion out; the group takes that share plus one (§12C).
      c.wounds += perMember + 1;
      notes.push('A Critical Injury instantly takes one minion out of the fight (§12C).');
    }
    const dropped = Math.min(c.minionCount, Math.floor(c.wounds / perMember));
    const remaining = Math.max(0, c.minionCount - dropped);
    if (dropped > 0) notes.push(`${dropped} minion(s) down; ${remaining} still standing.`);
    c.minionsDown = dropped;
    c.defeated = remaining === 0;
  } else {
    c.defeated = c.wounds >= c.woundThreshold;
    if (c.defeated && c.tier === 'rival') notes.push('The GM may rule a rival killed outright past their threshold (§12C).');
    if (c.defeated && c.tier === 'nemesis') notes.push('Incapacitated at the threshold (§6).');
  }

  // Mirror back to the character sheet when this is a PC.
  if (c.characterId) {
    const character = listCharacters().find((x) => x.id === c.characterId);
    if (character) {
      character.state.wounds = c.wounds;
      character.state.strain = c.strain;
      character.state.incapacitated = c.wounds >= woundThreshold(character) || c.strain >= strainThreshold(character);
      saveCharacter(character);
    }
  }

  saveCombat(combat);
  return { ok: true, combatant: c, notes };
}

/** Papers-Check Reflex (B§2): a PC who fails a Deception or Cool check against this group
 *  takes a Personal Heat check automatically. */
export function papersCheckReflex(combatantId, character, { failed }) {
  const combat = getCombat();
  const c = combat.combatants[combatantId];
  if (!c || !(c.abilities || []).includes('papersCheckReflex')) {
    return { ok: false, reason: 'This combatant does not have Papers-Check Reflex.' };
  }
  if (!failed) return { ok: true, triggered: false, note: 'The check held up; no Heat (B§2).' };
  const applied = applyPersonalHeat(character, 1);
  return {
    ok: true, triggered: true, applied,
    note: `Papers-Check Reflex: Personal Heat ${applied.before} → ${applied.after} (B§2, §17.1).`
  };
}

/** Hartmann Voss escalates personally once Cell Heat reaches 4 (B§4). */
export function nemesisEscalation() {
  const cell = getCell();
  const escalating = Object.values(getCombat().combatants)
    .filter((c) => c.sourceId === 'hartmannVoss');
  const source = BESTIARY.find((e) => e.id === 'hartmannVoss');
  const threshold = source.heatHook.cellHeat;
  if (cell.cellHeat < threshold) return { triggered: false, threshold, cellHeat: cell.cellHeat };
  return {
    triggered: true, threshold, cellHeat: cell.cellHeat,
    inPlay: escalating.length > 0,
    note: `Cell Heat is ${cell.cellHeat}: ${source.name} escalates personally (B§4).`
  };
}

export function removeCombatant(combatantId) {
  const combat = getCombat();
  delete combat.combatants[combatantId];
  combat.slots.forEach((s) => { if (s.filledBy === combatantId) s.filledBy = null; });
  saveCombat(combat);
}

// ---------------------------------------------------------------------------
// Vehicle scale (§12) — the same engine, personal-scale damage, five range bands.
// ---------------------------------------------------------------------------

export function addVehicle(vehicleId, { pilotCombatantId = null } = {}) {
  const source = VEHICLES.find((v) => v.id === vehicleId);
  if (!source) return { ok: false, reason: 'Unknown vehicle.' };
  const combat = getCombat();
  const id = uid();
  combat.vehicles = combat.vehicles || {};
  combat.vehicles[id] = {
    id, sourceId: source.id, name: source.name,
    silhouette: source.silhouette, handling: source.handling,
    speed: 0, maxSpeed: source.speed,
    defense: source.defense, armour: source.armour,
    hullTrauma: 0, hullThreshold: source.hull,
    systemStrain: 0, systemStrainThreshold: source.systemStrain,
    pilotCombatantId, disabled: false
  };
  saveCombat(combat);
  return { ok: true, vehicle: combat.vehicles[id] };
}

export function changeSpeed(vehicleId, delta) {
  const combat = getCombat();
  const v = combat.vehicles[vehicleId];
  if (!v) return { ok: false, reason: 'Unknown vehicle.' };
  v.speed = clamp(v.speed + delta, 0, v.maxSpeed);
  saveCombat(combat);
  return { ok: true, speed: v.speed };
}

export function vehicleDamage(vehicleId, { hull = 0, systemStrain = 0 }) {
  const combat = getCombat();
  const v = combat.vehicles[vehicleId];
  if (!v) return { ok: false, reason: 'Unknown vehicle.' };
  v.hullTrauma = clamp(v.hullTrauma + hull, 0, 999);
  v.systemStrain = clamp(v.systemStrain + systemStrain, 0, 999);
  v.disabled = v.hullTrauma >= v.hullThreshold || v.systemStrain >= v.systemStrainThreshold;
  saveCombat(combat);
  return { ok: true, vehicle: v };
}

/** A crash inflicts hull trauma equal to current speed (§12). */
export function crashVehicle(vehicleId) {
  const combat = getCombat();
  const v = combat.vehicles[vehicleId];
  if (!v) return { ok: false, reason: 'Unknown vehicle.' };
  const trauma = v.speed;
  const result = vehicleDamage(vehicleId, { hull: trauma });
  return {
    ok: true, trauma, vehicle: result.vehicle,
    note: `Lost control at speed ${trauma}: ${trauma} hull trauma, and occupants may take wounds or a Critical Injury roll as though from a fall (§12).`
  };
}

export function repairSystemStrain(vehicleId) {
  const combat = getCombat();
  const v = combat.vehicles[vehicleId];
  if (!v) return { ok: false, reason: 'Unknown vehicle.' };
  v.systemStrain = Math.max(0, v.systemStrain - 1);
  saveCombat(combat);
  return { ok: true, systemStrain: v.systemStrain, note: 'One system strain recovered — a day undamaged, or the Damage Control action (§12).' };
}

export function removeVehicle(vehicleId) {
  const combat = getCombat();
  delete combat.vehicles[vehicleId];
  saveCombat(combat);
}

/** Save an NPC built from the §12C recipes. Recipe-built NPCs derive, so they stay
 *  distinguishable from the printed blocks that never do (R-15). */
export function addRecipeNpc({ name, tier, characteristics, skills = {}, soak = null, woundThreshold = null, strainThreshold = null, abilities = [], adversary = 0, minionCount = 1, woundThresholdPerMember = null }) {
  const combat = getCombat();
  const id = uid();
  const brawn = (characteristics && characteristics.brawn) || 2;
  const willpower = (characteristics && characteristics.willpower) || 2;
  const derivedSoak = soak ?? brawn;
  const derivedWt = tier === 'minion'
    ? minionGroupWoundThreshold(woundThresholdPerMember ?? (5 + brawn), minionCount)
    : woundThreshold ?? (10 + brawn);
  combat.combatants[id] = {
    id, name, side: 'npc', tier, kind: tier,
    sourceId: null, sourceBook: 'manual', derivedFrom: 'recipe', // R-15
    characteristics, skills,
    soak: derivedSoak, meleeDef: 0, rangedDef: 0, silhouette: 1,
    abilities, adversary,
    wounds: 0, strain: 0,
    woundThreshold: derivedWt,
    strainThreshold: tier === 'nemesis' ? (strainThreshold ?? (10 + willpower)) : null,
    woundThresholdPerMember: tier === 'minion' ? (woundThresholdPerMember ?? (5 + brawn)) : null,
    minionCount: tier === 'minion' ? minionCount : null,
    conditions: {}, criticalInjuries: [], actedThisRound: false, maneuversUsed: 0, actionUsed: false
  };
  saveCombat(combat);
  return { ok: true, combatant: combat.combatants[id] };
}

// ---------------------------------------------------------------------------
// Generic progress tracker (§3.13) — Heat, repairs, ad-hoc clocks, and the Dragnet.
// ---------------------------------------------------------------------------

export function createTask({ name, kind = 'clock', target = 4, oppositionDice = null, note = '' }) {
  const tasks = listTasks();
  const task = {
    id: uid(), name, kind, progress: 0, target, contributors: [], note,
    oppositionDice: oppositionDice ?? (kind === 'dragnet' ? ENCOUNTER_BLOCKS.find((b) => b.id === 'manhuntDragnet').resolution.oppositionDiceStart : null),
    elapsedHours: 0, closed: false, createdAt: Date.now()
  };
  tasks.push(task);
  saveTasks(tasks);
  return task;
}

export function advanceTask(taskId, amount = 1, contributor = null) {
  const tasks = listTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return { ok: false, reason: 'Unknown task.' };
  task.progress = clamp(task.progress + amount, 0, task.target);
  if (contributor) task.contributors.push({ who: contributor, amount, ts: Date.now() });
  task.closed = task.progress >= task.target;
  saveTasks(tasks);
  return { ok: true, task };
}

/** One round of the Manhunt/Dragnet extended opposed check (B§6).
 *  Opposition starts at 2 dice, gains 1 per in-game hour, capped at 4. Every failed round
 *  advances Personal *and* Cell Heat by 1. */
export function dragnetRound(taskId, { failed, character = null, hoursElapsed = 1 }) {
  const block = encounterBlock('manhuntDragnet');
  const tasks = listTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return { ok: false, reason: 'Unknown task.' };

  task.elapsedHours += hoursElapsed;
  task.oppositionDice = Math.min(
    block.resolution.oppositionDiceMax,
    block.resolution.oppositionDiceStart + task.elapsedHours * block.resolution.oppositionDicePerHour
  );

  const effects = [];
  if (failed) {
    task.progress = clamp(task.progress + 1, 0, task.target);
    if (character) {
      const personal = applyPersonalHeat(character, 1);
      effects.push(`Personal Heat ${personal.before} → ${personal.after} (B§6).`);
    }
    const cell = applyCellHeat(1);
    effects.push(`Cell Heat ${cell.before} → ${cell.after} (B§6).`);
  } else {
    effects.push('The round is survived; the dragnet grinds on until the search zone is left behind (B§6).');
  }
  task.closed = task.progress >= task.target;
  saveTasks(tasks);
  return { ok: true, task, oppositionDice: task.oppositionDice, effects };
}

export function closeTask(taskId) {
  const tasks = listTasks().filter((t) => t.id !== taskId);
  saveTasks(tasks);
}

// ---------------------------------------------------------------------------
// Lifecycle engine (§3.12): each boundary fires a bundle, shows what it changed,
// and can be undone in one step.
// ---------------------------------------------------------------------------

const FLAG_KEYS = {
  encounter: 'perEncounterFlags',
  scene: 'perSceneFlags',
  session: 'perSessionFlags',
  day: 'perDayFlags',
  week: 'perWeekFlags'
};

export function previewBoundary(boundaryId, options = {}) {
  const boundary = LIFECYCLE.boundaries.find((b) => b.id === boundaryId);
  if (!boundary) return null;
  const deltas = [];
  const characters = listCharacters();
  const cell = getCell();

  if (boundaryId === 'encounter') {
    deltas.push('Prompt the end-of-encounter strain recovery check: Simple Discipline or Cool, one strain per uncancelled Success (§5G).');
    deltas.push('Clear every once-per-encounter talent and ability flag.');
    deltas.push('Clear "out of ammunition for the encounter" states and expire round-duration effects.');
  }
  if (boundaryId === 'scene') {
    deltas.push('Expire scene-duration effects and per-scene dread-check flags (§29).');
    characters.forEach((c) => {
      if (c.state.personalHeat >= 1) deltas.push(`${c.identity.name || 'Unnamed'}: Heat threshold re-check at Personal ${c.state.personalHeat} (§22.4).`);
    });
  }
  if (boundaryId === 'session') {
    const xp = XP_AWARDS.standardPerSession + (options.lengthAdjustment || 0) + (options.motivationPlay ? XP_AWARDS.motivationBonus : 0);
    deltas.push(`Award ${xp} XP to every character (${XP_AWARDS.standardPerSession} base${options.lengthAdjustment ? `, ${options.lengthAdjustment > 0 ? '+' : ''}${options.lengthAdjustment} for length` : ''}${options.motivationPlay ? `, +${XP_AWARDS.motivationBonus} for Motivation play` : ''}) (§27).`);
    if (options.downtime) {
      characters.filter((c) => c.state.personalHeat > 0)
        .forEach((c) => deltas.push(`${c.identity.name || 'Unnamed'}: Personal Heat ${c.state.personalHeat} → ${c.state.personalHeat - 1} for low-risk downtime (§17.4).`));
      if (cell.cellHeat > 0 && characters.every((c) => c.state.personalHeat - 1 < 3)) {
        deltas.push(`Cell Heat ${cell.cellHeat} → ${cell.cellHeat - 1}: no member is at Personal Heat 3 or more (§17.4).`);
      }
    }
    deltas.push('Clear every once-per-session talent flag. Story Points carry over and are not reset (§8).');
  }
  if (boundaryId === 'day') {
    deltas.push('Reset the painkiller counter (§5G).');
    deltas.push('Recover 1 vehicle system strain on undamaged vehicles (§12).');
  }
  if (boundaryId === 'week') {
    deltas.push('The week-rest Critical Injury check is available again (§5G).');
    deltas.push('Reset the per-injury Medicine limit (§5G).');
  }
  if (boundaryId === 'adventure') {
    characters.filter((c) => c.state.personalHeat >= HEAT.max)
      .forEach((c) => deltas.push(`${c.identity.name || 'Unnamed'} is at Personal Heat ${HEAT.max}: go underground, resetting Heat to 2, or be captured (§24).`));
    if (!deltas.length) deltas.push('No character is at maximum Heat; nothing to resolve (§24).');
  }
  return { boundary, deltas };
}

export function fireBoundary(boundaryId, options = {}) {
  const boundary = LIFECYCLE.boundaries.find((b) => b.id === boundaryId);
  if (!boundary) return { ok: false, reason: 'Unknown boundary.' };
  const preview = previewBoundary(boundaryId, options);
  snapshot(`End ${boundaryId}`); // one-step undo (§3.12)

  const characters = listCharacters();
  const flagKey = FLAG_KEYS[boundaryId];

  characters.forEach((character) => {
    if (flagKey) character.state[flagKey] = flagKey === 'perDayFlags' ? { painkillers: 0 } : {};
    if (boundaryId === 'session') {
      const xp = XP_AWARDS.standardPerSession + (options.lengthAdjustment || 0) + (options.motivationPlay ? XP_AWARDS.motivationBonus : 0);
      character.xp.total += xp;
      character.xp.available += xp;
      character.advancementLog.push({ ts: Date.now(), kind: 'award', detail: 'Session award (§27)', xpSpent: -xp });
      if (options.downtime && character.state.personalHeat > 0) character.state.personalHeat -= 1;
    }
    if (boundaryId === 'day') character.state.perDayFlags = { painkillers: 0 };
    if (boundaryId === 'encounter') {
      Object.keys(character.state.conditions || {}).forEach((id) => {
        if (['staggered', 'disoriented'].includes(id)) return; // these last until healed when a Critical caused them
        if (character.state.conditions[id] === 'encounter') character.state.conditions[id] = false;
      });
    }
    saveCharacter(character);
  });

  if (boundaryId === 'session' && options.downtime) {
    const cell = getCell();
    const stillHot = listCharacters().some((c) => c.state.personalHeat >= 3);
    if (!stillHot && cell.cellHeat > 0) {
      cell.cellHeat -= 1;
      cell.safehouseStatus = safehouseFor(cell.cellHeat);
      saveCell(cell);
    }
  }

  if (boundaryId === 'encounter') {
    const combat = getCombat();
    if (combat.active) endEncounterState();
  }

  return { ok: true, boundary, deltas: preview.deltas, undoAvailable: true };
}

export function undoLastBoundary() {
  const restored = undoSnapshot();
  return restored ? { ok: true, label: restored.label } : { ok: false, reason: 'Nothing to undo.' };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

let lastBoundaryResult = null;

export function renderCombat(mount) {
  clear(mount);
  const rerender = () => renderCombat(mount);
  const combat = getCombat();
  if (lastBoundaryResult) {
    mount.append(outcomeBox([`${lastBoundaryResult.name} applied.`, ...lastBoundaryResult.deltas, 'Undo is available below until you fire another boundary.'], { title: 'What just happened' }));
  }

  // --- lifecycle controls ---
  const lifecycle = panel('Wrapping up', PANELS.combatLifecycle, []);
  const sessionOptions = { downtime: false, motivationPlay: false, lengthAdjustment: 0 };
  LIFECYCLE.boundaries.forEach((boundary) => {
    lifecycle.append(el('button', {
      type: 'button', class: 'secondary', text: boundary.name,
      onclick: async () => {
        const preview = previewBoundary(boundary.id, sessionOptions);
        const body = el('div', {}, [
          el('ul', { class: 'small' }, preview.deltas.map((d) => el('li', { text: d })))
        ]);
        if (boundary.id === 'session') {
          body.append(checkbox('lc-downtime', 'This session was low-risk downtime (Heat −1, §17.4)', (v) => { sessionOptions.downtime = v; }));
          body.append(checkbox('lc-motivation', `Motivation was meaningfully played (+${XP_AWARDS.motivationBonus} XP, §27)`, (v) => { sessionOptions.motivationPlay = v; }));
        }
        const m = modal({
          title: boundary.name,
          body,
          actions: [
            { label: 'Cancel', value: false },
            { label: 'Apply', value: true, primary: true }
          ]
        });
        m.onClose((confirmed) => {
          if (!confirmed) return;
          const result = fireBoundary(boundary.id, sessionOptions);
          lastBoundaryResult = { name: boundary.name, deltas: result.deltas };
          rerender();
        });
      }
    }));
    lifecycle.append(document.createTextNode(' '));
  });
  const undoAvailable = lastSnapshot();
  lifecycle.append(el('button', {
    type: 'button', class: 'primary', text: undoAvailable ? `Undo ${undoAvailable.label}` : 'Nothing to undo',
    disabled: !undoAvailable,
    onclick: () => { const r = undoLastBoundary(); showToast(r.ok ? `Undone: ${r.label}` : r.reason); rerender(); }
  }));
  mount.append(lifecycle);

  // --- initiative ---
  const initiative = panel(combat.active ? `Turn order — round ${combat.round}` : 'Turn order', PANELS.combatInitiative, []);

  if (!combat.active) {
    const rolls = [];
    const rollList = el('div');
    const draw = () => {
      clear(rollList);
      rolls.forEach((r, i) => rollList.append(el('p', { class: 'small', text: `${r.label} (${r.owner.toUpperCase()}): ${r.success} Success, ${r.advantage} Advantage` })));
    };
    const label = el('input', { type: 'text', id: 'init-label', placeholder: 'Name', 'aria-label': 'Initiative roll name' });
    const success = el('input', { type: 'number', id: 'init-success', min: '0', value: '0', 'aria-label': 'Uncancelled Success' });
    const advantage = el('input', { type: 'number', id: 'init-advantage', min: '0', value: '0', 'aria-label': 'Uncancelled Advantage' });
    const owner = el('select', { id: 'init-owner', 'aria-label': 'Side' }, [
      el('option', { value: 'pc', text: 'PC slot' }),
      el('option', { value: 'npc', text: 'NPC slot' })
    ]);
    initiative.append(
      el('p', { class: 'small', text: 'Everyone rolls a Simple Cool or Vigilance check; enter each result to build the slot order (§5).' }),
      label, success, advantage, owner,
      el('button', {
        type: 'button', class: 'secondary', text: 'Add roll',
        onclick: () => {
          rolls.push({ label: label.value || 'Participant', owner: owner.value, success: Number(success.value), advantage: Number(advantage.value) });
          label.value = ''; success.value = '0'; advantage.value = '0';
          draw();
        }
      }),
      rollList,
      el('button', {
        type: 'button', class: 'primary', text: 'Start encounter',
        onclick: () => { if (!rolls.length) { showToast('Add at least one initiative roll'); return; } startEncounter(rolls); rerender(); }
      })
    );
  } else {
    const table = el('table');
    table.append(el('tr', {}, [el('th', { text: '#' }), el('th', { text: 'Owner' }), el('th', { text: 'Filled by' }), el('th', { text: '' })]));
    combat.slots.forEach((slot) => {
      const eligible = Object.values(combat.combatants).filter((c) => c.side === slot.owner && !c.actedThisRound);
      const picker = el('select', { 'aria-label': `Fill slot ${slot.order}`, disabled: !!slot.filledBy || !eligible.length });
      picker.append(el('option', { value: '', text: slot.filledBy ? (combat.combatants[slot.filledBy] || {}).name || '—' : 'choose…' }));
      eligible.forEach((c) => picker.append(el('option', { value: c.id, text: c.name })));
      picker.addEventListener('change', () => {
        const result = fillSlot(slot.id, picker.value);
        if (!result.ok) showToast(result.reason);
        rerender();
      });
      table.append(el('tr', {}, [
        el('td', { text: String(slot.order) }),
        el('td', { text: slot.owner.toUpperCase() }),
        el('td', {}, [picker]),
        el('td', { text: slot.filledBy ? 'acted' : '' })
      ]));
    });
    initiative.append(el('div', { class: 'table-wrap' }, [table]));
    initiative.append(el('button', {
      type: 'button', class: 'secondary', text: 'Next round',
      onclick: () => { const r = nextRound(); r.notes.forEach((n) => showToast(n)); rerender(); }
    }));
    initiative.append(el('button', {
      type: 'button', class: 'secondary', text: 'End encounter',
      onclick: () => { endEncounterState(); showToast('Encounter ended — fire End Encounter to run the bundle'); rerender(); }
    }));
  }
  mount.append(initiative);

  // --- combatants ---
  const roster = panel('Who is in the fight', PANELS.combatRoster, []);
  const character = activeCharacter();
  if (character) {
    roster.append(el('button', {
      type: 'button', class: 'secondary', text: `Add ${character.identity.name || 'active character'}`,
      onclick: () => { addPlayerCharacter(character.id); rerender(); }
    }));
  }
  const bestiarySelect = el('select', { id: 'bestiary-pick', 'aria-label': 'Bestiary entry' });
  BESTIARY.forEach((e) => bestiarySelect.append(el('option', { value: e.id, text: `${e.name} (${e.kind})` })));
  roster.append(bestiarySelect, el('button', {
    type: 'button', class: 'secondary', text: 'Drop in',
    onclick: () => { const r = addFromBestiary(bestiarySelect.value); if (!r.ok) showToast(r.reason); rerender(); }
  }));

  if (!Object.keys(combat.combatants).length) {
    roster.append(emptyState('Nobody in the fight yet. Add your character, or drop an opponent in from the list above.'));
  }
  Object.values(combat.combatants).forEach((c) => {
    const card = el('div', { class: 'result' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: `${c.name}${c.minionCount ? ` ×${c.minionCount}` : ''}` }),
        el('span', { class: 'cite', text: `${c.tier} · ${c.side.toUpperCase()}` })
      ]),
      el('div', { class: 'result-body', text: `Wounds ${c.wounds}/${c.woundThreshold ?? '—'}${c.strainThreshold ? ` · Strain ${c.strain}/${c.strainThreshold}` : ''} · Soak ${c.soak} · Def ${c.meleeDef}/${c.rangedDef}${c.adversary ? ` · Adversary ${c.adversary}` : ''}` })
    ]);
    if (c.tier === 'minion' && c.woundThresholdPerMember) {
      card.append(el('p', { class: 'small muted', text: `${c.woundThresholdPerMember} per member × ${c.minionCount} = ${c.woundThreshold} group threshold; group skills at rank ${minionGroupSkillRanks(c.minionCount)} (R-18, §12C).` }));
      card.append(el('button', { type: 'button', class: 'secondary', text: '−1 minion', onclick: () => { resizeMinionGroup(c.id, c.minionCount - 1); rerender(); } }));
      card.append(el('button', { type: 'button', class: 'secondary', text: '+1 minion', onclick: () => { resizeMinionGroup(c.id, c.minionCount + 1); rerender(); } }));
    }
    if (c.promotable && c.tier === 'minion') {
      card.append(el('button', {
        type: 'button', class: 'secondary', text: 'Promote to Rival',
        onclick: () => { promoteToRival(c.id); showToast('Promoted: Critical Injuries now resolve normally (R-16)'); rerender(); }
      }));
    }
    card.append(el('button', { type: 'button', class: 'secondary', text: 'Maneuver', onclick: () => { const r = spendManeuver(c.id); showToast(r.ok ? (r.strainCost ? `Second maneuver: ${r.strainCost} strain (§5A)` : 'Free maneuver used') : r.reason); rerender(); } }));
    card.append(el('button', { type: 'button', class: 'secondary', text: 'Action', onclick: () => { const r = spendAction(c.id); showToast(r.ok ? 'Action used' : r.reason); rerender(); } }));
    card.append(el('button', { type: 'button', class: 'secondary', text: '+1 wound', onclick: () => { const r = damageCombatant(c.id, { wounds: 1 }); r.notes.forEach((n) => showToast(n)); rerender(); } }));
    card.append(el('button', { type: 'button', class: 'secondary', text: 'Critical', onclick: () => { const r = damageCombatant(c.id, { critical: true }); r.notes.forEach((n) => showToast(n)); rerender(); } }));
    card.append(el('button', {
      type: 'button', class: 'secondary', text: 'Remove',
      onclick: async () => {
        if (!(await confirmModal(`Take ${c.name} out of the fight? Their wounds and state are lost.`, { title: 'Remove combatant', confirmLabel: 'Remove' }))) return;
        removeCombatant(c.id); rerender();
      }
    }));
    if (c.defeated) card.append(el('p', { class: 'small', text: 'Out of the fight.' }));
    roster.append(card);
  });
  mount.append(roster);

  // --- vehicles (§12) ---
  const vehicleBody = el('div', {});
  const vehicleCard = panel('Vehicles', PANELS.combatVehicles, [
    accordion('Add or manage a vehicle', [vehicleBody], { key: 'combat-vehicles', summary: `${Object.keys(combat.vehicles || {}).length} in play` })
  ]);
  const vehiclePick = el('select', { id: 'vehicle-pick', 'aria-label': 'Vehicle' });
  VEHICLES.forEach((v) => vehiclePick.append(el('option', { value: v.id, text: `${v.name} (sil ${v.silhouette})` })));
  vehicleBody.append(vehiclePick, el('button', {
    type: 'button', class: 'secondary', text: 'Add vehicle',
    onclick: () => { addVehicle(vehiclePick.value); rerender(); }
  }));
  Object.values(combat.vehicles || {}).forEach((v) => {
    vehicleBody.append(el('div', { class: 'result' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: v.name }),
        el('span', { class: 'cite', text: `sil ${v.silhouette} · handling ${v.handling >= 0 ? '+' : ''}${v.handling}` })
      ]),
      el('div', { class: 'result-body', text: `Speed ${v.speed}/${v.maxSpeed} · hull ${v.hullTrauma}/${v.hullThreshold} · system strain ${v.systemStrain}/${v.systemStrainThreshold} · armour ${v.armour}${v.disabled ? ' · disabled' : ''}` }),
      el('button', { type: 'button', class: 'secondary', text: 'Accelerate', onclick: () => { changeSpeed(v.id, 1); rerender(); } }),
      el('button', { type: 'button', class: 'secondary', text: 'Decelerate', onclick: () => { changeSpeed(v.id, -1); rerender(); } }),
      el('button', { type: 'button', class: 'secondary', text: '+1 system strain', onclick: () => { vehicleDamage(v.id, { systemStrain: 1 }); rerender(); } }),
      el('button', { type: 'button', class: 'secondary', text: 'Damage Control', onclick: () => { const r = repairSystemStrain(v.id); showToast(r.note); rerender(); } }),
      el('button', { type: 'button', class: 'secondary', text: 'Crash', onclick: () => { const r = crashVehicle(v.id); showToast(r.note); rerender(); } }),
      el('button', {
        type: 'button', class: 'secondary', text: 'Remove',
        onclick: async () => {
          if (!(await confirmModal(`Remove ${v.name}? Its damage is lost.`, { title: 'Remove vehicle', confirmLabel: 'Remove' }))) return;
          removeVehicle(v.id); rerender();
        }
      })
    ]));
  });
  mount.append(vehicleCard);

  // --- nemesis escalation hook (B§4) ---
  const escalation = nemesisEscalation();
  if (escalation.triggered) {
    mount.append(el('div', { class: 'card' }, [
      el('h3', { text: 'Nemesis escalation' }),
      el('p', { class: 'small', text: escalation.note })
    ]));
  }

  // --- progress tasks ---
  const tasks = listTasks();
  const taskCard = panel('Things that take a while', PANELS.combatTasks, []);
  const taskName = el('input', { type: 'text', id: 'task-name', placeholder: 'Name', 'aria-label': 'Task name' });
  const taskKind = el('select', { id: 'task-kind', 'aria-label': 'Task kind' }, [
    el('option', { value: 'clock', text: 'Ad-hoc clock (house aid)' }),
    el('option', { value: 'repair', text: 'Repair job (§14B)' }),
    el('option', { value: 'heat', text: 'Heat track (§17)' }),
    el('option', { value: 'dragnet', text: 'Manhunt / Dragnet (B§6)' })
  ]);
  const taskTarget = el('input', { type: 'number', id: 'task-target', min: '1', value: '4', 'aria-label': 'Target' });
  taskCard.append(taskName, taskKind, taskTarget, el('button', {
    type: 'button', class: 'secondary', text: 'Add task',
    onclick: () => { createTask({ name: taskName.value || 'Task', kind: taskKind.value, target: Number(taskTarget.value) }); rerender(); }
  }));

  tasks.forEach((task) => {
    const card = el('div', { class: 'result' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: task.name }),
        el('span', { class: 'cite', text: `${task.progress}/${task.target}${task.kind === 'dragnet' ? ` · ${task.oppositionDice} opposition dice` : ''}` })
      ]),
      el('div', { class: 'result-body', text: task.kind === 'dragnet'
        ? `Stealth or Streetwise against a Perception pool that starts at 2 dice and gains one per in-game hour, capped at 4. Every failed round advances Personal and Cell Heat by 1 (B§6). Elapsed: ${task.elapsedHours}h.`
        : `${titleCase(task.kind)} track.` })
    ]);
    if (task.kind === 'dragnet') {
      card.append(el('button', {
        type: 'button', class: 'secondary', text: 'Failed round',
        onclick: () => { const r = dragnetRound(task.id, { failed: true, character: activeCharacter() }); r.effects.forEach((e) => showToast(e)); rerender(); }
      }));
      card.append(el('button', {
        type: 'button', class: 'secondary', text: 'Survived round',
        onclick: () => { const r = dragnetRound(task.id, { failed: false }); r.effects.forEach((e) => showToast(e)); rerender(); }
      }));
    } else {
      card.append(el('button', { type: 'button', class: 'secondary', text: '+1', onclick: () => { advanceTask(task.id, 1); rerender(); } }));
      card.append(el('button', { type: 'button', class: 'secondary', text: '−1', onclick: () => { advanceTask(task.id, -1); rerender(); } }));
    }
    card.append(el('button', {
      type: 'button', class: 'secondary', text: 'Close',
      onclick: async () => {
        if (!(await confirmModal(`Close "${task.name}"? Its progress is discarded.`, { title: 'Close task', confirmLabel: 'Close it' }))) return;
        closeTask(task.id); rerender();
      }
    }));
    taskCard.append(card);
  });
  mount.append(taskCard);
}

function checkbox(id, label, onChange) {
  return el('div', { class: 'toggle-row' }, [
    el('input', { type: 'checkbox', id, onchange: (e) => onChange(e.target.checked) }),
    el('label', { for: id }, [el('span', { text: label })])
  ]);
}
