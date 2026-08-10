// rules.js — pure lookups over the data libraries. No DOM, no state.

import {
  SKILLS, CHARACTERISTICS, DIFFICULTIES, TALENTS, TALENT_RULES, CAREERS, WEAPONS, ARMOUR,
  GEAR, VEHICLES, ITEM_QUALITIES, CRITICAL_INJURIES, CRITICAL_INJURY_RULES, CONDITIONS,
  RARITY, POOL_BUILD, UPGRADE_MAP, DOWNGRADE_MAP, MODIFICATION_ORDER, XP_COSTS,
  RECOVERY, FALLING, FALLING_RULES, RANGED_DIFFICULTY_BY_RANGE, COMBAT_CHECK_PROCEDURE
} from '../data.js';
import { BLACK_MARKET } from '../data.js';
import { ADVERSARY_ABILITIES, ADVERSARY_TIERS } from '../data-npcs.js';
import { BESTIARY, ENCOUNTER_BLOCKS, RANDOM_ENCOUNTERS } from '../data-monsters.js';
import { MEANING, ELEMENTS } from '../data-solo.js';
import { rollDie } from './core.js';

const byId = (list) => (id) => list.find((entry) => entry.id === id) || null;

export const skill = byId(SKILLS);
export const characteristic = byId(CHARACTERISTICS);
export const difficulty = byId(DIFFICULTIES);
export const talent = byId(TALENTS);
export const career = byId(CAREERS);
export const weapon = byId(WEAPONS);
export const armour = byId(ARMOUR);
export const gear = byId(GEAR);
export const vehicle = byId(VEHICLES);
export const quality = byId(ITEM_QUALITIES);
export const condition = byId(CONDITIONS);
export const adversaryAbility = byId(ADVERSARY_ABILITIES);
export const adversaryTier = byId(ADVERSARY_TIERS);
export const bestiaryEntry = byId(BESTIARY);
export const encounterBlock = byId(ENCOUNTER_BLOCKS);

export const skillsByCategory = (category) => SKILLS.filter((s) => s.category === category);

/** Talents visible under the current settings — R-11 hides the 12 non-setting entries. */
export function visibleTalents(showNonSetting) {
  return showNonSetting ? TALENTS : TALENTS.filter((t) => t.settingApplicable);
}

/** Build the positive side of a pool from a skill rank and its characteristic (§2). */
export function buildPool(skillRank, characteristicRating) {
  const ability = POOL_BUILD.abilityDice(skillRank, characteristicRating);
  const proficiency = POOL_BUILD.proficiencyUpgrades(skillRank, characteristicRating);
  return { ability: ability - proficiency, proficiency };
}

/** Build the difficulty side of an opposed check from the opponent's rating (§3A). */
export function buildOpposedDifficulty(opponentSkillRank, opponentCharacteristic) {
  const total = Math.max(opponentSkillRank, opponentCharacteristic);
  const upgrades = Math.min(opponentSkillRank, opponentCharacteristic);
  return { difficulty: total - upgrades, challenge: upgrades };
}

/** Apply dice modifications strictly in the order the manual gives (§2.4). */
export function modifyPool(base, modifications = []) {
  const pool = { ability: 0, proficiency: 0, difficulty: 0, challenge: 0, boost: 0, setback: 0, ...base };
  const stages = MODIFICATION_ORDER.slice(1); // 'assemble' is the base pool itself
  for (const stage of stages) {
    for (const mod of modifications.filter((m) => m.stage === stage)) {
      const count = mod.count ?? 1;
      if (stage === 'add') pool[mod.die] = (pool[mod.die] || 0) + count;
      else if (stage === 'remove') pool[mod.die] = Math.max(0, (pool[mod.die] || 0) - count);
      else if (stage === 'upgrade') {
        const to = UPGRADE_MAP[mod.die];
        for (let i = 0; i < count; i += 1) {
          if (pool[mod.die] > 0) { pool[mod.die] -= 1; pool[to] += 1; }
          else pool[to] += 1; // upgrading an empty pool adds the upgraded die
        }
      } else if (stage === 'downgrade') {
        const to = DOWNGRADE_MAP[mod.die];
        for (let i = 0; i < count; i += 1) {
          if (pool[mod.die] > 0) { pool[mod.die] -= 1; pool[to] += 1; }
        }
      }
    }
  }
  return pool;
}

/** Difficulty dice for a named difficulty level (§3). */
export function difficultyDice(levelId) {
  const level = difficulty(levelId);
  return level ? level.dice : 0;
}

/** Step a difficulty up or down the ladder (§3). Impossible is never reached by stepping. */
export function stepDifficulty(levelId, steps) {
  const ladder = DIFFICULTIES.filter((d) => d.id !== 'impossible');
  const index = ladder.findIndex((d) => d.id === levelId);
  if (index < 0) return levelId;
  const next = Math.min(ladder.length - 1, Math.max(0, index + steps));
  return ladder[next].id;
}

/** Difficulty of a combat check: melee is always Average, ranged follows the band (§5B). */
export function attackDifficulty(weaponDef, rangeBand) {
  if (!weaponDef) return null;
  if (weaponDef.skill === 'brawl' || weaponDef.skill === 'melee') return COMBAT_CHECK_PROCEDURE.meleeDifficulty;
  const row = RANGED_DIFFICULTY_BY_RANGE.find((r) => r.range === (rangeBand || weaponDef.range));
  return row ? row.difficulty : COMBAT_CHECK_PROCEDURE.meleeDifficulty;
}

export function rangedDifficultyFor(band) {
  const row = RANGED_DIFFICULTY_BY_RANGE.find((r) => r.range === band);
  return row ? row.difficulty : null;
}

/** A weapon's base damage before successes (§15C, §5H).
 *  `brawn` weapons deal Brawn; `plusBrawn` weapons add their rating to it. */
export function weaponBaseDamage(weaponDef, brawn = 0) {
  if (!weaponDef) return 0;
  if (weaponDef.damageType === 'characteristic' || weaponDef.damage === 'brawn') return brawn;
  if (weaponDef.damageType === 'plusBrawn') return brawn + (Number(weaponDef.damage) || 0);
  return Number(weaponDef.damage) || 0;
}

/** Pierce X reduces the target's soak by X (§10). */
export function weaponPierce(weaponDef) {
  const quality = (weaponDef ? weaponDef.qualities || [] : []).find((q) => /^Pierce/i.test(q));
  return quality ? (Number(quality.replace(/\D+/g, '')) || 0) : 0;
}

/** Difficulty of a Medicine check to treat wounds (§5G).
 *  The ladder and both modifiers come from the RECOVERY table; nothing is restated here. */
export function medicineDifficulty({ wounds, woundThreshold: wt, selfTreatment = false, noEquipment = false }) {
  const method = RECOVERY.methods.find((m) => m.id === 'medicineWounds');
  const [easy, average, hard] = method.difficultyRule;
  let base = easy.difficulty;
  if (wounds > wt) base = hard.difficulty;
  else if (wounds > wt / 2) base = average.difficulty;
  const applied = [];
  let steps = 0;
  method.modifiers.forEach((mod) => {
    const on = (mod.id === 'selfTreatment' && selfTreatment) || (mod.id === 'noEquipment' && noEquipment);
    if (!on) return;
    steps += mod.difficultySteps;
    applied.push(`${mod.label}: ${mod.difficultySteps} step${mod.difficultySteps === 1 ? '' : 's'} harder`);
  });
  return { base, difficulty: steps ? stepDifficulty(base, steps) : base, steps, applied };
}

/** Wounds and strain from a fall, and the Critical Injury modifier it carries (§5I).
 *  Mitigation is the Average Athletics or Coordination check the rules allow. */
export function fallDamage({ band, woundThreshold: wt = 0, soak: soakValue = 0, successes = 0, advantages = 0 }) {
  const row = FALLING.find((f) => f.band === band);
  if (!row) return null;
  const rawWounds = row.wounds !== undefined ? row.wounds : wt + 1;
  // Mitigation first, then soak — soak reduces wounds only, never strain (FALLING_RULES).
  const mitigated = Math.max(0, rawWounds - successes);
  return {
    band,
    rawWounds,
    wounds: Math.max(0, mitigated - soakValue),
    strain: Math.max(0, row.strain - advantages),
    criticalModifier: row.criticalModifier || 0,
    note: row.note || null,
    soakApplied: Math.min(soakValue, mitigated)
  };
}

/** Critical Injury lookup on roll + modifiers; results past 100 are reachable (R-14). */
export function criticalInjuryFor(total) {
  const value = Math.max(1, total);
  return CRITICAL_INJURIES.find((row) => value >= row.min && value <= row.max) || null;
}

export function criticalInjuryTotal({ roll, untreatedInjuries = 0, vicious = 0, durable = 0, fall = null }) {
  let total = roll + untreatedInjuries * 10 + vicious * 10 - durable * 10;
  if (fall === 'long') total += 50;
  if (fall === 'extreme') total += 75;
  return Math.max(CRITICAL_INJURY_RULES.modifiers.find((m) => m.id === 'durable').floor, total);
}

/** Rarity check difficulty after location and situation modifiers (§14A). */
export function rarityDifficulty(baseRarity, modifierValues = []) {
  const effective = baseRarity + modifierValues.reduce((a, b) => a + b, 0);
  const level = RARITY.difficultyFor(Math.min(effective, 10));
  const upgrades = Math.max(0, effective - 10); // R: above 10 stays Formidable but upgrades
  return { effectiveRarity: effective, difficulty: level, upgrades };
}

/** HOUSE RULE — resolve a black-market purchase (see BLACK_MARKET in data.js).
 *  It reuses the printed rarity ladder and adds the barter demand on top. */
export function blackMarketPurchase({ rarity, modifierValues = [], rationCards = 0, barterGoods = 0 }) {
  const base = rarityDifficulty(rarity, modifierValues);
  const needsBarter = rarity >= BLACK_MARKET.barterFromRarity;
  const cardsRequired = needsBarter ? BLACK_MARKET.rationCardsFor(rarity) : 0;
  const canPayInCards = rationCards >= cardsRequired;
  // Anything in trade covers the demand at the GM's discretion; short of both, the deal
  // gets harder and the shortfall is made up in cash or favours.
  const covered = canPayInCards || (needsBarter && barterGoods > 0);
  const extraSteps = needsBarter && !covered ? BLACK_MARKET.noBarterDifficultySteps : 0;

  return {
    houseRule: true,
    skill: BLACK_MARKET.skill,
    effectiveRarity: base.effectiveRarity,
    difficulty: extraSteps ? stepDifficulty(base.difficulty, extraSteps) : base.difficulty,
    baseDifficulty: base.difficulty,
    upgrades: base.upgrades,
    needsBarter,
    cardsRequired,
    cardsShort: Math.max(0, cardsRequired - rationCards),
    payingWithCards: canPayInCards && cardsRequired > 0,
    payingWithGoods: !canPayInCards && needsBarter && barterGoods > 0,
    extraSteps
  };
}

/** Talent pyramid legality (§7, §12A). `held` maps talentId -> ranks held. */
export function talentTierCounts(held = {}) {
  const counts = [0, 0, 0, 0, 0];
  for (const [id, ranks] of Object.entries(held)) {
    const def = talent(id);
    if (!def || !ranks) continue;
    for (let i = 0; i < ranks; i += 1) {
      const tier = Math.min(5, def.tier + i); // ranked purchases count one tier up each
      counts[tier - 1] += 1;
    }
  }
  return counts;
}

export function canBuyTalent(id, held = {}) {
  const def = talent(id);
  if (!def) return { ok: false, reason: 'Unknown talent.' };
  const ranksHeld = held[id] || 0;
  if (ranksHeld && !def.ranked) return { ok: false, reason: 'This talent cannot be taken more than once.' };
  if (def.requires && !held[def.requires]) {
    return { ok: false, reason: `Requires ${talent(def.requires).name}.` };
  }
  const counts = talentTierCounts(held);
  const tier = Math.min(5, def.tier + ranksHeld);
  if (tier > 1 && counts[tier - 2] < counts[tier - 1] + 1) {
    return { ok: false, reason: `The talent pyramid needs at least ${counts[tier - 1] + 1} talents in tier ${tier - 1} first.` };
  }
  return { ok: true, tier, cost: TALENT_RULES.costPerTier[tier - 1] };
}

/** Is a set of held talents legal against the pyramid (§7)? Buying is gated by
 *  `canBuyTalent`, but a refund can leave a legal set illegal, so the whole set is checked
 *  before a character is saved. */
export function pyramidLegal(held = {}) {
  const counts = talentTierCounts(held);
  for (let tier = 2; tier <= 5; tier += 1) {
    if (counts[tier - 1] > counts[tier - 2]) {
      return {
        ok: false,
        tier,
        reason: `The talent pyramid is broken: ${counts[tier - 1]} in tier ${tier} but only ${counts[tier - 2]} in tier ${tier - 1}.`
      };
    }
  }
  return { ok: true, counts };
}

/** XP cost of a purchase (§7). */
export function xpCost(kind, { newRating, newRank, tier, career: isCareer } = {}) {
  if (kind === 'characteristic') return XP_COSTS.characteristic.cost(newRating);
  if (kind === 'skill') return isCareer ? XP_COSTS.careerSkill.cost(newRank) : XP_COSTS.nonCareerSkill.cost(newRank);
  if (kind === 'talent') return XP_COSTS.talent.cost(tier);
  return 0;
}

/** Threat evaluation for a published rival (§12C guidance). */
export function isVeryChallenging(entry) {
  if (entry.veryChallenging !== undefined) return entry.veryChallenging;
  const tier = adversaryTier('rival');
  const g = tier.veryChallengingIf;
  const maxSkill = Math.max(0, ...Object.values(entry.skills || {}));
  return (entry.soak >= g.soak) || (entry.woundThreshold >= g.woundThreshold) || (maxSkill >= g.skillRank);
}

/** Group Wound Threshold for a minion group: per-member value times count (R-18). */
export function minionGroupWoundThreshold(perMember, members) {
  return adversaryTier('minion').groupWoundThreshold(perMember, members);
}

/** Group skill ranks for a minion group: members minus one (§12C). */
export function minionGroupSkillRanks(members) {
  return adversaryTier('minion').groupSkillRanks(members);
}

/** Wounds a minion group takes when a Critical Injury lands: one member's share plus one (§12C). */
export function minionCriticalWoundCost(perMember) {
  return adversaryTier('minion').criticalWoundCost(perMember);
}

export { RANDOM_ENCOUNTERS };

/** A seed for the Kicker (§13 step 6): what happened, to whom or what, and where.
 *  It is the §15A Meaning pair plus a §15B location — the same tables the solo screen
 *  rolls — used here as a writing prompt rather than as content in its own right. The
 *  sentence is still the player's to write; this only unsticks a blank page. */
export function rollKickerSeed() {
  const action = rollDie(10);
  const subject = rollDie(10);
  const place = rollDie(10);
  return {
    action: MEANING.action.find((r) => r.roll === action).word,
    subject: MEANING.subject.find((r) => r.roll === subject).word,
    location: ELEMENTS.location.find((r) => r.roll === place).entry,
    rolls: { action, subject, location: place }
  };
}

/** The seed as one line to put in front of the player. */
export function kickerSeedLine(seed) {
  return `${seed.action} — ${seed.subject.toLowerCase()}, at ${seed.location.toLowerCase()}.`;
}
