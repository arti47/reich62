// Data-layer and engine invariants (CLAUDE.md §13.5).

import * as D from '../data.js';
import * as N from '../data-npcs.js';
import * as M from '../data-monsters.js';
import * as S from '../data-solo.js';
import * as R from '../src/rules.js';
import * as D2 from '../src/derived.js';
import { cancel, outcome, newTally } from '../src/core.js';

export async function dataChecks({ check, equal }) {
  // --- content inventory ---
  equal('26 skills', D.SKILLS.length, 26);
  equal('6 characteristics', D.CHARACTERISTICS.length, 6);
  equal('11 careers', D.CAREERS.length, 11);
  check('every career lists exactly 8 skills', D.CAREERS.every((c) => c.skills.length === 8));
  check('every career skill id resolves', D.CAREERS.every((c) => c.skills.every((s) => !!R.skill(s))));
  equal('27 item qualities', D.ITEM_QUALITIES.length, 27);
  equal('10 weapons', D.WEAPONS.length, 10);
  equal('6 armour entries', D.ARMOUR.length, 6);
  equal('17 vehicles', D.VEHICLES.length, 17);
  equal('7 difficulty levels', D.DIFFICULTIES.length, 7);
  equal('9 maneuvers', D.MANEUVERS.length, 9);
  equal('5 range bands', D.RANGE_BANDS.length, 5);
  equal('4 spend tables', Object.keys(D.SPEND_TABLES).length, 4);
  equal('29 Critical Injury rows', D.CRITICAL_INJURIES.length, 29);
  equal('7 manual adversary abilities', N.ADVERSARY_ABILITIES.filter((a) => a.source === 'manual').length, 7);
  equal('14 bestiary-only abilities', N.ADVERSARY_ABILITIES.filter((a) => a.source === 'bestiary').length, 14);

  // Critical Injury table is contiguous and ordered.
  let cursor = 0;
  let contiguous = true;
  D.CRITICAL_INJURIES.forEach((row) => { if (row.min !== cursor + 1) contiguous = false; cursor = row.max; });
  check('Critical Injury table has no gaps or overlaps', contiguous);

  // Every ability referenced by a stat block exists.
  const abilityIds = new Set(N.ADVERSARY_ABILITIES.map((a) => a.id));
  check('every bestiary ability reference resolves',
    M.BESTIARY.every((e) => (e.abilities || []).every((a) => abilityIds.has(a))));

  // --- dice engine invariants (§1) ---
  const resolved = cancel(newTally({ success: 3, failure: 1, advantage: 2, threat: 3, triumph: 1, despair: 1 }));
  equal('cancellation nets Success', resolved.success, 2);
  equal('cancellation nets Threat', resolved.threat, 1);
  equal('Triumph survives cancellation', resolved.triumph, 1);
  equal('Despair survives cancellation', resolved.despair, 1);
  check('a check with no net Success fails', outcome(newTally({ success: 1, failure: 1, triumph: 1 })).success === false);
  check('Triumph is true even on a failed check', outcome(newTally({ success: 0, failure: 1, triumph: 1 })).triumph === 1);

  // --- pool building (§2) ---
  equal('rank 2 with characteristic 3 gives 1 Ability die', R.buildPool(2, 3).ability, 1);
  equal('rank 2 with characteristic 3 gives 2 Proficiency dice', R.buildPool(2, 3).proficiency, 2);
  equal('unskilled gives no upgrades', R.buildPool(0, 3).proficiency, 0);
  equal('unskilled gives characteristic-many Ability dice', R.buildPool(0, 3).ability, 3);

  // --- opposed difficulty side (§3A) ---
  const opp = R.buildOpposedDifficulty(3, 2);
  equal('opposed: higher value sets the die count', opp.difficulty + opp.challenge, 3);
  equal('opposed: lower value sets the upgrades', opp.challenge, 2);

  // --- modification order (§2.4) ---
  // Upgrading before removing must consume the base die, not a die added later in the order.
  const pool = R.modifyPool({ ability: 2, difficulty: 2 }, [
    { stage: 'add', die: 'boost', count: 1 },
    { stage: 'upgrade', die: 'ability', count: 1 },
    { stage: 'remove', die: 'difficulty', count: 1 }
  ]);
  equal('modification order: one Ability upgraded to Proficiency', pool.proficiency, 1);
  equal('modification order: one Ability left', pool.ability, 1);
  equal('modification order: Boost added', pool.boost, 1);
  equal('modification order: one Difficulty removed', pool.difficulty, 1);
  equal('upgrading an empty pool adds the upgraded die',
    R.modifyPool({ ability: 0 }, [{ stage: 'upgrade', die: 'ability', count: 1 }]).proficiency, 1);

  // --- derived stats (§6, R-1) ---
  const pc = D2.blankCharacter();
  pc.attributes.brawn = 3;
  pc.attributes.willpower = 2;
  equal('wound threshold is base 8 plus Brawn', D2.woundThreshold(pc), 11);
  equal('strain threshold is base 10 plus Willpower', D2.strainThreshold(pc), 12);
  equal('soak is Brawn plus armour', D2.soak(pc), 3);
  equal('encumbrance threshold is 5 plus Brawn', D2.encumbranceThreshold(pc), 8);
  pc.talents = [{ id: 'toughened', ranks: 2 }, { id: 'grit', ranks: 1 }, { id: 'enduring', ranks: 1 }];
  equal('Toughened raises wound threshold by 2 per rank', D2.woundThreshold(pc), 15);
  equal('Grit raises strain threshold by 1 per rank', D2.strainThreshold(pc), 13);
  equal('Enduring raises soak by 1 per rank', D2.soak(pc), 4);

  // --- encumbrance is enforced, not warned (§5F) ---
  const loaded = D2.blankCharacter();
  loaded.attributes.brawn = 2;                       // threshold 7
  loaded.inventory.items = [{ id: 'x', encumbrance: 9, qty: 1 }];
  const enc = D2.encumbranceState(loaded);
  equal('encumbrance: 2 over threshold', enc.over, 2);
  equal('encumbrance: one Setback per point over', enc.setbackDice, 2);
  check('encumbrance: over by Brawn costs the free maneuver', enc.losesFreeManeuver === true);

  // --- Critical Injury modifier stacking (§5G, §9) ---
  const hurt = D2.blankCharacter();
  hurt.state.criticalInjuries = [{ roll: 20, healed: false }, { roll: 45, healed: false }, { roll: 60, healed: true }];
  equal('two untreated injuries add +20', D2.criticalModifier(hurt).plus, 20);

  // --- talent pyramid (§7, §12A) ---
  equal('a tier 1 talent is always legal', R.canBuyTalent('grit', {}).ok, true);
  equal('a tier 2 talent needs a tier 1 talent first', R.canBuyTalent('berserk', {}).ok, false);
  equal('a tier 2 talent is legal once a tier 1 is held', R.canBuyTalent('berserk', { grit: 1 }).ok, true);
  equal('a second tier 2 talent needs a second tier 1',
    R.canBuyTalent('dualWielder', { grit: 1, berserk: 1 }).ok, false);
  equal('a ranked purchase counts one tier up',
    R.talentTierCounts({ grit: 3 }).slice(0, 3).join(','), '1,1,1');
  equal('talents requiring a prerequisite are gated',
    R.canBuyTalent('parryImproved', { grit: 1, toughened: 1, durable: 1 }).ok, false);

  // --- XP costs (§7) ---
  equal('characteristic to rating 3 costs 30', R.xpCost('characteristic', { newRating: 3 }), 30);
  equal('career skill rank 2 costs 10', R.xpCost('skill', { newRank: 2, career: true }), 10);
  equal('non-career skill rank 2 costs 15', R.xpCost('skill', { newRank: 2, career: false }), 15);
  equal('a tier 4 talent costs 20', R.xpCost('talent', { tier: 4 }), 20);

  // --- rarity (§14A) ---
  equal('rarity 5 in a major city is Average', R.rarityDifficulty(5, [-1]).difficulty, 'average');
  equal('rarity 8 in a crackdown stays Formidable', R.rarityDifficulty(8, [3]).difficulty, 'formidable');
  equal('rarity above 10 upgrades once per point over', R.rarityDifficulty(8, [3]).upgrades, 1);

  // --- difficulty ladder (§3) ---
  equal('Average is 2 dice', R.difficultyDice('average'), 2);
  equal('stepping Average up once gives Hard', R.stepDifficulty('average', 1), 'hard');
  equal('stepping never reaches Impossible', R.stepDifficulty('formidable', 3), 'formidable');

  // --- normalisation never crashes on old data (CLAUDE.md §8) ---
  const old = D2.normalise({ identity: { name: 'Legacy' }, attributes: { brawn: 4 } });
  equal('normalisation back-fills skills', Object.keys(old.skills).length, 26);
  equal('normalisation keeps supplied values', old.attributes.brawn, 4);
  equal('normalisation back-fills state', old.state.personalHeat, 0);

  // --- Heat (§17) ---
  equal('Heat tracks run 0 to 5', D.HEAT.max, 5);
  equal('Despair in a surveilled context adds 1 Personal Heat',
    D.HEAT.generation.rules.find((r) => r.id === 'despair').personalHeat, 1);
  equal('Despair on an evasion check adds 2',
    D.HEAT.generation.rules.find((r) => r.id === 'despairEvasion').personalHeat, 2);
  equal('Triumph can remove 1 Heat',
    D.HEAT.generation.rules.find((r) => r.id === 'triumph').personalHeat, -1);
  equal('5 Heat threshold rows', D.HEAT.thresholds.length, 5);

  // --- lifecycle bundles (§21–§24) ---
  equal('6 lifecycle boundaries', D.LIFECYCLE.boundaries.length, 6);
  check('every boundary lists its effects', D.LIFECYCLE.boundaries.every((b) => b.effects.length > 0));

  // --- digital roller over the supplied face table (D§) ---
  const Roller = await import('../src/roller.js');
  const rolled = Roller.rollPool({ ability: 2, proficiency: 1, difficulty: 2, challenge: 1, boost: 1, setback: 1 });
  equal('a digital roll rolls one result per die', rolled.dice.length, 8);
  check('every rolled face comes from the supplied table',
    rolled.dice.every((d) => D.DIE_FACES[d.die][d.face - 1].join(',') === d.symbols.join(',')));
  check('the tally only ever contains real symbols',
    Object.entries(rolled.tally).every(([k, v]) => ['success', 'advantage', 'triumph', 'failure', 'threat', 'despair'].includes(k) && v >= 0));
  const proficiencyOnly = Roller.rollPool({ proficiency: 200 });
  check('200 Proficiency dice produce no negative symbols',
    proficiencyOnly.tally.failure === 0 && proficiencyOnly.tally.threat === 0 && proficiencyOnly.tally.despair === 0);
  const challengeOnly = Roller.rollPool({ challenge: 200 });
  check('200 Challenge dice produce no positive symbols',
    challengeOnly.tally.success === 0 && challengeOnly.tally.advantage === 0 && challengeOnly.tally.triumph === 0);

  // --- solo tables (§18–§20, §23) ---
  equal('3 Oracle likelihoods', S.ORACLE.likelihoods.length, 3);
  equal('Likely is 2 Ability against 1 Difficulty', `${S.ORACLE.likelihoods[0].ability}v${S.ORACLE.likelihoods[0].difficulty}`, '2v1');
  equal('50-50 is 2 against 2', `${S.ORACLE.likelihoods[1].ability}v${S.ORACLE.likelihoods[1].difficulty}`, '2v2');
  equal('Unlikely is 1 against 2', `${S.ORACLE.likelihoods[2].ability}v${S.ORACLE.likelihoods[2].difficulty}`, '1v2');
  check('the Oracle Despair row feeds Heat', S.ORACLE.interpretation.find((i) => i.id === 'noAnd').heatHook === true);
  equal('the solo loop hands raid timing to the Oracle at Heat 4', S.SOLO_LOOP.heatRule.fromLevel, 4);

  // --- the Dragnet extended check (B§6) ---
  const dragnet = R.encounterBlock('manhuntDragnet');
  equal('dragnet opposition starts at 2 dice', dragnet.resolution.oppositionDiceStart, 2);
  equal('dragnet opposition caps at 4 dice', dragnet.resolution.oppositionDiceMax, 4);
  check('dragnet advances both Heat tracks on a failed round', /Personal Heat and Cell Heat by 1/.test(dragnet.consequence));
}
