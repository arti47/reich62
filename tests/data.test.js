// Data-layer and engine invariants (CLAUDE.md §13.5).

import * as D from '../data.js';
import * as N from '../data-npcs.js';
import * as M from '../data-monsters.js';
import * as J from '../data-journey.js';
import * as P from '../data-pregens.js';
import * as S from '../data-solo.js';
import * as R from '../src/rules.js';
import * as D2 from '../src/derived.js';
import { cancel, outcome, newTally } from '../src/core.js';
import * as H from '../src/heat.js';
import * as UI from '../src/ui.js';
import * as RI from '../src/rules-index.js';

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
  // §17 — one shared track is the printed default; §17.5 keeps the two-track variant.
  check('suspicion is one shared track by default', D.HEAT.shared === true);
  check('the two-track version is kept as the printed optional variant',
    D.HEAT.split.optional === true && D.HEAT.split.thresholds.length === 5);
  equal('Despair in a surveilled context adds 1 Personal Heat',
    D.HEAT.generation.rules.find((r) => r.id === 'despair').heat, 1);
  equal('Despair on an evasion check adds 2',
    D.HEAT.generation.rules.find((r) => r.id === 'despairEvasion').heat, 2);
  equal('Triumph can remove 1 Heat',
    D.HEAT.generation.rules.find((r) => r.id === 'triumph').heat, -1);
  equal('5 Heat threshold rows', D.HEAT.thresholds.length, 5);

  // --- lifecycle bundles (§21–§24) ---
  // Six core boundaries plus §34's Shift, which only exists inside the optional module.
  equal('6 core lifecycle boundaries', D.LIFECYCLE.boundaries.filter((b) => !b.optionalModule).length, 6);
  equal('plus the optional Shift from the journey module',
    D.LIFECYCLE.boundaries.filter((b) => b.optionalModule === 'journey').length, 1);
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

  // --- situational dice, upgrades and spends (§5E, §5J, §2.4, §5C) ---
  const R2 = await import('../src/roller.js');
  const C = await import('../src/combat.js');
  const base = { ...R2.state };
  Object.assign(R2.state, {
    skillId: 'stealth', difficultyId: 'average', opposed: false, surveilled: false,
    publicCheck: false, concealment: 2, concealmentRole: 'hiding', cover: true,
    silhouetteDelta: 0, upgradeAbility: 0, upgradeDifficulty: 0, downgradeAbility: 0, downgradeDifficulty: 0,
    autoDice: { conditions: true, encumbrance: true, heat: true }
  });
  const conc = R2.assemblePool(null);
  equal('§5E: concealment adds Boost dice to the hiding character', conc.pool.boost, 3); // 2 concealment + 1 cover
  Object.assign(R2.state, { concealmentRole: 'observing', cover: false });
  const obs = R2.assemblePool(null);
  equal('§5E: concealment adds Setback against a concealed target', obs.pool.setback, 2);
  Object.assign(R2.state, { concealment: 0, concealmentRole: 'none', silhouetteDelta: 2 });
  equal('§5J: a target 2 silhouettes larger is one difficulty easier', R2.assemblePool(null).pool.difficulty, 1);
  Object.assign(R2.state, { silhouetteDelta: -2 });
  equal('§5J: a target 2 silhouettes smaller is one difficulty harder', R2.assemblePool(null).pool.difficulty, 3);
  Object.assign(R2.state, { silhouetteDelta: 0, upgradeDifficulty: 1 });
  const upgraded = R2.assemblePool(null);
  equal('§2.4: upgrading a Difficulty die yields a Challenge', upgraded.pool.challenge, 1);
  equal('§2.4: the upgraded Difficulty die is consumed', upgraded.pool.difficulty, 1);
  Object.assign(R2.state, base);

  // Audit A-2: the Adversary talent upgrades checks against that NPC (§12C).
  Object.assign(R2.state, { targetAdversary: 2, difficultyId: 'average' });
  const adversaryPool = R2.assemblePool(null);
  equal('§12C: Adversary 2 upgrades the difficulty twice', adversaryPool.pool.challenge, 2);
  equal('§12C: the upgraded Difficulty dice are consumed', adversaryPool.pool.difficulty, 0);
  Object.assign(R2.state, { targetAdversary: 0 });

  // Audit A-1: a Triumph can be spent to reduce Personal Heat (§17.1).
  const H = await import('../src/heat.js');
  equal('§17.1: a Triumph spent on Heat reduces it by 1',
    H.heatFromCheck({ triumph: 1, surveilled: true, spendTriumphOnHeat: true }).personalHeat, -1);
  equal('§17.1: an unspent Triumph changes nothing',
    H.heatFromCheck({ triumph: 1, surveilled: true, spendTriumphOnHeat: false }).personalHeat, 0);
  equal('§17.1: Despair on an evasion check is +2',
    H.heatFromCheck({ despair: 1, surveilled: true, skillId: 'deception' }).personalHeat, 2);
  equal('§17.1: outside a surveilled context nothing is generated',
    H.heatFromCheck({ despair: 1, surveilled: false, skillId: 'deception' }).personalHeat, 0);

  // --- vehicle scale (§12) ---
  C.addVehicle('motorcycle');
  const combatState = (await import('../src/store.js')).getCombat();
  const vehicleId = Object.keys(combatState.vehicles)[0];
  C.changeSpeed(vehicleId, 3);
  const crashed = C.crashVehicle(vehicleId);
  equal('§12: a crash inflicts hull trauma equal to current speed', crashed.trauma, 3);
  equal('§12: the trauma lands on the hull', crashed.vehicle.hullTrauma, 3);
  const capped = C.changeSpeed(vehicleId, 99);
  equal('§12: speed is capped at the vehicle maximum', capped.speed, 5);
  C.removeVehicle(vehicleId);

  // --- recipe-built NPCs derive and stay distinguishable from printed blocks (R-15) ---
  const recipe = C.addRecipeNpc({ name: 'Test Rival', tier: 'rival', characteristics: { brawn: 3, willpower: 2 } });
  equal('R-15: a recipe NPC is marked as derived, not printed', recipe.combatant.derivedFrom, 'recipe');
  equal('R-15: a recipe rival derives soak from Brawn', recipe.combatant.soak, 3);
  C.removeCombatant(recipe.combatant.id);

  // --- HOUSE RULE: black-market purchasing (not from either book) ---
  check('the black-market rule is flagged as a house rule', D.BLACK_MARKET.houseRule === true);
  equal('barter starts at rarity 6', D.BLACK_MARKET.barterFromRarity, 6);
  equal('rarity 7 wants 2 ration cards', D.BLACK_MARKET.rationCardsFor(7), 2);
  equal('rarity 6 wants 1 ration card', D.BLACK_MARKET.rationCardsFor(6), 1);
  equal('rarity 5 wants none', D.BLACK_MARKET.rationCardsFor(5), 0);
  equal('rarity 10 wants 5', D.BLACK_MARKET.rationCardsFor(10), 5);
  equal('it routes through Streetwise', D.BLACK_MARKET.skill, 'streetwise');

  const flush = R.blackMarketPurchase({ rarity: 7, rationCards: 2, barterGoods: 0 });
  equal('rarity 7 with the cards keeps the printed difficulty', flush.difficulty, 'hard');
  equal('and pays in cards', flush.payingWithCards, true);
  const broke = R.blackMarketPurchase({ rarity: 7, rationCards: 0, barterGoods: 0 });
  equal('nothing to trade makes it one step harder', broke.difficulty, 'daunting');
  equal('and says how short you are', broke.cardsShort, 2);
  const bartering = R.blackMarketPurchase({ rarity: 7, rationCards: 0, barterGoods: 1 });
  equal('a barter good covers the demand', bartering.difficulty, 'hard');
  equal('and is recorded as goods rather than cards', bartering.payingWithGoods, true);
  const cheap = R.blackMarketPurchase({ rarity: 4, rationCards: 0, barterGoods: 0 });
  equal('below rarity 6 nothing extra is demanded', cheap.cardsRequired, 0);
  equal('and the difficulty is untouched', cheap.difficulty, 'average');
  equal('location modifiers still apply', R.blackMarketPurchase({ rarity: 6, modifierValues: [3], rationCards: 1 }).difficulty, 'daunting');

  // A bad failure at the black market exposes you the way any public dealing does.
  const H2 = await import('../src/heat.js');
  equal('three threat on a failed deal raises suspicion',
    H2.heatFromCheck({ blackMarket: true, failed: true, threat: 3, skillId: 'streetwise' }).personalHeat, 1);
  equal('two threat does not',
    H2.heatFromCheck({ blackMarket: true, failed: true, threat: 2, skillId: 'streetwise' }).personalHeat, 0);
  equal('a successful deal with three threat does not',
    H2.heatFromCheck({ blackMarket: true, failed: false, threat: 3, skillId: 'streetwise' }).personalHeat, 0);
  equal('a despair on a black-market Streetwise check counts as an evasion check',
    H2.heatFromCheck({ blackMarket: true, failed: true, despair: 1, skillId: 'streetwise' }).personalHeat, 2);

  // The three purses are separate and survive normalisation.
  const buyer = D2.normalise({ inventory: { money: { amount: 120 } } });
  equal('cash carries through normalisation', buyer.inventory.money.amount, 120);
  equal('ration cards are back-filled', buyer.inventory.money.rationCards, 0);
  equal('barter goods are back-filled', buyer.inventory.money.barterGoods, 0);

  // --- single source of truth (CLAUDE.md §13.2): the modules read these, never restate them ---
  equal('a Critical Injury costs a minion group its share plus one',
    N.ADVERSARY_TIERS.find((t) => t.id === 'minion').criticalWoundCost(4), 5);
  equal('the same value comes back through the rules layer', R.minionCriticalWoundCost(4), 5);
  check('the silhouette rule carries its own thresholds and directions',
    D.SILHOUETTE_RULE.largerTarget.differenceAtLeast === 2
    && D.SILHOUETTE_RULE.largerTarget.difficultySteps === -1
    && D.SILHOUETTE_RULE.smallerTarget.differenceAtLeast === 2
    && D.SILHOUETTE_RULE.smallerTarget.difficultySteps === 1);
  check('every shared Heat threshold names an effect, and only level 1 carries dice',
    D.HEAT.thresholds.every((t) => typeof t.effect === 'string' && t.effect.length > 0)
    && D.HEAT.thresholds[0].dice.setback === 1
    && D.HEAT.thresholds.filter((t) => t.dice).length === 1);
  check('the split variant still declares its personal and cell dice explicitly',
    D.HEAT.split.thresholds.every((t) => 'personalEffect' in t || 'cell' in t)
    && D.HEAT.split.thresholds[0].cellEffect === null);
  equal('the cell escalates from a member at Personal Heat 3', D.HEAT.split.cellEscalationAtPersonal, 3);
  // Shared mode reads the one column; the level-1 Setback comes off the shared track.
  equal('suspicion dice come off the threshold table, not a restated level',
    H.heatSetbackDice({ cellHeat: 1 }), 1);
  equal('a private check takes no suspicion dice',
    H.heatSetbackDice({ cellHeat: 5, isPublicCheck: false }), 0);
  equal('suspicion below level 1 adds nothing', H.heatSetbackDice({ cellHeat: 0 }), 0);
  equal('safehouse status is read off the thresholds: clear', H.safehouseFor(0), 'clear');
  equal('safehouse status is read off the thresholds: watched', H.safehouseFor(3), 'watched');
  equal('safehouse status is read off the thresholds: blown', H.safehouseFor(5), 'blown');
  check('the symbol glyphs and names in the UI layer come from the data table',
    D.SYMBOLS.every((sym) => UI.SYMBOL_GLYPHS[sym.id] === sym.glyph && UI.SYMBOL_NAMES[sym.id] === sym.name));

  // --- Medicine difficulty ladder (§5G) ---
  const medEasy = R.medicineDifficulty({ wounds: 4, woundThreshold: 10 });
  equal('treating light wounds is Easy', medEasy.difficulty, 'easy');
  equal('past half the threshold it is Average', R.medicineDifficulty({ wounds: 6, woundThreshold: 10 }).difficulty, 'average');
  equal('past the threshold itself it is Hard', R.medicineDifficulty({ wounds: 12, woundThreshold: 10 }).difficulty, 'hard');
  equal('treating yourself adds two steps',
    R.medicineDifficulty({ wounds: 4, woundThreshold: 10, selfTreatment: true }).difficulty, 'hard');
  equal('no medical kit adds one more',
    R.medicineDifficulty({ wounds: 4, woundThreshold: 10, selfTreatment: true, noEquipment: true }).difficulty, 'daunting');
  equal('both modifiers are named back to the player',
    R.medicineDifficulty({ wounds: 4, woundThreshold: 10, selfTreatment: true, noEquipment: true }).applied.length, 2);

  // --- falls (§5I): mitigation first, then soak, and strain is never soaked ---
  const shortFall = R.fallDamage({ band: 'short', soak: 3, successes: 0, advantages: 0 });
  equal('a short fall starts at 10 wounds', shortFall.rawWounds, 10);
  equal('soak comes off the wounds', shortFall.wounds, 7);
  equal('strain is not reduced by soak', shortFall.strain, 10);
  equal('each success on the mitigation check saves a wound',
    R.fallDamage({ band: 'short', soak: 3, successes: 2 }).wounds, 5);
  equal('each advantage saves a point of strain',
    R.fallDamage({ band: 'short', soak: 3, advantages: 4 }).strain, 6);
  equal('a long fall uses the threshold formula',
    R.fallDamage({ band: 'long', woundThreshold: 12, soak: 0 }).rawWounds, 13);
  equal('a long fall carries its Critical Injury modifier',
    R.fallDamage({ band: 'long', woundThreshold: 12 }).criticalModifier, 50);
  equal('an extreme fall carries the larger one',
    R.fallDamage({ band: 'extreme', woundThreshold: 12 }).criticalModifier, 75);

  // --- called shots and two-weapon fighting carry structured data, not just prose ---
  equal('aiming twice halves the called-shot penalty',
    D.CALLED_SHOTS.setbackByAim.find((a) => a.aimManeuvers === 2).setback, 1);
  equal('a called shot costs three advantage to pay off', D.CALLED_SHOTS.payoffAdvantageCost, 3);
  equal('two-weapon fighting raises the difficulty one step', D.COMBAT_VARIANTS.twoWeapon.extraDifficultySteps, 1);
  equal('the off-hand hit costs two advantage', D.COMBAT_VARIANTS.twoWeapon.secondaryHit.advantage, 2);
  equal('four group-influence bands', D.SOCIAL_ENCOUNTERS.groupInfluenceLadder.length, 4);

  // --- every extracted table reaches the rules library ---
  const library = RI.buildIndex();
  const hasEntry = (re) => library.some((e) => re.test(e.title));
  check('movement costs are in the library', hasEntry(/^Moving from /));
  check('the falling mitigation rule is in the library', hasEntry(/^Falling: soak/));
  check('the character-sheet field reference is in the library', hasEntry(/^On the character sheet: /));
  check('the weapon Heat note is in the library', hasEntry(/^Carrying a weapon$/));
  check('the vehicle Heat note is in the library', hasEntry(/^Owning a vehicle$/));
  check('no library entry leaks a section marker',
    library.every((e) => !/(?:B?§|D§)[0-9]/.test(`${e.title} ${e.body}`)),
    (library.find((e) => /(?:B?§|D§)[0-9]/.test(`${e.title} ${e.body}`)) || {}).title);

  // --- the attack chain (§5B): weapon, range, damage ---
  equal('melee is always an Average check whatever the range',
    R.attackDifficulty(R.weapon('knife'), 'extreme'), 'average');
  equal('a shot at short range is Easy', R.attackDifficulty(R.weapon('p38'), 'short'), 'easy');
  equal('the same shot at medium is Average', R.attackDifficulty(R.weapon('p38'), 'medium'), 'average');
  equal('at long range it is Hard', R.attackDifficulty(R.weapon('p38'), 'long'), 'hard');
  equal('at extreme range it is Daunting', R.attackDifficulty(R.weapon('p38'), 'extreme'), 'daunting');
  equal('a plain firearm deals its printed damage', R.weaponBaseDamage(R.weapon('p38'), 3), 6);
  equal('a knife adds Brawn to its rating', R.weaponBaseDamage(R.weapon('knife'), 3), 5);
  equal('unarmed damage is Brawn itself', R.weaponBaseDamage(R.weapon('unarmed'), 3), 3);
  equal('Pierce is read off the weapon qualities', R.weaponPierce(R.weapon('knife')), 1);
  equal('a weapon without Pierce reads zero', R.weaponPierce(R.weapon('p38')), 0);

  // --- story point spends: all four on each side, and the two-pool flow ---
  equal('four player spends', D.STORY_POINTS.playerSpends.length, 4);
  equal('four GM spends', D.STORY_POINTS.gmSpends.length, 4);

  // --- the conditions a GM can hold an NPC in ---
  check('the NPC condition list drops the ones that are the character\'s own bookkeeping',
    D.CONDITIONS.filter((c) => !c.id.startsWith('heat') && !['encumbered', 'incapacitated'].includes(c.id)).length >= 5);

  // --- talents whose printed text names an exact change to your own pool (A-22) ---
  const rollerTalents = D.TALENTS.filter((t) => t.roller);
  check('nine talents carry a roller effect', rollerTalents.length === 9, String(rollerTalents.length));
  check('every roller effect names what it does', rollerTalents.every((t) => !!t.roller.note));
  equal('Quick Strike adds a Boost per rank', D.TALENTS.find((t) => t.id === 'quickStrike').roller.dice.boost, 'ranks');
  equal('Knack For It removes two Setback', D.TALENTS.find((t) => t.id === 'knackForIt').roller.dice.setback, -2);
  equal('Master lowers the difficulty by two', D.TALENTS.find((t) => t.id === 'master').roller.difficultySteps, -2);
  equal('Rapid Reaction adds Success symbols', D.TALENTS.find((t) => t.id === 'rapidReaction').roller.enteredSymbols.success, 'ranks');
  check('Natural clears the entry for its reroll', D.TALENTS.find((t) => t.id === 'natural').roller.clearEntry === true);

  // --- the four encounter blocks all carry what a check needs (A-19) ---
  M.ENCOUNTER_BLOCKS.forEach((block) => {
    check(`${block.id} names an active skill and an opposing one`,
      (block.resolution.activeSkills || []).length > 0 && !!block.resolution.opposingSkill);
    check(`${block.id}'s skills all resolve`,
      block.resolution.activeSkills.every((sk) => !!R.skill(sk)) && !!R.skill(block.resolution.opposingSkill));
  });

  // --- the social spend table prices the Motivation reveal ladder (A-24) ---
  const socialPositive = D.SPEND_TABLES.social.positive;
  check('two advantage buys a strength or flaw',
    socialPositive.some((r) => r.cost === 2 && r.effects.some((e) => /Strength or Flaw/i.test(e))));
  check('three advantage buys a desire or fear',
    socialPositive.some((r) => r.cost === 3 && r.effects.some((e) => /Desire or Fear/i.test(e))));

  // --- the Oracle asks for a real pool (A-21) ---
  const pool5050 = S.ORACLE.likelihoods[1];
  equal('the 50-50 pool is 2 Ability against 2 Difficulty', `${pool5050.ability}v${pool5050.difficulty}`, '2v2');

  // --- the suspicion trail and the revealed facets back-fill on old characters ---
  const oldSave = D2.normalise({ state: { personalHeat: 3 }, identity: { name: 'Old Save' } });
  check('the suspicion trail back-fills', Array.isArray(oldSave.state.heatTrail));
  check('the revealed facets back-fill',
    oldSave.identity.motivationRevealed && oldSave.identity.motivationRevealed.desire === false);

  // --- the XP engine at creation: no path may leave experience and ranks out of step ---
  equal('every character gets the same 70', D.XP_COSTS.startingXp, 70);
  equal('a characteristic to 5 costs 10 times the new rating', D.XP_COSTS.characteristic.cost(5), 50);
  equal('raising one from 1 to 5 costs 140 in total',
    [2, 3, 4, 5].reduce((sum, n) => sum + D.XP_COSTS.characteristic.cost(n), 0), 140);
  equal('a career skill to rank 2 costs 10', D.XP_COSTS.careerSkill.cost(2), 10);
  equal('a non-career skill to rank 2 costs 15', D.XP_COSTS.nonCareerSkill.cost(2), 15);
  check('talents cost five times their tier',
    [1, 2, 3, 4, 5].every((t) => D.XP_COSTS.talent.cost(t) === t * 5));
  equal('four career skills are picked at creation', D.CREATION_RULES.careerSkillPicks, 4);

  // The pyramid check over a whole held set, which is what a refund can break.
  check('one talent in each of tiers 1 and 2 is legal', R.pyramidLegal({ grit: 1, basicMilitaryTraining: 1 }).ok);
  check('a tier 2 talent with nothing in tier 1 is not',
    R.pyramidLegal({ basicMilitaryTraining: 1 }).ok === false);
  equal('and the reason names the tier to refund first',
    R.pyramidLegal({ basicMilitaryTraining: 1 }).tier, 2);
  // A ranked talent bought N times spreads one purchase per tier, which is always a legal
  // pyramid on its own; stacking a second tier 2 on top of it is not.
  check('two ranks of a tier 1 talent spread one per tier and stay legal', R.pyramidLegal({ grit: 2 }).ok);
  check('a second tier 2 talent on top of that breaks it',
    R.pyramidLegal({ grit: 2, basicMilitaryTraining: 1 }).ok === false);

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

  // --- §8 Push ---
  equal('a push costs one story point', D.STORY_POINTS.push.cost, 1);
  check('a check can only be pushed once', D.STORY_POINTS.push.oncePerCheck === true);
  check('a push rerolls the entire pool', /entire pool/.test(D.STORY_POINTS.push.rerolls));
  equal('the push price offers three ways to pay', D.STORY_POINTS.push.priceOptions.length, 3);
  check('only the suspicion price needs a surveilled context',
    D.STORY_POINTS.push.priceOptions.filter((o) => o.requiresSurveilled).map((o) => o.id).join() === 'heat');
  check('triumph and despair on the reroll are read fresh', /read fresh/.test(D.STORY_POINTS.push.freshSymbols));

  // --- §13 step 6, the Kicker ---
  check('creation has a kicker step', D.CREATION_STEPS.some((st) => st.id === 'kicker'));
  check('the kicker is explicitly not a mechanic', D.CREATION_RULES.kicker.mechanical === false);
  check('every pregen carries its printed kicker',
    P.PREGENS.every((pg) => typeof pg.kicker === 'string' && pg.kicker.length > 20));

  // --- §16A, one shared suspicion row ---
  const reich = D.SHEET_FIELDS.groups.find((g) => g.id === 'reich62');
  check('the sheet reference lists one shared suspicion track, not two',
    reich.fields.some((f) => /shared by the party/.test(f))
    && !reich.fields.some((f) => /Personal Heat/.test(f)));

  // --- PART V (§31, §33–§40): the optional journey and tension module ---
  equal('tension runs 0 to 2', `${J.TENSION.min}-${J.TENSION.max}`, '0-2');
  check('tension is directional', J.TENSION.directional === true);
  equal('tension has a level for every rating', J.TENSION.levels.length, 3);
  check('tension adds a Boost per point in an opposed check',
    J.TENSION.effect.dice === 'boost' && J.TENSION.effect.perPoint === 1);
  equal('releasing tension gives each side 2 strain back', J.TENSION.reduceStrainRecovery, 2);

  equal('the personal threat countdown has 3 steps', J.PERSONAL_THREAT.steps, 3);
  equal('and a rung for each', J.PERSONAL_THREAT.ladder.length, 3);
  check('only step 2 carries dice, and it is one Setback',
    J.PERSONAL_THREAT.ladder.filter((r) => r.dice).length === 1
    && J.PERSONAL_THREAT.ladder.find((r) => r.step === 2).dice.setback === 1);

  equal('the journey adds a third time unit, the Shift', J.JOURNEY.timeUnits.length, 3);
  check('the Shift sits between a scene and a session',
    J.JOURNEY.timeUnits.map((u) => u.id).join() === 'round,scene,shift');
  equal('4 journey lengths', J.JOURNEY.lengths.length, 4);
  equal('the stop countdown is a d10 of 10 rows', J.JOURNEY.stopCountdown.table.length, 10);
  check('the blocker points at the two published encounter blocks by their bestiary citation',
    J.JOURNEY.blocker.blocksCite === 'B§6'
    && J.JOURNEY.blocker.publishedBlocks.every((id) => !!R.encounterBlock(id)));

  const d10 = (t) => t.length === 10 && t.every((r, i) => r.roll === i + 1);
  check('travel encounters are a d10 of 10 rows', d10(J.TRAVEL_ENCOUNTERS.table));
  check('the travel table deploys the published checkpoint block on a 10',
    !!R.encounterBlock(J.TRAVEL_ENCOUNTERS.table[9].deploys));
  check('vehicle traits are a d10 of 10 rows', d10(J.VEHICLE_TRAITS.table));
  check('component damage is a d10 of 10 rows', d10(J.VEHICLE_COMPONENT_DAMAGE.table));
  check('NPC personality and mood are d10 tables',
    d10(J.NPC_BEHAVIOR.personality.table) && d10(J.NPC_BEHAVIOR.emotionalState.table));
  check('motive and method are d4 tables',
    J.NPC_BEHAVIOR.motive.table.length === 4 && J.NPC_BEHAVIOR.method.table.length === 4);
  check('conversation subjects are a d10 of 10 rows', d10(J.CONVERSATION.subject));

  const trauma = J.MENTAL_TRAUMA.table;
  equal('mental trauma has 8 bands', trauma.length, 8);
  check('the trauma bands cover 1 to 100 with no gap and no overlap',
    trauma[0].min === 1 && trauma[trauma.length - 1].max === 100
    && trauma.every((row, i) => i === 0 || row.min === trauma[i - 1].max + 1));
  check('trauma is addressed narratively, with no dice cure', /no fixed dice-check|no dice-check cure/i.test(J.MENTAL_TRAUMA.addressing));

  // Every Part V table reaches the rules library, so none of it is extracted-but-unreachable.
  const journeyCites = RI.buildIndex().map((e) => e.cite);
  ['§31', '§33', '§34', '§35', '§36', '§37', '§38', '§39', '§40'].forEach((cite) => {
    check(`the rules library carries ${cite}`, journeyCites.includes(cite));
  });
  check('and files Part V under its own section',
    RI.sectionFor('§35') === 'journey' && RI.sectionFor('§31') === 'journey');
  // The catch-all that used to swallow everything past Suspicion.
  check('bestiary citations file under Opponents, and running-the-game under its own',
    RI.sectionFor('B§3') === 'opponents' && RI.sectionFor('§23') === 'running');
}
