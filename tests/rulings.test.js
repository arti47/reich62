// Ruling pins — one assertion per confirmed ruling in CLAUDE.md §4.
// A later edit that drifts off a ruling fails here.

import * as D from '../data.js';
import * as N from '../data-npcs.js';
import * as M from '../data-monsters.js';
import * as S from '../data-solo.js';
import * as R from '../src/rules.js';

export async function pinChecks({ check, equal }) {
  // R-B1 — face data was supplied separately (D§), which is what unblocks the simulated
  // roller. Manual symbol entry stays the default input.
  check('R-B1: DIE_FACES is loaded', D.DIE_FACES !== null);
  equal('D§: Boost is a d6', D.DIE_FACES.boost.length, 6);
  equal('D§: Setback is a d6', D.DIE_FACES.setback.length, 6);
  equal('D§: Ability is a d8', D.DIE_FACES.ability.length, 8);
  equal('D§: Difficulty is a d8', D.DIE_FACES.difficulty.length, 8);
  equal('D§: Proficiency is a d12', D.DIE_FACES.proficiency.length, 12);
  equal('D§: Challenge is a d12', D.DIE_FACES.challenge.length, 12);
  equal('§1: Triumph appears only on the Proficiency die',
    Object.entries(D.DIE_FACES).filter(([, faces]) => faces.some((f) => f.includes('triumph'))).map(([k]) => k).join(','), 'proficiency');
  equal('§1: Despair appears only on the Challenge die',
    Object.entries(D.DIE_FACES).filter(([, faces]) => faces.some((f) => f.includes('despair'))).map(([k]) => k).join(','), 'challenge');
  equal('D§: exactly one Triumph face', D.DIE_FACES.proficiency.filter((f) => f.includes('triumph')).length, 1);
  equal('D§: exactly one Despair face', D.DIE_FACES.challenge.filter((f) => f.includes('despair')).length, 1);
  check('D§: every positive die shows only positive symbols',
    ['boost', 'ability', 'proficiency'].every((die) => D.DIE_FACES[die].every((f) => f.every((sym) => ['success', 'advantage', 'triumph'].includes(sym)))));
  check('D§: every negative die shows only negative symbols',
    ['setback', 'difficulty', 'challenge'].every((die) => D.DIE_FACES[die].every((f) => f.every((sym) => ['failure', 'threat', 'despair'].includes(sym)))));
  check('D§: the d6s have two blank faces each',
    ['boost', 'setback'].every((die) => D.DIE_FACES[die].filter((f) => f.length === 0).length === 2));
  check('D§: the d8s and d12s have one blank face each',
    ['ability', 'difficulty', 'proficiency', 'challenge'].every((die) => D.DIE_FACES[die].filter((f) => f.length === 0).length === 1));
  // R-20 — stored exactly as printed: the Triumph face carries no Success with it.
  equal('R-20: the Proficiency 12 face is Triumph alone', D.DIE_FACES.proficiency[11].join(','), 'triumph');
  equal('R-20: the Challenge 12 face is Despair alone', D.DIE_FACES.challenge[11].join(','), 'despair');

  // R-1 — base thresholds.
  equal('R-1: BASE_WOUND_THRESHOLD is 8', D.BASE_WOUND_THRESHOLD, 8);
  equal('R-1: BASE_STRAIN_THRESHOLD is 10', D.BASE_STRAIN_THRESHOLD, 10);

  // R-2 — Basic Military Training grants exactly three skills.
  const bmt = R.talent('basicMilitaryTraining');
  equal('R-2: Basic Military Training grants 3 career skills', bmt.grantsCareerSkills.join(','), 'athletics,ranged,resilience');

  // R-3 — competitive tie chain.
  equal('R-3: tie chain is success, advantage, triumph, simultaneous',
    D.CHECK_PROCEDURES.competitive.tieBreakers.join(','), 'success,advantage,triumph,simultaneous');

  // R-4 — the GM pool starts empty.
  equal('R-4: GM Story Point pool starts at 0', D.STORY_POINTS.startingGmPool, 0);
  equal('R-4: player pool starts at 1 per PC', D.STORY_POINTS.startingPlayerPoolPerPc, 1);

  // R-5 — characteristics start at 1.
  equal('R-5: characteristic floor is 1', D.CHARACTERISTIC_MIN, 1);

  // R-6 / R-7 — the two inferred conditions.
  const staggered = R.condition('staggered');
  const disoriented = R.condition('disoriented');
  check('R-6: staggered blocks actions', /cannot perform actions/i.test(staggered.effect));
  check('R-6: staggered leaves maneuvers alone', /maneuvers and incidentals are unaffected/i.test(staggered.effect));
  equal('R-7: disoriented adds exactly 1 Setback', disoriented.dice.setback, 1);
  check('R-6/R-7: both are flagged inferred', staggered.inferred === true && disoriented.inferred === true);

  // R-8 — house-aid gear budget.
  equal('R-8: currency label default', D.CREATION_RULES.houseAid.currencyLabel, 'credits');
  equal('R-8: starting budget default', D.CREATION_RULES.houseAid.startingBudget, 500);

  // R-9 — the week-rest extra heal fires on Triumph, never Despair.
  const weekRest = D.RECOVERY.methods.find((m) => m.id === 'weekRest');
  equal('R-9: extra Critical heal triggers on Triumph', weekRest.bonusSymbol, 'triumph');
  check('R-9: no Despair path on week rest', !/despair/i.test(weekRest.bonus));

  // R-10 — every solo and quick-gen table is a d10.
  equal('R-10: NPC quick-gen uses a d10', N.NPC_QUICKGEN.die, 'd10');
  equal('R-10: random encounter table uses a d10', M.RANDOM_ENCOUNTERS.die, 'd10');
  equal('R-10: random encounter table has 10 rows', M.RANDOM_ENCOUNTERS.table.length, 10);
  ['desire', 'fear', 'strength', 'flaw'].forEach((k) =>
    equal(`R-10: motivation ${k} table has 10 entries`, D.MOTIVATIONS[k].length, 10));
  equal('R-10: meaning tables are d10', S.MEANING.die, 'd10');
  equal('R-10: the action table has 10 entries', S.MEANING.action.length, 10);
  equal('R-10: the subject table has 10 entries', S.MEANING.subject.length, 10);
  ['location', 'faction', 'complication'].forEach((k) =>
    equal(`R-10: the ${k} element table has 10 entries`, S.ELEMENTS[k].length, 10));
  equal('R-10: random event tables are d10', S.RANDOM_EVENT.die, 'd10');
  check('R-10: the random event category table covers 1–10',
    S.RANDOM_EVENT.category[0].min === 1 && S.RANDOM_EVENT.category[S.RANDOM_EVENT.category.length - 1].max === 10);

  // R-11 — 12 of 71 talents are non-setting and hidden by default.
  equal('R-11: 71 talents total', D.TALENTS.length, 71);
  equal('R-11: 12 talents are non-setting', D.TALENTS.filter((t) => !t.settingApplicable).length, 12);
  equal('R-11: hidden by default', R.visibleTalents(false).length, 59);
  equal('R-11: revealed when the toggle is on', R.visibleTalents(true).length, 71);

  // R-12 — one Triumph satisfies any spend-table row.
  const combatRows = D.SPEND_TABLES.combat.positive;
  check('R-12: every Advantage row can also be bought with a Triumph',
    combatRows.filter((r) => r.cost > 0).every((r) => r.triumph === true));

  // R-13 — 17 gear entries.
  equal('R-13: gear list has 17 entries', D.GEAR.length, 17);

  // R-14 — Critical Injury lookup indexes roll + modifiers past 100.
  equal('R-14: 95 + 10 per untreated injury lands past 100',
    R.criticalInjuryFor(R.criticalInjuryTotal({ roll: 95, untreatedInjuries: 1 })).name, 'Maimed');
  equal('R-14: a long fall pushes into the death band',
    R.criticalInjuryFor(R.criticalInjuryTotal({ roll: 95, fall: 'long' })).name, 'The End Is Nigh');
  equal('R-14: Durable floors the result at 01',
    R.criticalInjuryTotal({ roll: 5, durable: 2 }), 1);
  equal('R-14: 151+ is terminal', R.criticalInjuryFor(200).death, 'dead');

  // R-15 — printed stats load verbatim and never derive.
  check('R-15: every bestiary entry is marked printed',
    M.BESTIARY.every((e) => e.derivedFrom === 'printed' && e.sourceBook === 'bestiary'));
  const horse = M.ANIMALS.find((a) => a.id === 'patrolHorse');
  equal('R-15: Patrol Horse keeps its printed Soak 3 despite Brawn 4', horse.soak, 3);
  const voss = M.NEMESES.find((n) => n.id === 'hartmannVoss');
  check('R-15: nemesis thresholds are not the PC formula',
    voss.woundThreshold !== D.BASE_WOUND_THRESHOLD + voss.characteristics.brawn);

  // R-16 — the Guard Dog defaults to minion tier and is promotable.
  const dog = M.ANIMALS.find((a) => a.id === 'guardDog');
  equal('R-16: Guard Dog defaults to minion tier', dog.tier, 'minion');
  equal('R-16: Guard Dog is promotable to Rival', dog.promotable, true);

  // R-17 — Defence parses as melee/ranged.
  const enforcer = M.RIVALS.find((r) => r.id === 'blackMarketEnforcer');
  equal('R-17: Defence 0/1 reads melee 0', enforcer.defense.melee, 0);
  equal('R-17: Defence 0/1 reads ranged 1', enforcer.defense.ranged, 1);
  equal('R-17: notation recorded in the conventions', N.BESTIARY_CONVENTIONS.defenseNotation, 'melee/ranged');

  // R-18 — group Wound Threshold is per-member times count.
  equal('R-18: 4 per member across 3 members is 12', R.minionGroupWoundThreshold(4, 3), 12);
  equal('R-18: resizing to 5 members recomputes to 20', R.minionGroupWoundThreshold(4, 5), 20);
  equal('R-18: group skill ranks are members minus one', R.minionGroupSkillRanks(4), 3);

  // R-19 — Disciplined and Hardened stay distinct.
  const disciplined = R.adversaryAbility('disciplined');
  const hardened = R.adversaryAbility('hardened');
  check('R-19: Disciplined and Hardened are separate entries', !!disciplined && !!hardened && disciplined.id !== hardened.id);
  equal('R-19: Disciplined covers Disorient only', disciplined.immunities.join(','), 'disoriented');
  equal('R-19: Hardened covers Disorient and Stagger', hardened.immunities.join(','), 'disoriented,staggered');

  // Compendium inventory (CLAUDE.md §13.5).
  equal('bestiary: 10 minion groups', M.MINION_GROUPS.length, 10);
  equal('bestiary: 12 rivals', M.RIVALS.length, 12);
  equal('bestiary: 4 nemeses', M.NEMESES.length, 4);
  equal('bestiary: 2 animals', M.ANIMALS.length, 2);
  equal('bestiary: 4 encounter blocks', M.ENCOUNTER_BLOCKS.length, 4);
  equal('bestiary: 28 published stat blocks', M.BESTIARY.length, 28);
}
