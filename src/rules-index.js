// rules-index.js — builds the searchable rules library over every extracted data table.
// Part of the screens layer: it only reads the data files and produces flat entries.

import * as D from '../data.js';
import * as N from '../data-npcs.js';
import * as M from '../data-monsters.js';
import { Settings } from './settings.js';

const entry = (title, body, cite, extra = {}) => ({ title, body: String(body), cite, ...extra });

export function buildIndex() {
  const out = [];

  D.DICE.forEach((d) => out.push(entry(`${d.name} die`, `${d.polarity} d${d.sides}, ${d.role}. Shows: ${d.symbols.join(', ')}.`, '§1')));
  out.push(entry('Resolving a roll', D.RESOLUTION_RULES.steps.join(' '), '§1'));
  out.push(entry('Building a dice pool', `${D.POOL_BUILD.notes.join(' ')} Higher of skill and characteristic sets Ability dice; the lower upgrades that many to Proficiency.`, '§2'));
  out.push(entry('Modification order', D.MODIFICATION_ORDER.join(' → '), '§2.4'));

  D.DIFFICULTIES.forEach((d) => out.push(entry(`Difficulty: ${d.name}`, `${d.dice} Difficulty dice. ${d.guidance}`, '§3')));
  D.SKILL_DIFFICULTY_GUIDANCE.forEach((g) => out.push(entry(`Difficulty examples: ${g.skill}`, `Easy — ${g.easy}. Average — ${g.average}. Hard — ${g.hard}. Daunting — ${g.daunting}.`, '§3')));

  out.push(entry('Opposed check', D.CHECK_PROCEDURES.opposed.steps.join(' '), '§3A'));
  out.push(entry('Competitive check', `${D.CHECK_PROCEDURES.competitive.steps.join(' ')} Ties break by ${D.CHECK_PROCEDURES.competitive.tieBreakers.join(', then ')}.`, '§3A', { badge: 'R-3' }));
  out.push(entry('Assisted check', D.CHECK_PROCEDURES.assisted.summary, '§3A'));

  D.CHARACTERISTICS.forEach((c) => out.push(entry(`Characteristic: ${c.name}`, `Rated 1–5, ${c.abbr}.`, '§4')));
  D.SKILLS.forEach((s) => out.push(entry(`Skill: ${s.name}`, `${s.category} skill, linked to ${s.characteristic}.${s.note ? ' ' + s.note : ''}`, '§4')));
  out.push(entry('Skills not used', D.EXCLUDED_SKILLS.join(', '), '§4'));

  out.push(entry('Combat sequence', COMBAT_TEXT(), '§5'));
  out.push(entry('Initiative slot filling', D.COMBAT_SEQUENCE.slotFilling.summary, '§5A\''));
  D.MANEUVERS.forEach((m) => out.push(entry(`Maneuver: ${m.name}`, m.summary, '§5A')));
  D.ACTION_TYPES.forEach((a) => out.push(entry(`Action: ${a.name}`, a.summary, '§5B')));
  out.push(entry('Combat check procedure', D.COMBAT_CHECK_PROCEDURE.steps.join(' '), '§5B'));
  D.RANGED_DIFFICULTY_BY_RANGE.forEach((r) => out.push(entry(`Ranged difficulty: ${r.range}`, `${r.difficulty}${r.note ? '. ' + r.note : ''}`, '§5B')));

  Object.entries(D.SPEND_TABLES).forEach(([key, table]) => {
    table.positive.forEach((row) => out.push(entry(`${key} spend (Advantage ${row.cost || '—'}${row.triumphOnly ? ', Triumph' : ''})`, row.effects.join(' · '), table.cite)));
    table.negative.forEach((row) => out.push(entry(`${key} spend (Threat ${row.cost || '—'}${row.despairOnly ? ', Despair' : ''})`, row.effects.join(' · '), table.cite)));
  });

  out.push(entry('Outnumbering', D.MULTIPLE_ATTACKERS.guidance.join(' '), '§5C\'\''));
  D.RANGE_BANDS.forEach((r) => out.push(entry(`Range: ${r.name}`, r.note, '§5D')));
  D.ENVIRONMENT.forEach((e) => out.push(entry(`Environment: ${e.name}`, e.summary, '§5E')));
  out.push(entry('Encumbrance', `Threshold 5 + Brawn. ${D.ENCUMBRANCE.overThreshold} ${D.ENCUMBRANCE.severeOverThreshold}`, '§5F'));
  D.RECOVERY.methods.forEach((m) => out.push(entry(`Recovery: ${m.name}`, `${m.restores}. Limit: ${m.limit}.`, m.cite || '§5G', m.ruling ? { badge: m.ruling, badgeClass: 'badge-inferred' } : {})));
  out.push(entry('Two-weapon combat', D.COMBAT_VARIANTS.twoWeapon.steps.join(' '), '§5H'));
  out.push(entry('Unarmed combat', `Damage equals Brawn, Crit 5, engaged, Knockdown. ${D.COMBAT_VARIANTS.unarmed.note}`, '§5H'));
  D.FALLING.forEach((f) => out.push(entry(`Falling: ${f.band}`, `Wounds ${f.wounds || f.woundsFormula}, strain ${f.strain}${f.criticalModifier ? `, Critical Injury roll +${f.criticalModifier}` : ''}.`, '§5I')));
  out.push(entry('Suffocation', `${D.SUFFOCATION.strainPerRound} strain per round. ${D.SUFFOCATION.escalation}`, '§5I'));
  D.SILHOUETTES.forEach((s) => out.push(entry(`Silhouette ${s.value}`, s.examples, '§5J')));

  D.DERIVED_FORMULAS.forEach((f) => out.push(entry(`Derived: ${f.name}`, `${f.formula}${f.note ? '. ' + f.note : ''}`, f.cite, f.ruling ? { badge: f.ruling, badgeClass: 'badge-inferred' } : {})));
  out.push(entry('XP costs', `Characteristic ${'10 × new rating'} (creation only) · career skill 5 × new rank · non-career skill 5 × new rank + 5 · talent 5 × tier. ${D.XP_COSTS.gates.join(' ')}`, '§7'));
  out.push(entry('Story Points', `${D.STORY_POINTS.flow} ${D.STORY_POINTS.reset} Player pool starts at 1 per PC; the GM pool starts at 0.`, '§8', { badge: 'R-4' }));
  D.STORY_POINTS.playerSpends.forEach((s) => out.push(entry(`Story Point spend: ${s.label}`, 'Player pool.', '§8')));

  D.CRITICAL_INJURIES.forEach((c) => out.push(entry(`Critical Injury ${c.min}–${c.max === 9999 ? '+' : c.max}: ${c.name}`, `${c.severity}. ${c.effect}`, '§9')));
  out.push(entry('Critical Injury modifiers', D.CRITICAL_INJURY_RULES.modifiers.map((m) => m.label).join(' · '), '§9', { badge: 'R-14' }));
  D.ITEM_QUALITIES.forEach((q) => out.push(entry(`Quality: ${q.name}`, `${q.type}. ${q.effect}`, '§10')));
  out.push(entry('Called shots', `${CALLED()}`, '§10A'));

  out.push(entry('Social encounters', `${D.SOCIAL_ENCOUNTERS.structure} ${D.SOCIAL_ENCOUNTERS.goalBased}`, '§11'));
  D.SOCIAL_ENCOUNTERS.groupInfluenceLadder.forEach((g) => out.push(entry(`Group influence: ${g.audience} targets`, `${g.difficulty} difficulty.`, '§11')));

  D.VEHICLE_RULES.characteristics.forEach((v) => out.push(entry(`Vehicle: ${v.name}`, v.summary, '§12')));
  out.push(entry('Crashes', D.VEHICLE_RULES.crashes, '§12'));

  D.TALENTS.filter((t) => Settings.showNonSettingTalents() || t.settingApplicable)
    .forEach((t) => out.push(entry(`Talent: ${t.name}`, `Tier ${t.tier}, ${t.activation}${t.ranked ? ', ranked' : ''}. ${t.summary}`, '§12A',
      t.settingApplicable ? {} : { badge: 'R-11 non-setting' })));

  Object.entries(D.MOTIVATIONS).filter(([, v]) => Array.isArray(v)).forEach(([kind, list]) => {
    list.forEach((m) => out.push(entry(`${kind}: ${m.name}`, m.detail || '', '§12B')));
  });

  N.ADVERSARY_TIERS.forEach((t) => out.push(entry(`Adversary tier: ${t.name}`, `${t.summary} ${t.rules.join(' ')}`, t.cite)));
  out.push(entry('Adversary talent', N.ADVERSARY_TALENT.summary, '§12C'));
  N.ADVERSARY_ABILITIES.forEach((a) => out.push(entry(`NPC ability: ${a.name}`, a.summary, a.cite, a.ruling ? { badge: a.ruling } : {})));
  out.push(entry('NPC quick-generation', `Roll d10 for archetype, then d10 for disposition, then build with the §12C recipes. ${N.NPC_QUICKGEN.tierMapping}`, '§20', { badge: 'R-10' }));

  D.CREATION_STEPS.forEach((s) => out.push(entry(`Creation: ${s.name}`, s.summary, s.cite, s.ruling ? { badge: s.ruling, badgeClass: 'badge-house' } : {})));
  D.CAREERS.forEach((c) => out.push(entry(`Career: ${c.name}`, `${c.summary} Career skills: ${c.skills.join(', ')}.`, '§14')));
  D.RARITY.ladder.forEach((r) => out.push(entry(`Rarity ${r.rarity}`, `${r.difficulty} to find. ${r.examples}`, '§14A')));
  D.RARITY.modifiers.forEach((m) => out.push(entry(`Rarity modifier: ${m.label}`, `${m.value >= 0 ? '+' : ''}${m.value} effective rarity.`, '§14A')));
  D.ITEM_DAMAGE.levels.filter((l) => l.repairDifficulty).forEach((l) => out.push(entry(`Item damage: ${l.name}`, `${l.penalty}. Repair at ${l.repairDifficulty}, costing ${Math.round(l.repairCostFraction * 100)}% of the item's price.`, '§14B')));
  D.ATTACHMENTS.examples.forEach((a) => out.push(entry(`Attachment: ${a.name}`, `${a.hardPoints} hard point(s). ${a.effect}`, '§14C')));

  D.GEAR.forEach((g) => out.push(entry(`Gear: ${g.name}`, `${g.effect} Encumbrance ${g.encumbrance}${g.price ? `, price ${g.price}` : ''}${g.rarity !== null && g.rarity !== undefined ? `, rarity ${g.rarity}` : ''}.`, '§15')));
  D.WEAPONS.forEach((w) => out.push(entry(`Weapon: ${w.name}`, `${w.skill}, damage ${w.damage}, Crit ${w.crit}, ${w.range} range, encumbrance ${w.encumbrance}. ${w.qualities.join(', ') || 'No special qualities.'}`, '§15C')));
  D.ARMOUR.forEach((a) => out.push(entry(`Armour: ${a.name}`, `Defence ${a.defense}, soak +${a.soak}, encumbrance ${a.encumbrance}. ${a.note}`, '§15D')));
  D.VEHICLES.forEach((v) => out.push(entry(`Vehicle: ${v.name}`, `Silhouette ${v.silhouette}, handling ${v.handling}, speed ${v.speed}, armour ${v.armour}, hull ${v.hull}, system strain ${v.systemStrain}.`, '§15E')));

  D.HEAT.thresholds.forEach((t) => out.push(entry(`Heat ${t.level}`, `Personal: ${t.personal}. Cell: ${t.cell || '—'}`, '§17.3')));
  D.HEAT.generation.rules.forEach((r) => out.push(entry('Heat generation', `${r.trigger} → Personal Heat ${r.personalHeat > 0 ? '+' : ''}${r.personalHeat}.`, '§17.1')));
  out.push(entry('Heat decay', `${D.HEAT.decay.personal} ${D.HEAT.decay.cell}`, '§17.4'));

  D.ENCOUNTER_SIZING.table.forEach((r) => out.push(entry(`Encounter sizing: ${r.setup}`, r.difficulty, '§20B')));
  D.LIFECYCLE.boundaries.forEach((b) => out.push(entry(`Lifecycle: ${b.name}`, b.effects.join(' '), '§21–§24')));
  out.push(entry('XP awards', `${D.XP_AWARDS.standardPerSession} XP per session, plus ${D.XP_AWARDS.motivationBonus} for Motivation play. ${D.XP_AWARDS.note}`, '§27'));
  D.DREAD_CHECKS.ladder.forEach((d) => out.push(entry(`Dread check: ${d.severity}`, `${d.difficulty} Discipline check. ${d.example}`, '§29')));
  D.SKILL_EXAMPLES.forEach((s) => out.push(entry(`Using ${s.skill}`, s.example, '§26')));
  D.QUICK_REFERENCE.sections.forEach((s) => out.push(entry(`Quick reference: ${s.title}`, s.body, '§30')));
  D.CONDITIONS.forEach((c) => out.push(entry(`Condition: ${c.name}`, c.effect, c.cite || '§3.9', c.inferred ? { badge: `${c.ruling} inferred`, badgeClass: 'badge-inferred' } : {})));

  M.BESTIARY.forEach((e) => out.push(entry(`${e.kind}: ${e.name}`, `${e.hook}${e.woundThreshold ? ` Wound Threshold ${e.woundThreshold}.` : ''}${e.woundThresholdPerMember && e.kind === 'minion' ? ` Wound Threshold ${e.woundThresholdPerMember} per member.` : ''}`, e.cite)));
  M.ENCOUNTER_BLOCKS.forEach((b) => out.push(entry(`Encounter block: ${b.name}`, `${b.hook} ${b.consequence}`, b.cite)));
  M.RANDOM_ENCOUNTERS.table.forEach((r) => out.push(entry(`Random encounter ${r.roll}`, r.entry, 'B§7')));

  return out;
}

const COMBAT_TEXT = () => 'Everyone rolls a Simple Cool or Vigilance check for Initiative; rank by uncancelled Success. That produces slots owned by the PC or NPC side, and each round the owning side picks who fills each slot.';
const CALLED = () => 'Declared before the roll and aimed with the Aim maneuver\'s targeted option; on a hit, three Advantage disables the target or their gear instead of dealing damage.';

export function search(index, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return index;
  const terms = q.split(/\s+/);
  return index.filter((e) => {
    const haystack = `${e.title} ${e.body} ${e.cite || ''} ${e.badge || ''}`.toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}
