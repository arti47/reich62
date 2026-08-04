// rules-index.js — builds the searchable rules library over every extracted data table.
// Part of the screens layer: it only reads the data files and produces flat entries.

import * as D from '../data.js';
import * as N from '../data-npcs.js';
import * as M from '../data-monsters.js';
import { Settings } from './settings.js';

/** Which part of the books an entry belongs to, so the library can group rather than
 *  present 547 rows in one run. */
export const SECTIONS = [
  { id: 'dice',       label: 'Dice and checks',      test: (c) => /^§(1|2|3A?)\b/.test(c) },
  { id: 'combat',     label: 'Combat',               test: (c) => /^§5/.test(c) },
  { id: 'character',  label: 'Characters',           test: (c) => /^§(4|6|7|12A|12B|13|16A)\b/.test(c) },
  { id: 'economy',    label: 'Story points and experience', test: (c) => /^§(8|27)\b/.test(c) },
  { id: 'injury',     label: 'Injury and recovery',  test: (c) => /^§9\b/.test(c) },
  { id: 'gear',       label: 'Gear and money',       test: (c) => /^§(10|14|15)/.test(c) },
  { id: 'social',     label: 'Social encounters',    test: (c) => /^§11\b/.test(c) },
  { id: 'vehicles',   label: 'Vehicles',             test: (c) => /^§12\b/.test(c) },
  { id: 'careers',    label: 'Careers',              test: (c) => /^§14$/.test(c) },
  { id: 'heat',       label: 'Suspicion',            test: (c) => /^§17/.test(c) },
  { id: 'opponents',  label: 'Opponents',            test: (c) => /^/.test(c) },
  { id: 'running',    label: 'Running the game',     test: (c) => /^§(18|19|21|22|23|24|26|29|30)/.test(c) },
  { id: 'other',      label: 'Everything else',      test: () => true }
];

export function sectionFor(cite) {
  const found = SECTIONS.find((sec) => sec.test(String(cite || '')));
  return found ? found.id : 'other';
}

/** Entries read as sentences: the title names the thing, the body is a full sentence
 *  explaining it, and the citation says where it comes from. */
const entry = (title, body, cite, extra = {}) => {
  let text = String(body).trim();
  if (text && !/[.!?)]$/.test(text)) text += '.';
  if (text) text = text.charAt(0).toUpperCase() + text.slice(1);
  return { title, body: text, cite, section: sectionFor(cite), ...extra };
};

export function buildIndex() {
  const out = [];

  D.DICE.forEach((d) => out.push(entry(
    `${d.name} die`,
    `A ${d.colour} ${d.sides}-sided die on the ${d.polarity} side of the pool, rolled for ${d.role}. Its faces can show ${listWords(d.symbols)}`,
    '§1')));
  out.push(entry('Resolving a roll', D.RESOLUTION_RULES.steps.join(' '), '§1'));
  out.push(entry('Building a dice pool', `${D.POOL_BUILD.notes.join(' ')} Higher of skill and characteristic sets Ability dice; the lower upgrades that many to Proficiency.`, '§2'));
  out.push(entry('Modification order', D.MODIFICATION_ORDER.join(' → '), '§2.4'));

  D.DIFFICULTIES.forEach((d) => out.push(entry(
    `${d.name} difficulty`,
    `${d.dice === 0 ? 'No difficulty dice at all' : `${d.dice} difficulty ${d.dice === 1 ? 'die' : 'dice'}`}. ${d.guidance}${d.storyPointCost ? `, and it costs ${d.storyPointCost} story point simply to attempt` : ''}`,
    '§3')));
  D.SKILL_DIFFICULTY_GUIDANCE.forEach((g) => out.push(entry(`Difficulty examples: ${g.skill}`, `Easy — ${g.easy}. Average — ${g.average}. Hard — ${g.hard}. Daunting — ${g.daunting}.`, '§3')));

  out.push(entry('Opposed check', D.CHECK_PROCEDURES.opposed.steps.join(' '), '§3A'));
  out.push(entry('Competitive check', `${D.CHECK_PROCEDURES.competitive.steps.join(' ')} Ties break by ${D.CHECK_PROCEDURES.competitive.tieBreakers.join(', then ')}.`, '§3A', {}));
  out.push(entry('Assisted check', D.CHECK_PROCEDURES.assisted.summary, '§3A'));

  D.CHARACTERISTICS.forEach((c) => out.push(entry(
    c.name,
    `One of the six characteristics, rated 1 to 5 and abbreviated ${c.abbr}. Every skill is governed by one of them`,
    '§4')));
  D.SKILLS.forEach((s) => out.push(entry(
    s.name,
    `A ${s.category} skill governed by ${titleCase(s.characteristic)}, so its pool is built from whichever of the two is higher.${s.note ? ' ' + s.note : ''}`,
    '§4')));
  out.push(entry('Skills not used', D.EXCLUDED_SKILLS.join(', '), '§4'));

  out.push(entry('Combat sequence', COMBAT_TEXT(), '§5'));
  out.push(entry('Initiative slot filling', D.COMBAT_SEQUENCE.slotFilling.summary, '§5A\''));
  D.MANEUVERS.forEach((m) => out.push(entry(m.name, m.summary, '§5A')));
  D.ACTION_TYPES.forEach((a) => out.push(entry(a.name, a.summary, '§5B')));
  out.push(entry('Combat check procedure', D.COMBAT_CHECK_PROCEDURE.steps.join(' '), '§5B'));
  D.RANGED_DIFFICULTY_BY_RANGE.forEach((r) => out.push(entry(
    `Shooting at ${r.range} range`,
    `${titleCase(r.difficulty)} difficulty${r.note ? `. ${r.note}` : ''}`,
    '§5B')));

  Object.entries(D.SPEND_TABLES).forEach(([key, table]) => {
    table.positive.forEach((row) => out.push(entry(`${key} spend (Advantage ${row.cost || '—'}${row.triumphOnly ? ', Triumph' : ''})`, row.effects.join(' · '), table.cite)));
    table.negative.forEach((row) => out.push(entry(`${key} spend (Threat ${row.cost || '—'}${row.despairOnly ? ', Despair' : ''})`, row.effects.join(' · '), table.cite)));
  });

  out.push(entry('Outnumbering', D.MULTIPLE_ATTACKERS.guidance.join(' '), '§5C\'\''));
  D.RANGE_BANDS.forEach((r) => out.push(entry(`${r.name} range`, r.note, '§5D')));
  D.ENVIRONMENT.forEach((e) => out.push(entry(e.name, e.summary, '§5E')));
  out.push(entry('Encumbrance', `Threshold 5 + Brawn. ${D.ENCUMBRANCE.overThreshold} ${D.ENCUMBRANCE.severeOverThreshold}`, '§5F'));
  D.RECOVERY.methods.forEach((m) => out.push(entry(`Recovery: ${m.name}`, `${m.restores}. Limit: ${m.limit}.`, m.cite || '§5G', {})));
  out.push(entry('Two-weapon combat', D.COMBAT_VARIANTS.twoWeapon.steps.join(' '), '§5H'));
  out.push(entry('Unarmed combat', `Damage equals Brawn, Crit 5, engaged, Knockdown. ${D.COMBAT_VARIANTS.unarmed.note}`, '§5H'));
  D.FALLING.forEach((f) => out.push(entry(`Falling: ${f.band}`, `Wounds ${f.wounds || f.woundsFormula}, strain ${f.strain}${f.criticalModifier ? `, Critical Injury roll +${f.criticalModifier}` : ''}.`, '§5I')));
  out.push(entry('Suffocation', `${D.SUFFOCATION.strainPerRound} strain per round. ${D.SUFFOCATION.escalation}`, '§5I'));
  D.SILHOUETTES.forEach((s) => out.push(entry(
    `Size ${s.value}`,
    `${s.examples}. A target two or more sizes larger is one step easier to hit, two or more sizes smaller one step harder`,
    '§5J')));

  D.DERIVED_FORMULAS.forEach((f) => out.push(entry(`Derived: ${f.name}`, `${f.formula}${f.note ? '. ' + f.note : ''}`, f.cite, {})));
  out.push(entry('XP costs', `Characteristic ${'10 × new rating'} (creation only) · career skill 5 × new rank · non-career skill 5 × new rank + 5 · talent 5 × tier. ${D.XP_COSTS.gates.join(' ')}`, '§7'));
  out.push(entry('Story Points', `${D.STORY_POINTS.flow} ${D.STORY_POINTS.reset} Player pool starts at 1 per PC; the GM pool starts at 0.`, '§8', {}));
  D.STORY_POINTS.playerSpends.forEach((s) => out.push(entry(`Story Point spend: ${s.label}`, 'Player pool.', '§8')));

  D.CRITICAL_INJURIES.forEach((c) => out.push(entry(`Critical Injury ${c.min}–${c.max === 9999 ? '+' : c.max}: ${c.name}`, `${c.severity}. ${c.effect}`, '§9')));
  out.push(entry('Critical Injury modifiers', D.CRITICAL_INJURY_RULES.modifiers.map((m) => m.label).join(' · '), '§9', {}));
  D.ITEM_QUALITIES.forEach((q) => out.push(entry(
    q.name,
    `${q.type === 'passive' ? 'Always on' : 'Triggered when you spend for it'}. ${q.effect}`,
    '§10')));
  out.push(entry('Called shots', `${CALLED()}`, '§10A'));

  out.push(entry('Social encounters', `${D.SOCIAL_ENCOUNTERS.structure} ${D.SOCIAL_ENCOUNTERS.goalBased}`, '§11'));
  D.SOCIAL_ENCOUNTERS.groupInfluenceLadder.forEach((g) => out.push(entry(`Group influence: ${g.audience} targets`, `${g.difficulty} difficulty.`, '§11')));

  D.VEHICLE_RULES.characteristics.forEach((v) => out.push(entry(`Vehicle: ${v.name}`, v.summary, '§12')));
  out.push(entry('Crashes', D.VEHICLE_RULES.crashes, '§12'));

  D.TALENTS.filter((t) => Settings.showNonSettingTalents() || t.settingApplicable)
    .forEach((t) => out.push(entry(t.name, `A tier ${t.tier} talent costing ${t.tier * 5} experience, used as ${t.activation === 'passive' ? 'a passive effect' : `an ${t.activation}`}${t.ranked ? ', and it can be bought more than once' : ''}. ${t.summary}`, '§12A',
      t.settingApplicable ? {} : { badge: 'not in this setting' })));

  Object.entries(D.MOTIVATIONS).filter(([, v]) => Array.isArray(v)).forEach(([kind, list]) => {
    list.forEach((m) => out.push(entry(`${kind}: ${m.name}`, m.detail || '', '§12B')));
  });

  N.ADVERSARY_TIERS.forEach((t) => out.push(entry(`Adversary tier: ${t.name}`, `${t.summary} ${t.rules.join(' ')}`, t.cite)));
  out.push(entry('Adversary talent', N.ADVERSARY_TALENT.summary, '§12C'));
  N.ADVERSARY_ABILITIES.forEach((a) => out.push(entry(a.name, a.summary, a.cite, {})));
  out.push(entry('NPC quick-generation', `Roll d10 for archetype, then d10 for disposition, then build with the §12C recipes. ${N.NPC_QUICKGEN.tierMapping}`, '§20', {}));

  D.CREATION_STEPS.forEach((s) => out.push(entry(`Creation: ${s.name}`, s.summary, s.cite, s.ruling ? { badge: 'house aid', badgeClass: 'badge-house' } : {})));
  D.CAREERS.forEach((c) => out.push(entry(
    c.name,
    `${c.summary} Its career skills are ${c.skills.map(titleCase).join(', ')}, and you pick four of them to start at rank 1`,
    '§14')));
  D.RARITY.ladder.forEach((r) => out.push(entry(`Rarity ${r.rarity}`, `${r.difficulty} to find. ${r.examples}`, '§14A')));
  D.RARITY.modifiers.forEach((m) => out.push(entry(`Rarity modifier: ${m.label}`, `${m.value >= 0 ? '+' : ''}${m.value} effective rarity.`, '§14A')));
  D.ITEM_DAMAGE.levels.filter((l) => l.repairDifficulty).forEach((l) => out.push(entry(`Item damage: ${l.name}`, `${l.penalty}. Repair at ${l.repairDifficulty}, costing ${Math.round(l.repairCostFraction * 100)}% of the item's price.`, '§14B')));
  D.ATTACHMENTS.examples.forEach((a) => out.push(entry(`Attachment: ${a.name}`, `${a.hardPoints} hard point(s). ${a.effect}`, '§14C')));

  D.GEAR.forEach((g) => out.push(entry(
    g.name,
    `${g.effect} Encumbrance ${g.encumbrance}${g.price ? `, costing ${g.price}` : ''}${g.rarity !== null && g.rarity !== undefined ? `, rarity ${g.rarity}` : ''}`,
    '§15')));
  D.WEAPONS.forEach((w) => out.push(entry(
    w.name,
    `Used with ${titleCase(w.skill)} at ${w.range} range. Damage ${w.damage}, critical rating ${w.crit}, encumbrance ${w.encumbrance}. ${w.qualities.length ? `Qualities: ${w.qualities.join(', ')}` : 'It has no special qualities'}`,
    '§15C')));
  D.ARMOUR.forEach((a) => out.push(entry(
    a.name,
    `Adds ${a.soak} to damage resisted and ${a.defense} to defence, for ${a.encumbrance} encumbrance. ${a.note}`,
    '§15D')));
  D.VEHICLES.forEach((v) => out.push(entry(
    v.name,
    `Size ${v.silhouette}, top speed ${v.speed}, handling ${v.handling >= 0 ? '+' : ''}${v.handling}. It takes ${v.hull} hull trauma and ${v.systemStrain} system strain before it stops, behind ${v.armour} armour`,
    '§15E')));

  D.HEAT.thresholds.forEach((t) => out.push(entry(`Heat ${t.level}`, `Personal: ${t.personal}. Cell: ${t.cell || '—'}`, '§17.3')));
  D.HEAT.generation.rules.forEach((r) => out.push(entry('Heat generation', `${r.trigger} → Personal Heat ${r.personalHeat > 0 ? '+' : ''}${r.personalHeat}.`, '§17.1')));
  out.push(entry('Heat decay', `${D.HEAT.decay.personal} ${D.HEAT.decay.cell}`, '§17.4'));

  D.ENCOUNTER_SIZING.table.forEach((r) => out.push(entry(`Encounter sizing: ${r.setup}`, r.difficulty, '§20B')));
  D.LIFECYCLE.boundaries.forEach((b) => out.push(entry(`Lifecycle: ${b.name}`, b.effects.join(' '), '§21–§24')));
  out.push(entry('XP awards', `${D.XP_AWARDS.standardPerSession} XP per session, plus ${D.XP_AWARDS.motivationBonus} for Motivation play. ${D.XP_AWARDS.note}`, '§27'));
  D.DREAD_CHECKS.ladder.forEach((d) => out.push(entry(`Dread check: ${d.severity}`, `${d.difficulty} Discipline check. ${d.example}`, '§29')));
  D.SKILL_EXAMPLES.forEach((s) => out.push(entry(`Using ${titleCase(s.skill)}`, s.example, '§26')));
  D.QUICK_REFERENCE.sections.forEach((s) => out.push(entry(`Quick reference: ${s.title}`, s.body, '§30')));
  D.CONDITIONS.forEach((c) => out.push(entry(c.name, c.effect, c.cite || '§3.9', c.inferred ? { badge: 'inferred', badgeClass: 'badge-inferred' } : {})));

  M.BESTIARY.forEach((e) => out.push(entry(`${e.name} (${e.kind})`, `${e.hook}${e.woundThreshold ? ` Wound Threshold ${e.woundThreshold}.` : ''}${e.woundThresholdPerMember && e.kind === 'minion' ? ` Wound Threshold ${e.woundThresholdPerMember} per member.` : ''}`, e.cite)));
  M.ENCOUNTER_BLOCKS.forEach((b) => out.push(entry(b.name, `${b.hook} ${b.consequence}`, b.cite)));
  M.RANDOM_ENCOUNTERS.table.forEach((r) => out.push(entry(`Random encounter, roll ${r.roll}`, r.entry, 'B§7')));

  return out;
}

const titleCase = (v) => String(v).charAt(0).toUpperCase() + String(v).slice(1);
const listWords = (arr) => arr.length > 1 ? `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}` : arr[0];

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
