// combat.js — the combat tracker (initiative slots, turn budget, combatant cards),
// the generic progress-task tracker, and the scene/session lifecycle engine.

import { el, clear, titleCase, uid, clamp, rollDie } from './core.js';
import { showToast, confirmModal, modal, panel, accordion, emptyState, outcomeBox } from './ui.js';
import { PANELS } from './help.js';
import {
  MANEUVER_RULES, COMBAT_SEQUENCE, LIFECYCLE, RECOVERY, HEAT, XP_AWARDS, RANGE_BANDS,
  MANEUVERS, ACTION_TYPES, CONDITIONS, DIE_FACES
} from '../data.js';
import { BESTIARY, ENCOUNTER_BLOCKS } from '../data-monsters.js';
import { VEHICLES, VEHICLE_RULES } from '../data.js';
import {
  minionGroupWoundThreshold, minionGroupSkillRanks, minionCriticalWoundCost,
  bestiaryEntry, encounterBlock, criticalInjuryFor, criticalInjuryTotal, adversaryAbility
} from './rules.js';
import { woundThreshold, strainThreshold, soak, derivedFor } from './derived.js';
import {
  getCombat, saveCombat, blankCombat, listTasks, saveTasks, activeCharacter, listCharacters,
  saveCharacter, getCell, saveCell, snapshot, undoSnapshot, lastSnapshot, setSceneWatched,
  getScene, startScene, endScene
} from './store.js';
import { applyCellHeat, applyPersonalHeat, safehouseFor } from './heat.js';
import { renderClocks } from './clocks.js';
import { Settings } from './settings.js';

/** The conditions a GM realistically holds an NPC in. Heat and encumbrance are the
 *  character's own bookkeeping and never apply to a dropped-in opponent. */
const COMBAT_CONDITIONS = CONDITIONS.filter((c) =>
  !c.id.startsWith('heat') && !['encumbered', 'incapacitated'].includes(c.id));

/** A Simple initiative check rolled for an NPC when the simulated roller is on (§5). */
function rollInitiative(skillRank, characteristic) {
  const built = { ability: Math.max(skillRank, characteristic) - Math.min(skillRank, characteristic),
                  proficiency: Math.min(skillRank, characteristic) };
  let success = 0;
  let advantage = 0;
  const roll = (faces) => { const f = faces[Math.floor(Math.random() * faces.length)]; f.forEach((sym) => { if (sym === 'success') success += 1; if (sym === 'advantage') advantage += 1; }); };
  for (let i = 0; i < built.ability; i += 1) roll(DIE_FACES.ability);
  for (let i = 0; i < built.proficiency; i += 1) roll(DIE_FACES.proficiency);
  return { success, advantage };
}

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
  if (combatant.side !== slot.owner) return { ok: false, reason: `That slot belongs to the ${slot.owner.toUpperCase()} side.` };
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
    ? eligible.map((c) => `${c.name}: Reinforcements may add one minion this round.`)
    : [];
  saveCombat(combat);
  return { round: combat.round, notes };
}

function resetTurn(combatant) {
  combatant.actedThisRound = false;
  combatant.maneuversUsed = 0;
  combatant.actionUsed = false;
  combatant.turnLog = [];
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

export function spendManeuver(combatantId, maneuverId = null) {
  const combat = getCombat();
  const c = combat.combatants[combatantId];
  if (!c) return { ok: false, reason: 'Unknown combatant.' };
  if (c.maneuversUsed >= MANEUVER_RULES.maxPerTurn) {
    return { ok: false, reason: `Never more than ${MANEUVER_RULES.maxPerTurn} maneuvers in a turn.` };
  }
  const strainCost = c.maneuversUsed >= MANEUVER_RULES.freePerTurn ? MANEUVER_RULES.secondManeuverStrainCost : 0;
  if (strainCost && c.tier === 'minion') {
    return { ok: false, reason: 'Minions cannot choose to suffer strain.' };
  }
  c.maneuversUsed += 1;
  if (strainCost) c.strain = (c.strain || 0) + strainCost;
  const def = MANEUVERS.find((m) => m.id === maneuverId);
  c.turnLog = [...(c.turnLog || []), `${def ? def.name : 'Maneuver'}${strainCost ? ` (${strainCost} strain)` : ''}`];
  saveCombat(combat);
  return { ok: true, strainCost, maneuversUsed: c.maneuversUsed, name: def ? def.name : 'Maneuver' };
}

export function spendAction(combatantId, actionId = null) {
  const combat = getCombat();
  const c = combat.combatants[combatantId];
  if (!c) return { ok: false, reason: 'Unknown combatant.' };
  if (c.actionUsed) return { ok: false, reason: 'The action for this turn is already spent.' };
  c.actionUsed = true;
  const def = ACTION_TYPES.find((a) => a.id === actionId);
  c.turnLog = [...(c.turnLog || []), def ? def.name : 'Action'];
  saveCombat(combat);
  return { ok: true, name: def ? def.name : 'Action' };
}

/** Conditions on an NPC (§3.9). They are stored per combatant so the GM can hold a rival
 *  staggered or disoriented for the rounds the rule says. */
export function setCombatantCondition(combatantId, conditionId, on) {
  const combat = getCombat();
  const c = combat.combatants[combatantId];
  if (!c) return { ok: false, reason: 'Unknown combatant.' };
  c.conditions = { ...(c.conditions || {}) };
  if (on) c.conditions[conditionId] = true; else delete c.conditions[conditionId];
  saveCombat(combat);
  return { ok: true, conditions: c.conditions };
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
export function damageCombatant(combatantId, { wounds = 0, strain = 0, critical = false, vicious = 0 } = {}) {
  const combat = getCombat();
  const c = combat.combatants[combatantId];
  if (!c) return { ok: false, reason: 'Unknown combatant.' };
  const notes = [];

  // Minions and rivals have no strain track: strain effects inflict wounds instead (§12C).
  let woundDelta = wounds;
  if (strain && (c.tier === 'minion' || c.tier === 'rival')) {
    woundDelta += strain;
    notes.push('No strain track at this tier — the strain became wounds.');
  } else if (strain) {
    c.strain = clamp((c.strain || 0) + strain, 0, 999);
  }
  c.wounds = clamp((c.wounds || 0) + woundDelta, 0, 999);

  if (c.tier === 'minion') {
    const perMember = c.woundThresholdPerMember || 1;
    if (critical) {
      // Any Critical Injury takes one minion out; the group takes that share plus one (§12C).
      c.wounds += minionCriticalWoundCost(perMember);
      notes.push('A Critical Injury instantly takes one minion out of the fight.');
    }
    const dropped = Math.min(c.minionCount, Math.floor(c.wounds / perMember));
    const remaining = Math.max(0, c.minionCount - dropped);
    if (dropped > 0) notes.push(`${dropped} minion(s) down; ${remaining} still standing.`);
    c.minionsDown = dropped;
    c.defeated = remaining === 0;
  } else {
    // Rivals and nemeses suffer Critical Injuries normally (§12C), so the §9 table is rolled
    // for them, stored on the card, and stacks +10 on their own later rolls like a PC's.
    if (critical) {
      const rolled = rollCombatantCritical(c, { vicious });
      notes.push(`Critical Injury on ${c.name}: ${rolled.injury.name} (${rolled.injury.severity}), rolled ${rolled.roll}${rolled.modifier ? ` +${rolled.modifier}` : ''}.`);
      if (rolled.condition) notes.push(`${c.name} is now ${rolled.condition}.`);
    }
    c.defeated = c.wounds >= c.woundThreshold;
    if (c.defeated && c.tier === 'rival') notes.push('The GM may rule a rival killed outright past their threshold.');
    if (c.defeated && c.tier === 'nemesis') notes.push('Incapacitated at the threshold.');
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

/** Roll the §9 table for an NPC and keep the result on their card. Their own untreated
 *  injuries add +10 each, exactly as they do for a PC (§9), and Vicious X adds 10 per rank.
 *  `mutate` is the combatant object, already inside an open `getCombat()` transaction. */
export function rollCombatantCritical(combatant, { vicious = 0, roll = null } = {}) {
  combatant.criticalInjuries = combatant.criticalInjuries || [];
  const untreated = combatant.criticalInjuries.filter((c) => !c.healed).length;
  const d100 = roll || rollDie(100);
  const total = criticalInjuryTotal({ roll: d100, untreatedInjuries: untreated, vicious });
  const injury = criticalInjuryFor(total);
  const record = { roll: d100, total, severity: injury.severity, name: injury.name, healed: false };
  combatant.criticalInjuries.push(record);
  // Three results name a condition; Hardened and Disciplined make their bearers immune (R-19).
  let applied = null;
  if (injury.condition && !immuneTo(combatant, injury.condition)) {
    combatant.conditions = { ...(combatant.conditions || {}), [injury.condition]: true };
    applied = (CONDITIONS.find((x) => x.id === injury.condition) || { name: injury.condition }).name.toLowerCase();
  }
  return { injury, roll: d100, total, modifier: total - d100, condition: applied, record };
}

/** Adversary abilities that grant immunity to a condition (§12D Hardened, B§2 Disciplined). */
function immuneTo(combatant, conditionId) {
  return (combatant.abilities || []).some((id) => {
    const def = adversaryAbility(id);
    return def && (def.immunities || []).includes(conditionId);
  });
}

/** Mark one of an NPC's injuries treated, so the +10 stack falls back again. */
export function healCombatantCritical(combatantId, index) {
  const combat = getCombat();
  const c = combat.combatants[combatantId];
  if (!c || !(c.criticalInjuries || [])[index]) return { ok: false, reason: 'No such injury.' };
  c.criticalInjuries[index].healed = !c.criticalInjuries[index].healed;
  saveCombat(combat);
  return { ok: true, healed: c.criticalInjuries[index].healed };
}

/** Papers-Check Reflex (B§2): a PC who fails a Deception or Cool check against this group
 *  takes a Personal Heat check automatically. */
export function papersCheckReflex(combatantId, character, { failed }) {
  const combat = getCombat();
  const c = combat.combatants[combatantId];
  if (!c || !(c.abilities || []).includes('papersCheckReflex')) {
    return { ok: false, reason: 'This combatant does not have Papers-Check Reflex.' };
  }
  if (!failed) return { ok: true, triggered: false, note: 'The check held up; no Heat.' };
  const applied = applyPersonalHeat(character, 1, `Papers-Check Reflex from ${c.name}`);
  return {
    ok: true, triggered: true, applied,
    note: `Papers-Check Reflex: Personal Heat ${applied.before} → ${applied.after}.`
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
    note: `Cell Heat is ${cell.cellHeat}: ${source.name} escalates personally.`
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

export function setVehiclePilot(vehicleId, pilotCombatantId) {
  const combat = getCombat();
  const v = (combat.vehicles || {})[vehicleId];
  if (!v) return { ok: false, reason: 'Unknown vehicle.' };
  v.pilotCombatantId = pilotCombatantId || null;
  saveCombat(combat);
  return { ok: true, pilotCombatantId: v.pilotCombatantId };
}

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
    note: `Lost control at speed ${trauma}: ${trauma} hull trauma, and occupants may take wounds or a Critical Injury roll as though from a fall.`
  };
}

export function repairSystemStrain(vehicleId) {
  const combat = getCombat();
  const v = combat.vehicles[vehicleId];
  if (!v) return { ok: false, reason: 'Unknown vehicle.' };
  v.systemStrain = Math.max(0, v.systemStrain - 1);
  saveCombat(combat);
  return { ok: true, systemStrain: v.systemStrain, note: 'One system strain recovered — a day undamaged, or the Damage Control action.' };
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
      const personal = applyPersonalHeat(character, 1, `A failed round of ${task.name}`);
      effects.push(`Personal Heat ${personal.before} → ${personal.after}.`);
    }
    const cell = applyCellHeat(1);
    effects.push(`Cell Heat ${cell.before} → ${cell.after}.`);
  } else {
    effects.push('The round is survived; the dragnet grinds on until the search zone is left behind.');
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

/** How a scene reads back: its number, and its name when it was given one. */
export function sceneLabel(scene) {
  if (!scene) return 'no scene';
  return scene.name ? `scene ${scene.number}, "${scene.name}"` : `scene ${scene.number}`;
}

export function previewBoundary(boundaryId, options = {}) {
  const boundary = LIFECYCLE.boundaries.find((b) => b.id === boundaryId);
  if (!boundary) return null;
  const deltas = [];
  const characters = listCharacters();
  const cell = getCell();

  if (boundaryId === 'encounter') {
    deltas.push('Prompt the end-of-encounter strain recovery check: Simple Discipline or Cool, one strain per uncancelled Success.');
    deltas.push('Clear every once-per-encounter talent and ability flag.');
    deltas.push('Clear "out of ammunition for the encounter" states and expire round-duration effects.');
  }
  if (boundaryId === 'scene') {
    const scene = getScene();
    deltas.push(scene
      ? `Close ${sceneLabel(scene)}${scene.name ? '' : ', which has no name'}.`
      : 'No scene is running, so this just clears whatever the last one left set up.');
    // What this boundary actually does, rather than what a synthesised bundle once claimed:
    // it clears the state that belongs to the scene just ended. Nothing in the app carries a
    // scene-duration effect or a dread-check flag, so it no longer says it clears them.
    const watched = characters.filter((c) => c.state.surveilledContext);
    if (watched.length) {
      watched.forEach((c) => deltas.push(`${c.identity.name || 'Unnamed'}: the scene is no longer a watched one, so checks stop generating suspicion by themselves.`));
    } else {
      deltas.push('No character is in a watched place, so nothing is carried over on that count.');
    }
    deltas.push('Clear the check setup the last scene left behind: cover, concealment, size, range band and target.');
    deltas.push('Clear the Oracle\'s last answer and the clock it was feeding, ready for the next scene.');
  }
  if (boundaryId === 'session') {
    const xp = XP_AWARDS.standardPerSession + (options.lengthAdjustment || 0) + (options.motivationPlay ? XP_AWARDS.motivationBonus : 0);
    deltas.push(`Award ${xp} XP to every character (${XP_AWARDS.standardPerSession} base${options.lengthAdjustment ? `, ${options.lengthAdjustment > 0 ? '+' : ''}${options.lengthAdjustment} for length` : ''}${options.motivationPlay ? `, +${XP_AWARDS.motivationBonus} for Motivation play` : ''}).`);
    if (options.downtime) {
      characters.filter((c) => c.state.personalHeat > 0)
        .forEach((c) => deltas.push(`${c.identity.name || 'Unnamed'}: Personal Heat ${c.state.personalHeat} → ${c.state.personalHeat - 1} for low-risk downtime.`));
      if (cell.cellHeat > 0 && characters.every((c) => c.state.personalHeat - 1 < 3)) {
        deltas.push(`Cell Heat ${cell.cellHeat} → ${cell.cellHeat - 1}: no member is at Personal Heat 3 or more.`);
      }
    }
    deltas.push('Clear every once-per-session talent flag. Story Points carry over and are not reset.');
  }
  if (boundaryId === 'day') {
    deltas.push('Reset the painkiller counter.');
    deltas.push('Recover 1 vehicle system strain on undamaged vehicles.');
  }
  if (boundaryId === 'week') {
    deltas.push('The week-rest Critical Injury check is available again.');
    deltas.push('Reset the per-injury Medicine limit.');
  }
  if (boundaryId === 'adventure') {
    characters.filter((c) => c.state.personalHeat >= HEAT.max)
      .forEach((c) => deltas.push(`${c.identity.name || 'Unnamed'} is at Personal Heat ${HEAT.max}: go underground, resetting Heat to 2, or be captured.`));
    if (!deltas.length) deltas.push('No character is at maximum Heat; nothing to resolve.');
  }
  return { boundary, deltas };
}

export function fireBoundary(boundaryId, options = {}) {
  const boundary = LIFECYCLE.boundaries.find((b) => b.id === boundaryId);
  if (!boundary) return { ok: false, reason: 'Unknown boundary.' };
  const preview = previewBoundary(boundaryId, options);
  snapshot(`End ${boundaryId}`); // one-step undo

  const characters = listCharacters();
  const flagKey = FLAG_KEYS[boundaryId];

  characters.forEach((character) => {
    if (flagKey) character.state[flagKey] = flagKey === 'perDayFlags' ? { painkillers: 0 } : {};
    if (boundaryId === 'session') {
      const xp = XP_AWARDS.standardPerSession + (options.lengthAdjustment || 0) + (options.motivationPlay ? XP_AWARDS.motivationBonus : 0);
      character.xp.total += xp;
      character.xp.available += xp;
      character.advancementLog.push({ ts: Date.now(), kind: 'award', detail: 'Session award', xpSpent: -xp });
      if (options.downtime && character.state.personalHeat > 0) character.state.personalHeat -= 1;
    }
    if (boundaryId === 'day') character.state.perDayFlags = { painkillers: 0 };
    // Conditions are stored as booleans and are cleared by hand or by healing, so the
    // encounter boundary has nothing to expire among them; it used to compare a boolean
    // against the string 'encounter', which could never match.
    if (boundaryId === 'scene') character.state.surveilledContext = false;
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

  // The scene's own state lives on two screens, so the boundary clears it there too rather
  // than leaving the next scene set up as the last one ended.
  if (boundaryId === 'scene') {
    endScene();
    setSceneWatched(false);
    // The Roll screen and the Oracle each own their own scene state, so they are told the
    // scene ended rather than reached into from here (§13.9 module discipline).
    document.dispatchEvent(new CustomEvent('scene:end'));
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
    mount.append(outcomeBox([`${lastBoundaryResult.name} applied.`, ...lastBoundaryResult.deltas, 'Undo is available below until you fire another boundary.'], { title: 'What just happened', level: 2 }));
  }

  // The fight comes first and the bookkeeping last: turn order, who is in it, vehicles,
  // long jobs, and only then the boundaries you fire when it is all over (B-2).
  sectionInitiative(mount, combat, rerender);
  sectionRoster(mount, combat, rerender);
  sectionVehicles(mount, combat, rerender);
  sectionTasks(mount, rerender);
  sectionLifecycle(mount, rerender);
}

// --- turn order (§5, §5A') ---
function sectionInitiative(mount, combat, rerender) {
  const initiative = panel(combat.active ? `Turn order — round ${combat.round}` : 'Turn order', PANELS.combatInitiative, []);

  if (!combat.active) {
    // Roster-first: everyone already in the fight is listed by name and side, so a roll is
    // two numbers rather than four fields and an Add (B-4).
    const roster = Object.values(combat.combatants);
    const rolls = {};
    const extra = [];
    const rollList = el('div', { id: 'init-roster' });

    const drawRoster = () => {
      clear(rollList);
      if (!roster.length && !extra.length) {
        rollList.append(emptyState('Nobody in the fight yet. Add your character or an opponent below, then come back and roll.'));
        return;
      }
      const table = el('table');
      table.append(el('tr', {}, [el('th', { text: 'Who' }), el('th', { text: 'Side' }), el('th', { text: 'Success' }), el('th', { text: 'Advantage' })]));
      [...roster.map((c) => ({ id: c.id, label: c.name, owner: c.side })), ...extra].forEach((who) => {
        rolls[who.id] = rolls[who.id] || { label: who.label, owner: who.owner, success: 0, advantage: 0 };
        const num = (key, aria) => el('input', {
          type: 'number', min: '0', value: String(rolls[who.id][key]),
          id: `init-${key}-${who.id}`, 'aria-label': `${aria} for ${who.label}`,
          onchange: (e) => { rolls[who.id][key] = Math.max(0, Number(e.target.value) || 0); }
        });
        table.append(el('tr', {}, [
          el('td', { text: who.label }),
          el('td', { text: who.owner.toUpperCase() }),
          el('td', {}, [num('success', 'Uncancelled Success')]),
          el('td', {}, [num('advantage', 'Uncancelled Advantage')])
        ]));
      });
      rollList.append(el('div', { class: 'table-wrap' }, [table]));
    };

    initiative.append(el('p', { class: 'small', text: `Everyone rolls a ${titleCase(COMBAT_SEQUENCE.initiative.difficulty)} ${COMBAT_SEQUENCE.initiative.skills.map(titleCase).join(' or ')} check. ${COMBAT_SEQUENCE.initiative.choose}` }));
    initiative.append(rollList);
    drawRoster();

    if (Settings.digitalRoller()) {
      initiative.append(el('button', {
        type: 'button', class: 'secondary', id: 'init-roll-npcs', text: 'Roll for the NPCs',
        onclick: () => {
          Object.entries(rolls).forEach(([id, r]) => {
            if (r.owner !== 'npc') return;
            const c = combat.combatants[id];
            const rank = c && c.skills ? Math.max(0, ...Object.values(c.skills)) : 1;
            const characteristic = c && c.characteristics ? (c.characteristics.willpower || 2) : 2;
            const rolled = rollInitiative(rank, characteristic);
            r.success = rolled.success; r.advantage = rolled.advantage;
          });
          drawRoster();
          showToast('Rolled the NPC side');
        }
      }));
    }

    // Anyone not on the tracker can still be added by hand.
    const adhocBody = el('div', {});
    const adLabel = el('input', { type: 'text', id: 'init-label', placeholder: 'Name', 'aria-label': 'Name of someone not on the tracker' });
    const adOwner = el('select', { id: 'init-owner', 'aria-label': 'Side' }, [
      el('option', { value: 'pc', text: 'PC slot' }),
      el('option', { value: 'npc', text: 'NPC slot' })
    ]);
    adhocBody.append(adLabel, adOwner, el('button', {
      type: 'button', class: 'secondary', text: 'Add them',
      onclick: () => {
        extra.push({ id: `adhoc-${extra.length}`, label: adLabel.value || 'Participant', owner: adOwner.value });
        adLabel.value = '';
        drawRoster();
      }
    }));
    initiative.append(accordion('Someone who is not on the tracker', [adhocBody], { key: 'init-adhoc', summary: 'add by name' }));

    initiative.append(el('button', {
      type: 'button', class: 'primary', id: 'init-start', text: 'Build the slot order',
      onclick: () => {
        const list = Object.values(rolls);
        if (!list.length) { showToast('Add someone to the fight first'); return; }
        startEncounter(list);
        rerender();
      }
    }));
    // A table that tracks initiative on paper still wants the turn budget and the cards.
    initiative.append(el('button', {
      type: 'button', class: 'secondary', id: 'init-skip', text: 'Use roster order instead',
      onclick: () => {
        const list = Object.values(combat.combatants).map((c, i) => ({ label: c.name, owner: c.side, success: 100 - i, advantage: 0 }));
        if (!list.length) { showToast('Add someone to the fight first'); return; }
        startEncounter(list);
        showToast('Started in roster order — track the real order at the table');
        rerender();
      }
    }));
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
}

// --- who is in the fight ---
function sectionRoster(mount, combat, rerender) {
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
  Object.values(combat.combatants).forEach((c) => roster.append(combatantCard(c, combat, rerender)));
  mount.append(roster);
}

/** One combatant. The turn budget is stated in words beside the buttons that enforce it,
 *  and what is spent is named rather than counted anonymously (C-5). */
function combatantCard(c, combat, rerender) {
  const card = el('div', { class: 'result' }, [
    el('div', { class: 'result-head' }, [
      el('span', { class: 'result-title', text: `${c.name}${c.minionCount ? ` ×${c.minionCount}` : ''}` }),
      el('span', { class: 'cite', text: `${c.tier} · ${c.side.toUpperCase()}` })
    ]),
    el('div', { class: 'result-body', text: `Wounds ${c.wounds}/${c.woundThreshold ?? '—'}${c.strainThreshold ? ` · Strain ${c.strain}/${c.strainThreshold}` : ''} · Soak ${c.soak} · Def ${c.meleeDef}/${c.rangedDef}${c.adversary ? ` · Adversary ${c.adversary}` : ''}` })
  ]);
  if (c.tier === 'minion' && c.woundThresholdPerMember) {
    card.append(el('p', { class: 'small muted', text: `${c.woundThresholdPerMember} per member × ${c.minionCount} = ${c.woundThreshold} group threshold; group skills at rank ${minionGroupSkillRanks(c.minionCount)}.` }));
    card.append(el('button', { type: 'button', class: 'secondary', text: '−1 minion', onclick: () => { resizeMinionGroup(c.id, c.minionCount - 1); rerender(); } }));
    card.append(el('button', { type: 'button', class: 'secondary', text: '+1 minion', onclick: () => { resizeMinionGroup(c.id, c.minionCount + 1); rerender(); } }));
  }
  if (c.promotable && c.tier === 'minion') {
    card.append(el('button', {
      type: 'button', class: 'secondary', text: 'Promote to Rival',
      onclick: () => { promoteToRival(c.id); showToast('Promoted: Critical Injuries now resolve normally'); rerender(); }
    }));
  }

  // The turn budget, said out loud where it is enforced.
  const second = MANEUVER_RULES.secondManeuverStrainCost;
  card.append(el('p', { class: 'small muted', id: `turn-budget-${c.id}`, text:
    `A turn is one action and ${MANEUVER_RULES.freePerTurn} free maneuver; a second costs ${second} strain, and there is never a third. Used ${c.maneuversUsed || 0} of ${MANEUVER_RULES.maxPerTurn} maneuvers${c.actionUsed ? ', action spent' : ''}.` }));

  const maneuverSelect = el('select', { 'aria-label': `Maneuver for ${c.name}`, id: `maneuver-pick-${c.id}` });
  MANEUVERS.forEach((m) => maneuverSelect.append(el('option', { value: m.id, text: m.name })));
  card.append(maneuverSelect, el('button', {
    type: 'button', class: 'secondary', text: 'Take it',
    'aria-label': `Take the chosen maneuver for ${c.name}`,
    onclick: () => {
      const r = spendManeuver(c.id, maneuverSelect.value);
      showToast(r.ok ? `${r.name}${r.strainCost ? ` — ${r.strainCost} strain` : ''}` : r.reason);
      rerender();
    }
  }));

  const actionSelect = el('select', { 'aria-label': `Action for ${c.name}`, id: `action-pick-${c.id}` });
  ACTION_TYPES.forEach((a) => actionSelect.append(el('option', { value: a.id, text: a.name })));
  card.append(actionSelect, el('button', {
    type: 'button', class: 'secondary', text: 'Do it',
    'aria-label': `Take the chosen action for ${c.name}`,
    onclick: () => { const r = spendAction(c.id, actionSelect.value); showToast(r.ok ? r.name : r.reason); rerender(); }
  }));
  if ((c.turnLog || []).length) {
    card.append(el('p', { class: 'small muted', text: `This turn: ${c.turnLog.join(', ')}.` }));
  }

  card.append(el('button', { type: 'button', class: 'secondary', text: '+1 wound', 'aria-label': `One more wound on ${c.name}`, onclick: () => { const r = damageCombatant(c.id, { wounds: 1 }); r.notes.forEach((n) => showToast(n)); rerender(); } }));
  card.append(el('button', {
    type: 'button', class: 'secondary', text: 'Critical', 'aria-label': `Critical Injury on ${c.name}`,
    onclick: () => { const r = damageCombatant(c.id, { critical: true }); r.notes.forEach((n) => showToast(n)); rerender(); }
  }));

  // Lasting injuries on a rival or nemesis, with the +10 each one adds to their next roll.
  const injuries = c.criticalInjuries || [];
  if (injuries.length) {
    const untreated = injuries.filter((i) => !i.healed).length;
    const body = el('div', {});
    injuries.forEach((injury, index) => {
      body.append(el('div', { class: 'result' }, [
        el('div', { class: 'result-head' }, [
          el('span', { class: 'result-title', text: `${injury.name} (${injury.severity})` }),
          el('span', { class: 'cite', text: `rolled ${injury.roll}${injury.total !== injury.roll ? ` → ${injury.total}` : ''}` })
        ]),
        el('button', {
          type: 'button', class: 'secondary',
          text: injury.healed ? 'Mark untreated' : 'Mark treated',
          'aria-label': `${injury.healed ? 'Mark untreated' : 'Mark treated'}: ${injury.name} on ${c.name}`,
          onclick: () => { healCombatantCritical(c.id, index); rerender(); }
        })
      ]));
    });
    card.append(accordion('Lasting injuries', [body], {
      key: `combat-crits-${c.id}`,
      summary: untreated ? `${untreated} untreated, next roll +${untreated * 10}` : 'all treated'
    }));
  }

  // Conditions on an NPC, so a staggered rival stays staggered (A-15).
  const condBody = el('div', {});
  COMBAT_CONDITIONS.forEach((cond) => {
    condBody.append(el('div', { class: 'toggle-row' }, [
      el('input', {
        type: 'checkbox', id: `cond-${c.id}-${cond.id}`, checked: !!(c.conditions || {})[cond.id],
        onchange: (e) => { setCombatantCondition(c.id, cond.id, e.target.checked); rerender(); }
      }),
      el('label', { for: `cond-${c.id}-${cond.id}` }, [
        el('span', { text: cond.name }),
        el('span', { class: 'toggle-desc', text: cond.effect })
      ])
    ]));
  });
  const on = Object.entries(c.conditions || {}).filter(([, v]) => v).map(([id]) => (CONDITIONS.find((x) => x.id === id) || { name: id }).name);
  card.append(accordion(`What state are they in?`, [condBody], {
    key: `combat-conditions-${c.id}`, summary: on.length ? on.join(', ') : 'nothing'
  }));

  card.append(el('button', {
    type: 'button', class: 'secondary danger', text: 'Remove',
    'aria-label': `Remove ${c.name} from the fight`,
    onclick: async () => {
      if (!(await confirmModal(`Take ${c.name} out of the fight? Their wounds and state are lost.`, { title: 'Remove combatant', confirmLabel: 'Remove' }))) return;
      removeCombatant(c.id); rerender();
    }
  }));
  if (c.defeated) card.append(el('p', { class: 'small', text: 'Out of the fight.' }));
  return card;
}

// --- vehicles (§12) ---
function sectionVehicles(mount, combat, rerender) {
  const vehicleBody = el('div', {});
  const vehicleCard = panel('Vehicles', PANELS.combatVehicles, [
    accordion('Add or manage a vehicle', [vehicleBody], { key: 'combat-vehicles', summary: `${Object.keys(combat.vehicles || {}).length} in play` })
  ]);
  const vehiclePick = el('select', { id: 'vehicle-pick', 'aria-label': 'Vehicle' });
  VEHICLES.forEach((v) => vehiclePick.append(el('option', { value: v.id, text: `${v.name} (sil ${v.silhouette})` })));
  const pilotPick = el('select', { id: 'vehicle-pilot', 'aria-label': 'Who is driving' });
  pilotPick.append(el('option', { value: '', text: 'Nobody at the wheel yet' }));
  Object.values(combat.combatants).forEach((c) => pilotPick.append(el('option', { value: c.id, text: c.name })));
  vehicleBody.append(
    vehiclePick,
    el('label', { class: 'small', for: 'vehicle-pilot', text: 'Who is driving' }), pilotPick,
    el('button', {
      type: 'button', class: 'secondary', text: 'Add vehicle',
      onclick: () => { addVehicle(vehiclePick.value, { pilotCombatantId: pilotPick.value || null }); rerender(); }
    })
  );
  Object.values(combat.vehicles || {}).forEach((v) => {
    vehicleBody.append(el('div', { class: 'result' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: v.name }),
        el('span', { class: 'cite', text: `sil ${v.silhouette} · handling ${v.handling >= 0 ? '+' : ''}${v.handling}` })
      ]),
      el('div', { class: 'result-body', text: `Speed ${v.speed}/${v.maxSpeed} · hull ${v.hullTrauma}/${v.hullThreshold} · system strain ${v.systemStrain}/${v.systemStrainThreshold} · armour ${v.armour}${v.disabled ? ' · disabled' : ''}` }),
      vehicleDriverRow(v, combat, rerender),
      el('button', { type: 'button', class: 'secondary', text: 'Accelerate', 'aria-label': `Accelerate ${v.name}`, onclick: () => { changeSpeed(v.id, 1); rerender(); } }),
      el('button', { type: 'button', class: 'secondary', text: 'Decelerate', 'aria-label': `Decelerate ${v.name}`, onclick: () => { changeSpeed(v.id, -1); rerender(); } }),
      el('button', { type: 'button', class: 'secondary', text: '+1 system strain', 'aria-label': `One more system strain on ${v.name}`, onclick: () => { vehicleDamage(v.id, { systemStrain: 1 }); rerender(); } }),
      el('button', { type: 'button', class: 'secondary', text: 'Damage Control', 'aria-label': `Damage Control on ${v.name}`, onclick: () => { const r = repairSystemStrain(v.id); showToast(r.note); rerender(); } }),
      el('button', { type: 'button', class: 'secondary', text: 'Crash', 'aria-label': `Crash ${v.name}`, onclick: () => { const r = crashVehicle(v.id); showToast(r.note); rerender(); } }),
      el('button', {
        type: 'button', class: 'secondary danger', text: 'Remove', 'aria-label': `Remove ${v.name}`,
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
      el('h2', { text: 'Nemesis escalation' }),
      el('p', { class: 'small', text: escalation.note })
    ]));
  }
}

/** Who is at the wheel, and what this vehicle's Handling will do to their checks (§12). */
function vehicleDriverRow(v, combat, rerender) {
  const wrap = el('div', {});
  const pick = el('select', { id: `vehicle-pilot-${v.id}`, 'aria-label': `Who is driving the ${v.name}` });
  pick.append(el('option', { value: '', text: 'Nobody at the wheel', selected: !v.pilotCombatantId }));
  Object.values(combat.combatants).forEach((c) => pick.append(el('option', {
    value: c.id, text: c.name, selected: v.pilotCombatantId === c.id
  })));
  pick.addEventListener('change', () => { setVehiclePilot(v.id, pick.value || null); rerender(); });
  wrap.append(el('label', { class: 'small', for: `vehicle-pilot-${v.id}`, text: 'At the wheel' }), pick);
  const driver = v.pilotCombatantId ? combat.combatants[v.pilotCombatantId] : null;
  wrap.append(el('p', { class: 'small muted', text: v.handling === 0
    ? `Handling 0, so it adds nothing to ${driver ? driver.name + "'s" : 'the driver\'s'} Driving and Piloting checks.`
    : `Handling ${v.handling > 0 ? '+' : ''}${v.handling} adds ${Math.abs(v.handling)} ${v.handling > 0 ? 'Boost' : 'Setback'} to ${driver ? driver.name + "'s" : 'the driver\'s'} Driving and Piloting checks. Pick this vehicle on the Roll screen and it applies itself.` }));
  return wrap;
}

// --- progress tasks ---
function sectionTasks(mount, rerender) {
  const tasks = listTasks();
  renderClocks(mount, { onChange: rerender });
}

// --- the boundaries you fire when it is all over (§3.12) ---
function sectionLifecycle(mount, rerender) {
  const lifecycle = panel('Wrapping up', PANELS.combatLifecycle, []);
  const sessionOptions = { downtime: false, motivationPlay: false, lengthAdjustment: 0 };

  // A scene needs a beginning if End Scene is to have anything to end, and the two screens
  // read the same record, so starting one here shows up on the Solo tab and the reverse.
  const scene = getScene();
  if (scene) {
    lifecycle.append(el('p', { class: 'small', id: 'combat-scene-now', text: `You are in ${sceneLabel(scene)}, started ${new Date(scene.startedAt).toLocaleTimeString()}.` }));
  } else {
    const sceneName = el('input', { type: 'text', id: 'combat-scene-name', placeholder: 'Name this scene (optional)', 'aria-label': 'Name this scene' });
    lifecycle.append(sceneName, el('button', {
      type: 'button', class: 'secondary', id: 'combat-scene-start', text: 'Start a scene',
      onclick: () => { startScene(sceneName.value.trim()); rerender(); }
    }));
  }
  LIFECYCLE.boundaries.forEach((boundary) => {
    lifecycle.append(el('button', {
      type: 'button', class: 'secondary', text: boundary.name,
      onclick: async () => {
        const preview = previewBoundary(boundary.id, sessionOptions);
        const body = el('div', {}, [
          el('ul', { class: 'small' }, preview.deltas.map((d) => el('li', { text: d })))
        ]);
        if (boundary.id === 'session') {
          body.append(checkbox('lc-downtime', 'This session was low-risk downtime, so suspicion drops by 1', (v) => { sessionOptions.downtime = v; }));
          body.append(checkbox('lc-motivation', `Motivation was meaningfully played, for ${XP_AWARDS.motivationBonus} extra experience`, (v) => { sessionOptions.motivationPlay = v; }));
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
}

function checkbox(id, label, onChange) {
  return el('div', { class: 'toggle-row' }, [
    el('input', { type: 'checkbox', id, onchange: (e) => onChange(e.target.checked) }),
    el('label', { for: id }, [el('span', { text: label })])
  ]);
}
