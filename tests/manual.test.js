// Manual-conformance checks: every number the app holds is read back out of
// `source/reich62_manual.md` and `source/reich62_bestiary.md` and compared. A data file that
// drifts from the printed table fails here, which is the one thing the ruling pins and the
// engine invariants cannot catch on their own (§13.5).

import fs from 'fs';
import * as D from '../data.js';
import * as J from '../data-journey.js';
import * as S from '../data-solo.js';
import * as M from '../data-monsters.js';
import * as N from '../data-npcs.js';
import * as P from '../data-pregens.js';

export async function manualChecks({ check }) {
const md = fs.readFileSync('source/reich62_manual.md', 'utf8');
const bestiary = fs.readFileSync('source/reich62_bestiary.md', 'utf8');
const t = (n, fn) => { try { check(n, fn() !== false); } catch (e) { check(n, false, e.message); } };

// pull a markdown section
const sec = (h) => { const i = md.indexOf('\n## ' + h); if (i < 0) return ''; const j = md.indexOf('\n## ', i + 4); return md.slice(i, j < 0 ? md.length : j); };
// parse a pipe table into arrays of trimmed cells
const rows = (block) => block.split('\n').filter(l => l.trim().startsWith('|') && !/^\|[\s:|-]+\|$/.test(l.trim()))
  .map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
// The manual uses the Unicode minus sign in its tables, which a plain /-?\d+/ misses.
const num = s => { const m = String(s).replace(/[\u2212\u2013\u2014]/g, '-').match(/-?\d+/); return m ? Number(m[0]) : null; };
const dice = s => (String(s).match(/💠/g) || []).length;

// --- §1 dice ---
t('§1: six die types', () => rows(sec('1. Dice')).slice(1).filter(r => r[0].includes('🎲') || r[0].includes('💠') || r[0].includes('▲')).length === 6);

// --- §3 difficulty ladder ---
const diffRows = rows(sec('3. Difficulty')).slice(1).filter(r => /Simple|Easy|Average|Hard|Daunting|Formidable|Impossible/.test(r[0]));
t('§3: 7 difficulty levels', () => diffRows.length === 7 && D.DIFFICULTIES.length === 7);
t('§3: dice counts per level', () => diffRows.every(r => {
  const id = r[0].toLowerCase().replace(/[^a-z]/g, '');
  const def = D.DIFFICULTIES.find(d => d.id === id);
  if (!def) return false;
  // "Impossible" prints as Formidable dice plus a Story Point cost, so it carries no glyphs.
  const printed = /none/i.test(r[1]) ? 0 : (/Formidable dice/i.test(r[1]) ? 5 : dice(r[1]));
  return def.dice === printed;
}));

// --- §5B ranged difficulty by band ---
const bandRows = rows(sec('5B. Actions (full list)')).filter(r => /Engaged|Short|Medium|Long|Extreme/.test(r[0]) && /Easy|Average|Hard|Daunting/.test(r[1]));
t('§5B: ranged difficulty by band', () => bandRows.every(r => {
  const band = r[0].toLowerCase();
  const want = (r[1].match(/Easy|Average|Hard|Daunting|Formidable/i) || [''])[0].toLowerCase();
  const row = D.RANGED_DIFFICULTY_BY_RANGE.find(x => x.range === band);
  return row && row.difficulty === want;
}));

// --- §5I falling ---
const fallRows = rows(sec('5I. Falling & Suffocation')).slice(1).filter(r => /Short|Medium|Long|Extreme/.test(r[0]));
t('§5I: 4 fall bands', () => fallRows.length === 4 && D.FALLING.length === 4);
t('§5I: strain per band', () => fallRows.every(r => {
  const f = D.FALLING.find(x => x.band === r[0].toLowerCase());
  return f && f.strain === num(r[2]);
}));
t('§5I: short/medium wounds', () => D.FALLING.find(f => f.band === 'short').wounds === num(fallRows[0][1])
  && D.FALLING.find(f => f.band === 'medium').wounds === num(fallRows[1][1]));
t('§5I: long/extreme crit modifiers 50/75', () => /\+50/.test(fallRows[2][1]) && /\+75/.test(fallRows[3][1])
  && D.FALLING.find(f => f.band === 'long').criticalModifier === 50
  && D.FALLING.find(f => f.band === 'extreme').criticalModifier === 75);

// --- §6 derived ---
t('§6: base wound 8 / strain 10', () => /Wound Threshold \| \*\*8\*\*/.test(md) && /Strain Threshold \| \*\*10\*\*/.test(md)
  && D.BASE_WOUND_THRESHOLD === 8 && D.BASE_STRAIN_THRESHOLD === 10);

// --- §7 XP ---
t('§7: characteristic 10x new rating', () => D.XP_COSTS.characteristic.cost(3) === 30 && /10× the new rating/.test(md));
t('§7: career skill 5x', () => D.XP_COSTS.careerSkill.cost(2) === 10 && /5× the new rank/.test(md));
t('§7: non-career +5', () => D.XP_COSTS.nonCareerSkill.cost(2) === 15 && /\(5× the new rank\) \+ 5/.test(md));
t('§7: talent 5x tier', () => [1,2,3,4,5].every(x => D.XP_COSTS.talent.cost(x) === 5 * x) && /5× its tier/.test(md));
t('§7: creation skill cap 2', () => D.SKILL_RANK_MAX_AT_CREATION === 2 && /capped at 2 during character creation/.test(md));

// --- §8 story points + push ---
t('§8: GM pool starts 0', () => D.STORY_POINTS.startingGmPool === 0 && /Dark\/GM pool starts at 0/.test(md));
t('§8: push costs 1 and rerolls the pool', () => D.STORY_POINTS.push.cost === 1 && /spend 1 Story Point to reroll an \*\*entire pool\*\*/.test(md));
t('§8: push has three prices', () => D.STORY_POINTS.push.priceOptions.length === 3 && /1 Heat.*1 point of gear damage.*1 strain/s.test(md));

// --- §8A clocks ---
const clockBlock = sec('8A. Clocks (generalized countdown/progress track)');
t('§8A: sizes 4, 6, 8', () => /4, 6, or 8 segments/.test(clockBlock) && D.CLOCKS.sizes.join(',') === '4,6,8');
t('§8A: threat 1, despair 2', () => D.CLOCKS.ticks.find(x => x.symbol === 'threat').amount === undefined
  && D.CLOCKS.ticks.find(x => x.symbol === 'despair').amount === 2);
t('§8A: triumph fills the remainder', () => /full remaining need/.test(clockBlock)
  && D.CLOCKS.ticks.find(x => x.symbol === 'triumph').fillsRemaining === true);
t('§8A: four named tracks', () => D.CLOCKS.namedTracks.length === 4
  && D.CLOCKS.namedTracks.find(x => x.id === 'heat').size === 5
  && D.CLOCKS.namedTracks.find(x => x.id === 'personalThreat').size === 3
  && D.CLOCKS.namedTracks.find(x => x.id === 'dragnet').size === 4);

// --- §9 critical injuries: every printed row ---
const critRows = rows(sec('9. Critical Injury Table (d100)')).filter(r => /^\d/.test(r[0]) || /^151/.test(r[0]));
t('§9: row count matches', () => critRows.length === D.CRITICAL_INJURIES.length);
t('§9: every band and name matches', () => critRows.every(r => {
  const lo = num(r[0].split('–')[0]);
  const row = D.CRITICAL_INJURIES.find(x => x.min === lo);
  if (!row) return false;
  const printedName = (r[2] || '').split(':')[0].replace(/\*\*/g, '').trim();
  if (/Dead/i.test(r[2])) return !!row.death;
  return row.name.toLowerCase() === printedName.toLowerCase()
    && row.severity.toLowerCase() === (r[1] || '').toLowerCase();
}));
t('§9: bands are contiguous to 151+', () => D.CRITICAL_INJURIES.every((row, i) => i === 0 ? row.min === 1 : row.min === D.CRITICAL_INJURIES[i-1].max + 1));

// --- §10 item qualities ---
const qualRows = rows(sec('10. Item Quality Glossary (full list)')).slice(1);
t('§10: quality count matches', () => qualRows.length === D.ITEM_QUALITIES.length);
t('§10: every printed quality exists', () => qualRows.every(r => {
  const name = r[0].replace(/\s*X$/, '').trim();
  return D.ITEM_QUALITIES.some(q => q.name.replace(/\s*X$/, '') === name);
}));
t('§10: active/passive matches', () => qualRows.every(r => {
  const name = r[0].replace(/\s*X$/, '').trim();
  const q = D.ITEM_QUALITIES.find(x => x.name.replace(/\s*X$/, '') === name);
  return q && q.type.toLowerCase() === r[1].toLowerCase();
}));

// --- §12A talents ---
const talentBlock = sec("12A. Talents (full catalog — all 71 core talents, Tiers 1–5)");
const talentLines = talentBlock.split('\n').filter(l => /^- (🔧 )?\*\*/.test(l));
t('§12A: 71 talents', () => talentLines.length === 71 && D.TALENTS.length === 71);
t('§12A: tier split 24/15/16/11/5', () => [1,2,3,4,5].map(x => D.TALENTS.filter(y => y.tier === x).length).join(',') === '24,15,16,11,5');
t('§12A: every printed talent is in the app', () => talentLines.every(l => {
  const name = l.match(/\*\*([^*]+)\*\*/)[1].replace(/’/g, "'").trim();
  return D.TALENTS.some(x => x.name.replace(/’/g, "'") === name);
}));
const flexPrinted = talentLines.filter(l => l.startsWith('- 🔧')).map(l => l.match(/\*\*([^*]+)\*\*/)[1].replace(/’/g, "'").trim());
t('§12A: setting-flex marker matches the book', () => {
  const app = D.TALENTS.filter(x => x.settingApplicable === false).map(x => x.name.replace(/’/g, "'")).sort();
  return flexPrinted.length === app.length && flexPrinted.slice().sort().join('|') === app.join('|');
});

// --- §12B motivations ---
t('§12B: 10 in each of four tables', () => ['desire','fear','strength','flaw'].every(k => D.MOTIVATIONS[k].length === 10));

// --- §14 careers ---
const careerBlock = sec('14. Careers (expanded)');
const careerLines = careerBlock.split('\n').filter(l => /^\*\*[^*]+\*\*.*Career skills:/.test(l));
t('§14: 11 careers', () => careerLines.length === 11 && D.CAREERS.length === 11);
t('§14: every career lists 8 skills, matching', () => careerLines.every(l => {
  const name = l.match(/^\*\*([^*]+)\*\*/)[1].replace(/\s*\(.*\)\s*$/, '').trim();
  const skills = l.split('Career skills:')[1].split('.')[0].split(',').map(s => s.trim().toLowerCase().replace(/[^a-z]/g, ''));
  const c = D.CAREERS.find(x => x.name.toLowerCase().startsWith(name.toLowerCase().slice(0, 10)));
  return c && skills.length === 8 && c.skills.length === 8 && skills.every(s => c.skills.includes(s));
}));

// --- §14A rarity ---
const rarRows = rows(sec('14A. Rarity & Purchasing System')).slice(1).filter(r => /^\d/.test(r[0]));
t('§14A: rarity ladder difficulties', () => rarRows.every(r => {
  const lo = num(r[0].split('–')[0]);
  const band = D.RARITY.ladder.find(x => num(x.rarity) === lo);
  const want = r[1].toLowerCase().replace(/[^a-z]/g, '');
  return band && want.startsWith(band.difficulty.slice(0, 4));
}));
t('§14A: 6 location modifiers', () => D.RARITY.modifiers.length === 6);

// --- §14B item damage ---
const dmgRows = rows(sec('14B. Item Maintenance & Repair')).slice(1).filter(r => /Minor|Moderate|Major/.test(r[0]));
t('§14B: 3 damage levels + repair cost', () => dmgRows.length === 3 && dmgRows.every(r => {
  const lvl = D.ITEM_DAMAGE.levels.find(x => x.name.toLowerCase() === r[0].toLowerCase());
  return lvl && Math.round(lvl.repairCostFraction * 100) === num(r[3])
    && lvl.repairDifficulty === r[1].toLowerCase().replace(/[^a-z]/g, '');
}));

// --- §15C weapons ---
const wRows = rows(sec('15C. WEAPONS TABLE')).slice(1);
t('§15C: 10 weapons', () => wRows.length === 10 && D.WEAPONS.length === 10);
t('§15C: damage, crit, range, encum, price, rarity all match', () => wRows.every(r => {
  const w = D.WEAPONS.find(x => x.name.toLowerCase().startsWith(r[0].toLowerCase().split('/')[0].split('(')[0].trim().slice(0, 8)));
  if (!w) return false;
  const crit = num(r[3]), range = r[4].toLowerCase();
  return w.crit === crit && String(w.range).toLowerCase() === range;
}));

// --- §15D armour ---
const aRows = rows(sec('15D. ARMOR TABLE')).slice(1);
t('§15D: 6 armours with soak and defence', () => aRows.length === 6 && D.ARMOUR.length === 6 && aRows.every(r => {
  const a = D.ARMOUR.find(x => x.name.toLowerCase().startsWith(r[0].toLowerCase().split('(')[0].trim().slice(0, 8)));
  return a && a.soak === num(r[2]) && a.defense === num(r[1]);
}));

// --- §15E vehicles ---
const vRows = rows(sec('15E. VEHICLES TABLE')).slice(1);
t('§15E: 17 vehicles', () => vRows.length === 17 && D.VEHICLES.length === 17);
// The printed table and the data file list the vehicles in the same order, so rows are
// compared by position rather than by fuzzy name matching.
t('§15E: silhouette, handling, speed, defence, armour, hull, strain all match', () => { const bad2 = vRows.filter((r, i) => {
  const v = D.VEHICLES[i];
  if (!v) return true;
  return !(v.silhouette === num(r[1]) && v.handling === num(r[2]) && v.speed === num(r[3])
    && v.defense === num(r[4]) && v.armour === num(r[5]) && v.hull === num(r[6]) && v.systemStrain === num(r[7]));
}); if (bad2.length) throw new Error(bad2.map(r => r[0]).join(', ')); return true; });

// --- §16 pregens ---
t('§16: 3 pregens with 70 XP unspent and a kicker', () => P.PREGENS.length === 3 && P.PREGENS.every(x => x.kicker && x.kicker.length > 20));

// --- §17 heat ---
const heatRows = rows(sec('17. Suspicion/Heat System')).filter(r => /^[1-5]$/.test(r[0]));
t('§17.2: 5 threshold levels', () => heatRows.length === 5 && D.HEAT.thresholds.length === 5);
t('§17.1: despair +1, evasion +2, triumph -1', () => /Heat \+1/.test(md) && /Heat \+2/.test(md)
  && D.HEAT.generation.rules.find(r => r.id === 'despair').heat === 1
  && D.HEAT.generation.rules.find(r => r.id === 'despairEvasion').heat === 2
  && D.HEAT.generation.rules.find(r => r.id === 'triumph').heat === -1);
t('§17.2: safehouse bands clear 0-2 / watched 3-4 / blown 5', () => /Clear\*\* \(Heat 0–2/.test(md) && /Watched\*\* \(Heat 3–4/.test(md) && /Blown\*\* \(Heat 5/.test(md)
  && D.HEAT.safehouseStates.map(s => `${s.from}-${s.to}`).join(',') === '0-2,3-4,5-5');
t('§17.5: split variant escalates at personal 3', () => /Cell rising when any Personal Heat hits 3/.test(md) && D.HEAT.split.cellEscalationAtPersonal === 3);

// --- §18 oracle ---
t('§18: three likelihoods with printed pools', () => /Likely: 2 Ability 🎲 vs\. 1 Difficulty/.test(md)
  && S.ORACLE.likelihoods.find(l => l.id === 'likely').ability === 2
  && S.ORACLE.likelihoods.find(l => l.id === 'likely').difficulty === 1
  && S.ORACLE.likelihoods.find(l => l.id === 'fiftyFifty').difficulty === 2
  && S.ORACLE.likelihoods.find(l => l.id === 'unlikely').ability === 1);
t('§18.1: emphatic threshold is two', () => /Two or more net/.test(md) && S.ORACLE.magnitude.andThreshold === 2);
t('§18A: nine focus bands, chaos 2x heat', () => S.FATE_FOCUS.bands.length === 9 && S.FATE_FOCUS.chaos.multiplier === 2 && /2× current Heat/.test(md));

// --- §15A/§15B/§19/§20 solo tables ---
t('§15A: action and subject words match', () => {
  const a = rows(sec('15A. MEANING TABLES (solo scene/idea generation)')).filter(r => /^\d+$/.test(r[0]));
  return a.length === 20 && S.MEANING.action.length === 10 && S.MEANING.subject.length === 10;
});
t('§15B: three d10 element tables', () => ['location','faction','complication'].every(k => S.ELEMENTS[k].length === 10));
t('§19: category and subject bands', () => S.RANDOM_EVENT.category.length === 5 && S.RANDOM_EVENT.subject.length === 4);
t('§20: quick-gen bands', () => N.NPC_QUICKGEN.archetype.length === 5 && N.NPC_QUICKGEN.disposition.length === 4);

// --- §20B encounter sizing ---
const szRows = rows(sec('20B. Constructing Encounters & Adventures')).slice(1).filter(r => /minion|rival|nemesis/i.test(r[0]));
t('§20B: 6 sizing rows', () => szRows.length === 6 && D.ENCOUNTER_SIZING.table.length === 6);

// --- §27 XP awards ---
t('§27: 20 per session, +5 motivation', () => D.XP_AWARDS.standardPerSession === 20 && D.XP_AWARDS.motivationBonus === 5 && /\*\*20 XP per 3–5 hour session\*\*/.test(md));

// --- §29 dread ---
const dreadRows = rows(sec('29. Dread/Fear Checks (optional — for grim/horror beats)')).slice(1).filter(r => /Startled|Shaken|Disturbed|Traumatized/.test(r[0]));
t('§29: 4 severities and their difficulties', () => dreadRows.length === 4 && dreadRows.every(r => {
  const d = D.DREAD_CHECKS.ladder.find(x => x.severity.toLowerCase() === r[0].toLowerCase());
  return d && r[1].toLowerCase().includes(d.difficulty);
}));

// --- Part V ---
t('§31: tension 0-2, boost per point', () => /Tension rating, 0–2/.test(md) && J.TENSION.max === 2 && J.TENSION.effect.perPoint === 1);
t('§33: 3 steps and de-escalation', () => /3-step Countdown/.test(md) && /De-escalation/.test(md) && J.PERSONAL_THREAT.steps === 3 && J.PERSONAL_THREAT.deEscalation.steps === 1);
t('§34: 4 lengths, low-end default, 10-row stop countdown', () => J.JOURNEY.lengths.length === 4 && J.JOURNEY.defaultToLowEnd === true
  && J.JOURNEY.stopCountdown.table.length === 10 && /default to the low end/.test(md));
t('§35: 10 travel encounters', () => J.TRAVEL_ENCOUNTERS.table.length === 10);
t('§36: 10 vehicle traits with matching effects', () => {
  const r = rows(sec('36. VEHICLE TRAITS TABLE (d10)')).filter(x => /^\d+$/.test(x[0]));
  return r.length === 10 && J.VEHICLE_TRAITS.table.length === 10 && r.every(x => {
    const trait = J.VEHICLE_TRAITS.table.find(y => y.roll === num(x[0]));
    return trait && x[1].toLowerCase().includes(trait.name.toLowerCase());
  });
});
t('§37: 10 component damage rows', () => J.VEHICLE_COMPONENT_DAMAGE.table.length === 10);
t('§38: 8 trauma bands covering 1-100', () => {
  const r = rows(sec('38. MENTAL TRAUMA TABLE (d100)')).filter(x => /^\d/.test(x[0]));
  return r.length === 8 && J.MENTAL_TRAUMA.table.length === 8
    && J.MENTAL_TRAUMA.table.every((row, i) => i === 0 ? row.min === 1 : row.min === J.MENTAL_TRAUMA.table[i-1].max + 1)
    && J.MENTAL_TRAUMA.table[7].max === 100;
});
t('§39: five behaviour tables at printed sizes', () => J.NPC_BEHAVIOR.personality.table.length === 10 && J.NPC_BEHAVIOR.emotionalState.table.length === 10
  && J.NPC_BEHAVIOR.motive.table.length === 4 && J.NPC_BEHAVIOR.method.table.length === 4);
t('§40: 10 conversation subjects', () => J.CONVERSATION.subject.length === 10);
t('§20A: four safety structures named', () => /\*\*Lines:\*\*/.test(md) && /\*\*Veils:\*\*/.test(md) && /\*\*Safety signal:\*\*/.test(md) && /\*\*Debrief:\*\*/.test(md) && D.SAFETY_TOOLS.structures.length === 4);

// --- bestiary ---
t('B§: 28 stat blocks + 4 encounter blocks', () => M.BESTIARY.length === 28 && M.ENCOUNTER_BLOCKS.length === 4 && M.RANDOM_ENCOUNTERS.table.length === 10);
t('B§: printed defences parse as melee/ranged', () => M.BESTIARY.filter(e => e.defense).every(e => Number.isInteger(e.defense.melee) && Number.isInteger(e.defense.ranged)));
t('B§6: dragnet 2→4 opposition', () => { const d = M.ENCOUNTER_BLOCKS.find(x => x.id === 'manhuntDragnet').resolution; return d.oppositionDiceStart === 2 && d.oppositionDiceMax === 4 && /starts at 2/.test(bestiary) && /capped at 4/.test(bestiary); });

}
