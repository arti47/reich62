// derived.js — derived calculations for player characters, plus data normalisation.
// R-15: published NPC and animal stats never pass through here; they load verbatim.

import {
  BASE_WOUND_THRESHOLD, BASE_STRAIN_THRESHOLD, ENCUMBRANCE, SKILLS, CHARACTERISTICS,
  CHARACTERISTIC_MIN, ARMOUR, ATTACHMENTS
} from '../data.js';
import { talent } from './rules.js';

export const SCHEMA_VERSION = 1;

export function blankCharacter(over = {}) {
  const skills = {};
  SKILLS.forEach((s) => { skills[s.id] = { rank: 0, career: false }; });
  const attributes = {};
  CHARACTERISTICS.forEach((c) => { attributes[c.id] = CHARACTERISTIC_MIN; }); // R-5
  return {
    schemaVersion: SCHEMA_VERSION,
    id: null,
    identity: { name: '', career: null, careerSkills: [], motivation: { desire: null, fear: null, strength: null, flaw: null },
               // Which facets an opponent has worked out in play (§11).
               motivationRevealed: { desire: false, fear: false, strength: false, flaw: false },
               knowledgeSpecialisation: '', portraitUrl: null,
               // §13 step 6 — one sentence naming what forced this character's hand.
               kicker: '' },
    attributes,
    skills,
    talents: [],
    // Cash, ration cards and barter goods are three separate pockets: the black-market
    // house rule spends the last two, and they are not interchangeable with cash.
    inventory: { items: [], tiny: [], money: { amount: 0, rationCards: 0, barterGoods: 0 } },
    state: {
      wounds: 0, strain: 0, criticalInjuries: [], critModifier: 0, conditions: {},
      incapacitated: false, deathState: null, personalHeat: 0, surveilledContext: false,
      perEncounterFlags: {}, perSceneFlags: {}, perSessionFlags: {}, perDayFlags: { painkillers: 0 },
      perWeekFlags: {}, restLimits: {},
      // How the Medicine check is being made (§5G) and the last fall's summary (§5I).
      careFlags: { selfTreatment: false, noEquipment: false }, lastFall: null,
      // Why suspicion is where it is: the last dozen moves, newest first (§17).
      heatTrail: [],
      // §33 — the optional per-character antagonist thread, 0 (unnamed) to 3.
      personalThreat: { name: '', step: 0 },
      // §31 — tension toward other characters, by character id, 0–2 and directional.
      tension: {}
    },
    xp: { total: 70, available: 70 },
    advancementLog: [],
    notes: '',
    ...over
  };
}

/** Back-fill defaults on characters saved by an older schema. Never throws on old data. */
export function normalise(character) {
  const base = blankCharacter();
  const out = { ...base, ...character };
  out.identity = { ...base.identity, ...(character.identity || {}) };
  out.identity.motivation = { ...base.identity.motivation, ...((character.identity || {}).motivation || {}) };
  out.identity.motivationRevealed = { ...base.identity.motivationRevealed, ...((character.identity || {}).motivationRevealed || {}) };
  out.attributes = { ...base.attributes, ...(character.attributes || {}) };
  out.state = { ...base.state, ...(character.state || {}) };
  out.state.careFlags = { ...base.state.careFlags, ...((character.state || {}).careFlags || {}) };
  // Part V additions back-fill on characters saved before the journey module existed.
  out.state.personalThreat = { ...base.state.personalThreat, ...((character.state || {}).personalThreat || {}) };
  out.state.tension = { ...((character.state || {}).tension || {}) };
  out.inventory = { ...base.inventory, ...(character.inventory || {}) };
  out.inventory.money = { ...base.inventory.money, ...((character.inventory || {}).money || {}) };
  out.xp = { ...base.xp, ...(character.xp || {}) };
  out.skills = { ...base.skills };
  for (const [id, value] of Object.entries(character.skills || {})) {
    if (out.skills[id]) out.skills[id] = { ...out.skills[id], ...value };
  }
  out.talents = Array.isArray(character.talents) ? character.talents : [];
  out.schemaVersion = SCHEMA_VERSION;
  return out;
}

const talentRanks = (character, id) => {
  const entry = (character.talents || []).find((t) => t.id === id);
  return entry ? (entry.ranks || 1) : 0;
};

function talentDerivedBonus(character, key) {
  let total = 0;
  for (const held of character.talents || []) {
    const def = talent(held.id);
    if (def && def.derived && def.derived[key]) total += def.derived[key] * (held.ranks || 1);
  }
  return total;
}

export function equippedArmour(character) {
  const equipped = (character.inventory.items || []).filter((i) => i.equipped && i.kind === 'armour');
  return equipped.map((i) => ARMOUR.find((a) => a.id === i.id)).filter(Boolean);
}

export function armourSoak(character) {
  return equippedArmour(character).reduce((sum, a) => sum + (a.soak || 0), 0);
}

export function armourDefense(character) {
  return equippedArmour(character).reduce((sum, a) => sum + (a.defense || 0), 0);
}

/** Wound and strain thresholds are fixed at creation (§6) and only talents raise them.
 *  Their bases are the R-1 constants. */
export function woundThreshold(character) {
  return BASE_WOUND_THRESHOLD + (character.attributes.brawn || 0) + talentDerivedBonus(character, 'woundThreshold');
}

export function strainThreshold(character) {
  return BASE_STRAIN_THRESHOLD + (character.attributes.willpower || 0) + talentDerivedBonus(character, 'strainThreshold');
}

/** Soak recalculates live with Brawn, unlike the thresholds (§6). */
export function soak(character) {
  return (character.attributes.brawn || 0) + armourSoak(character) + talentDerivedBonus(character, 'soak');
}

export function meleeDefense(character) {
  return armourDefense(character) + talentDerivedBonus(character, 'meleeDefense') + (character.state.coverMelee || 0);
}

export function rangedDefense(character) {
  return armourDefense(character) + talentDerivedBonus(character, 'rangedDefense') + (character.state.coverRanged || 0);
}

export function encumbranceThreshold(character) {
  return ENCUMBRANCE.thresholdBase + (character.attributes.brawn || 0);
}

export function encumbranceCarried(character) {
  const items = (character.inventory.items || []).reduce(
    (sum, i) => sum + (Number(i.encumbrance) || 0) * (i.qty || 1), 0);
  const tiny = (character.inventory.tiny || []).length;
  return items + Math.floor(tiny / 10); // ten loose incidentals count as one encumbrance
}

/** Over-threshold penalties are enforced, not merely warned about (§5F). */
export function encumbranceState(character) {
  const carried = encumbranceCarried(character);
  const threshold = encumbranceThreshold(character);
  const over = Math.max(0, carried - threshold);
  const brawn = character.attributes.brawn || 1;
  return {
    carried, threshold, over,
    setbackDice: over,
    losesFreeManeuver: over >= brawn,
    scope: 'Agility and Brawn checks'
  };
}

export function hardPoints(baseEncumbrance) {
  return ATTACHMENTS.hardPointsFor(baseEncumbrance);
}

/** Cumulative Critical Injury modifier: +10 per untreated injury (§5G). */
export function criticalModifier(character) {
  const untreated = (character.state.criticalInjuries || []).filter((c) => !c.healed).length;
  const durable = talentRanks(character, 'durable');
  return { untreated, plus: untreated * 10, durableMinus: durable * 10 };
}

export function incapacitated(character) {
  return character.state.wounds >= woundThreshold(character)
      || character.state.strain >= strainThreshold(character);
}

export function derivedFor(character) {
  return {
    woundThreshold: woundThreshold(character),
    strainThreshold: strainThreshold(character),
    soak: soak(character),
    meleeDefense: meleeDefense(character),
    rangedDefense: rangedDefense(character),
    encumbranceThreshold: encumbranceThreshold(character),
    incapacitated: incapacitated(character)
  };
}
