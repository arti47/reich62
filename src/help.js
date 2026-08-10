// help.js — plain-language layer.
// The interface leads with everyday wording and shows the book's term second, and every
// panel says what it is for. Rules values never live here; this is copy only, and each
// entry names the section it paraphrases so the wording can be checked against the source.

/** Plain-language label with the rulebook term in tow. */
export const TERMS = {
  wounds:        { plain: 'Injury',            term: 'Wounds',        cite: '§6',  gloss: 'Physical harm. At or past your limit you are out of the fight.' },
  strain:        { plain: 'Stress',            term: 'Strain',        cite: '§6',  gloss: 'Fatigue and rattled nerves. It also pays for extra effort, and a night\'s sleep clears all of it.' },
  soak:          { plain: 'Damage resisted',   term: 'Soak',          cite: '§6',  gloss: 'Subtracted from every hit before it becomes injury.' },
  meleeDefense:  { plain: 'Close defence',     term: 'Melee Defence', cite: '§6',  gloss: 'Makes attacks at arm\'s length harder to land on you.' },
  rangedDefense: { plain: 'Ranged defence',    term: 'Ranged Defence', cite: '§6', gloss: 'Makes shots at you harder to land.' },
  encumbrance:   { plain: 'Carrying load',     term: 'Encumbrance',   cite: '§5F', gloss: 'Past your limit, physical actions get harder; far past it you lose your free move.' },
  personalHeat:  { plain: 'Suspicion',        term: 'Heat',          cite: '§17', gloss: 'How closely the regime is watching the party, 0 to 5. One shared score: it climbs on a disaster in public and falls during quiet weeks. A setting splits it back into one score each plus a shared one.' },
  cellHeat:      { plain: 'Suspicion on the network', term: 'Cell Heat', cite: '§17.5', gloss: 'The shared score in the optional two-track version. It rises when any member gets too hot.' },
  tension:       { plain: 'Tension',           term: 'Tension',       cite: '§31', gloss: 'Friction between two characters, 0 to 2, where suspicion is pressure from outside. The higher side adds a bonus die in an opposed check between them.' },
  kicker:        { plain: 'Kicker',            term: 'Kicker',        cite: '§13', gloss: 'One sentence naming what forced this character onto the path they are on. Not a mechanic — the thing the GM calls back to.' },
  push:          { plain: 'Pushing a check',   term: 'Push',          cite: '§8', gloss: 'Spend a story point to reroll the whole pool once. Any threat the reroll shows beyond the first roll has to be paid for.' },
  storyPoints:   { plain: 'Story points',      term: 'Story Points',  cite: '§8',  gloss: 'A shared bank of favours. Spending one bends a roll your way and hands it to the GM, who can spend it back at you.' },
  silhouette:    { plain: 'Size',              term: 'Silhouette',    cite: '§5J', gloss: '0 a cat, 1 a person, 2 a car, 3 a truck, 4 a train. A big gap either way shifts the difficulty.' },
  adversary:     { plain: 'Hard to hit',       term: 'Adversary',     cite: '§12C', gloss: 'A rating some opponents carry. Each rank makes attacks against them one step harder.' },
  boost:         { plain: 'Bonus die',         term: 'Boost',         cite: '§1',  gloss: 'A blue die added when something is in your favour.' },
  setback:       { plain: 'Penalty die',       term: 'Setback',       cite: '§1',  gloss: 'A black die added when something works against you.' },
  triumph:       { plain: 'Best possible result', term: 'Triumph',    cite: '§1',  gloss: 'Rare and always true, even on a failed roll.' },
  despair:       { plain: 'Worst possible result', term: 'Despair',   cite: '§1',  gloss: 'Rare and always true, even on a successful roll. In public it draws the regime\'s attention.' },
  criticalInjury: { plain: 'Lasting injury',   term: 'Critical Injury', cite: '§9', gloss: 'A wound that sticks until treated, and each untreated one makes the next roll worse.' },
  cell:          { plain: 'Your network',      term: 'Cell',          cite: '§17.2', gloss: 'The group you belong to: its suspicion track, its safehouse, and the shared story points.' }
};

/** `Plain (Term)` for a label, or just the plain word when they would read the same. */
export function label(key) {
  const t = TERMS[key];
  if (!t) return key;
  return t.plain.toLowerCase() === t.term.toLowerCase() ? t.term : `${t.plain} (${t.term})`;
}

export function gloss(key) {
  const t = TERMS[key];
  return t ? t.gloss : '';
}

/** One line saying what a panel is for, plus a longer "how this works" for the expander. */
export const PANELS = {
  homeChecklist: {
    lede: 'Work down this list once and the app is set up for your table.',
    detail: 'Nothing is stored anywhere but this device, so there is no account to make. You can export a backup from Settings at any point.'
  },
  homeCharacters: { lede: 'Your characters live here. Tap one to make it the active sheet.', detail: 'The active character is the one the Sheet, Roll and Combat screens work on. You can keep as many as you like.' },
  homeCell: { lede: 'Your network at a glance: how hot it is, whether the safehouse is safe, and the story-point bank.', detail: 'Cell suspicion is shared by everyone in the group. It climbs when a member\'s own suspicion reaches 3, and it drives whether the safehouse is clear, watched or blown.' },

  sheetVitals: { lede: 'Injury, stress and suspicion. Nudge them as play goes.', detail: 'Injury and stress each have a limit; reaching either takes you out of the fight until you drop back below it. Type a number straight in, or use the buttons for small changes.' },
  sheetSkills: { lede: 'What your character is good at, and the dice each skill rolls. Tap one to take it to the Roll screen.', detail: 'The pool preview shows how many plain and upgraded dice you get: the higher of skill and its characteristic sets the number of dice, and the lower upgrades that many of them.' },
  sheetBuy: { lede: 'Work out what a purchase costs and how hard the check is, then pay for it.', detail: 'This table adds a house rule on top of the printed purchasing rules: above rarity 5, sellers want ration cards or goods in trade as well as cash.' },
  sheetGear: { lede: 'What you are carrying, what it weighs, and what state it is in.', detail: 'Going over your carrying limit adds a penalty die to physical checks, and going far over costs you your free move each turn. Items can be damaged and repaired a step at a time, and larger items have slots for attachments.' },
  sheetTalents: { lede: 'Your talents. Tap Use on the ones that do something on demand.', detail: 'Using a talent deducts its cost — stress or a story point — and marks it as spent for the encounter or session where the book says so.' },
  sheetConditions: { lede: 'States your character is in. Anything ticked here changes the dice on the Roll screen automatically.', detail: 'The manual has no single list of conditions, so this one is assembled from the injury table, item effects, suspicion thresholds and the carrying rules. Two of them are marked "inferred": the book uses the words without defining them, so the app states the reading it uses.' },
  sheetCriticals: { lede: 'Lasting injuries. Each untreated one makes the next roll on the injury table worse.', detail: 'Every untreated injury adds ten to future rolls on that table, so they stack up fast. Treating one takes a Medicine check or a week of rest.' },
  sheetDeath: { lede: 'When something on the injury table starts a countdown, run it here.', detail: 'Bleeding out costs a wound and a point of stress each turn. "The end is nigh" kills at the end of the next round unless treated. Suffocation piles on stress and then extra injuries. If you have the Indomitable talent you can spend a story point to hold off going down.' },
  sheetRecovery: { lede: 'Healing, and the limits on how often each kind can be used.', detail: 'The book puts a hard limit on most of these — once per encounter, once a night, once a week per injury — and the app enforces them rather than trusting you to remember.' },
  sheetFall: { lede: 'Work out what a fall costs you.', detail: 'How far you fell sets the wounds and the stress. An Average Athletics or Coordination check trims it — one wound per success, one stress per advantage — and your soak comes off the wounds afterwards, never off the stress. A long or extreme fall also adds to any injury roll that follows.' },
  sheetDread: { lede: 'When they see something genuinely disturbing, call for a dread check — and record what it leaves behind.', detail: 'It is an ordinary Discipline check at a difficulty set by how bad the thing was, once per circumstance per scene. A simple failure leaves them disoriented; a bad one costs strain; a severe one — three threat or a despair — leaves a lasting scar, rolled on the book\'s trauma table when the journey module is on. Scars are addressed through play and downtime, not by a check, so a scar stays on the sheet until you take it off.' },
  sheetKicker: { lede: 'One sentence: what forced this character onto the path they are on.', detail: 'It is not a mechanic and it never rolls. It is the hook the GM calls back to, and it pairs with the personal threat countdown if the journey module is on.' },
  sheetThreat: { lede: 'A person, unit or circumstance hunting this character specifically, on a three-step countdown.', detail: 'Separate from suspicion, which is the party\'s. Step 1 is foreshadowing; at step 2 checks made to evade this threat take a Setback die; step 3 is a scene played out rather than summarised. It is not one-way: a real success against the threat steps it back. Part of the optional journey module.' },
  journey: { lede: 'A start, a destination, and the stops between them — each with a blocker to get past.', detail: 'Every stop is rolled from the book\'s own location, faction and complication tables, plus a blocker generated the same way. Lingering at one rolls its escalating pressure; leaving one rolls the road to the next. Part of the optional journey module.' },
  combatTension: { lede: 'Friction inside the party, rated 0 to 2 between each pair, in each direction.', detail: 'Suspicion is pressure from outside; this is pressure within. In an opposed check between two characters who carry tension toward each other, the higher side adds one Boost per point. Releasing tension gives both characters 2 strain back. Part of the optional journey module.' },
  sheetSummary: { lede: 'The whole character on one screen, to read or to print.', detail: 'Nothing here can be edited — it is the sheet as it stands, laid out so it prints cleanly onto a page you can carry as a backup if the phone dies.' },
  sheetAdvance: { lede: 'Spend earned experience on skills and talents.', detail: 'Characteristics can only be raised during creation; afterwards only the Dedication talent raises one, never above 5 and never the same one twice. Talents follow the pyramid: you need as many talents in the tier below as you are about to have in the tier above.' },

  rollCheck: { lede: 'Pick the skill and how hard the task is. The pool builds itself.', detail: 'Choose "opposed" when another person is actively resisting you: they never roll, their rating builds the opposing dice instead.' },
  rollAttack: { lede: 'Pick a weapon and who you are aiming at, and the app does the rest of the arithmetic.', detail: 'The weapon sets which skill you roll. For a ranged weapon the distance sets the difficulty on its own — close is easy, far is not. Picking a target off the combat tracker means the app knows their soak, so once you tap in your dice it can tell you the damage and take it off them in one go.' },
  rollMotivation: { lede: 'The four things about your character that other people can use against you.', detail: 'In a social encounter an opponent spends leftover advantage to work these out: two buys your strength or flaw, three buys your desire or fear. Tick one once it is out in the open, so you both know what is already known.' },
  rollSituation: { lede: 'Anything about the scene that should change the dice.', detail: 'Cover, darkness, the size of your target and how hard the target is to hit all belong here. Below that you can upgrade or downgrade dice by hand, or spend a story point to do it.' },
  rollPool: { lede: 'The dice this check uses, and why each one is there.', detail: 'Dice are assembled in the order the book gives: build the base pool, add, upgrade, downgrade, then remove.' },
  // rollPool is retained for the "Why these dice" copy; the pool itself now lives in the
  // entry panel so the numbers sit beside the symbols they produce.
  rollEntry: { lede: 'These are the dice this check uses. Roll them, then tap what came up.', detail: 'The dice numbers update themselves as you change the skill, the difficulty, the opposition or anything about the scene — so what is listed is always what you should be holding. The book never prints what is on each die face, so your physical dice are the source of truth; face data was supplied separately, so you can also let the app roll for you by switching that on in Settings.' },
  rollResult: { lede: 'The outcome, what you can spend leftover symbols on, and what it did to your suspicion.', detail: 'Successes and failures cancel each other, and so do advantages and threats. The best and worst results never cancel and always happen.' },
  rollLog: { lede: 'Your recent checks, newest first. Delete any single one, or clear the lot.', detail: 'Kept on this device only, capped at a hundred. Each row shows the result; the full derivation — the pool, what you entered, and any suspicion change — is still recorded and travels with a backup export.' },

  combatLifecycle: { lede: 'End an encounter, scene, session, day, week or adventure. Each one runs its whole bundle of effects.', detail: 'The app shows exactly what will change before it changes anything, and every boundary can be undone once. Ending a session is where experience is awarded and suspicion cools.' },
  combatInitiative: { lede: 'Turn order. Slots belong to a side, not to a person.', detail: 'Everyone rolls once at the start. That produces an ordered list of slots, each owned by either the players or the GM. Each round, whoever owns the slot picks which of their people takes it — so the order of your own turns is yours to choose.' },
  combatRoster: { lede: 'Everyone in the fight. Drop opponents in from the bestiary.', detail: 'Groups of minions share one injury pool and drop a member at a time; named opponents take injuries normally. Published opponents load exactly as printed.' },
  combatVehicles: { lede: 'Cars, bikes, trucks and trains, on the same engine as everything else.', detail: 'Speed changes by one step at a time. Losing control crashes the vehicle for damage equal to its current speed.' },

  soloOracle: { lede: 'Ask a yes-or-no question when nothing on your sheet decides it.', detail: 'Set how likely the answer is and tap Ask. The app rolls the Oracle\'s dice for you — it is the GM\'s roll, not your character\'s — and shows what came up alongside the answer. A best or worst result also triggers a random event. If you would rather roll your own dice, the pad is under "I rolled my own dice". The book gives its two strongest answers to symbols this pool cannot roll, so they are read by weight instead: two or more net success with nothing left against it answers "Yes, and", and two or more net failure with nothing left for it answers "No, and".' },
  soloLog: { lede: 'Every question you have put to the Oracle, newest first.', detail: 'Kept apart from the Roll screen\'s log, because an Oracle answer is not a skill check. Delete any single one, or clear the lot. It holds the last hundred.' },
  clocks: { lede: 'Anything you want to see coming: name it, size it, and let your rolls fill it.', detail: 'A clock closing on you fills one segment on leftover Threat and two on a Despair; a progress clock fills one on leftover Success, and one more for every two Advantage at the GM\'s discretion. A Triumph fills your own clock by everything it still needs, or clears one segment from a clock closing on you. Point a check at a clock on the Roll screen and the symbols do the rest. Suspicion, the personal threat countdown and the manhunt are all clocks too, and each keeps its own printed pacing.' },
  soloTables: { lede: 'Start the scene, and roll a prompt when you need one: a phrase, a place, a faction, a complication, a stranger, an encounter.', detail: 'Starting a scene is bookkeeping rather than a rule — it gives the scene a number and a name so step 6 has something to close, and so the app can say which scene you are in. The tables are the book\'s own, rolled for you; the last one you rolled stays here and the rest are kept under "What has happened".' },
  soloResolve: { lede: 'Once the Oracle has answered, anything your character actually does is an ordinary check.', detail: 'The Oracle decides what the world does. Your own attempts go through the Roll screen like any other check, with your skill, your difficulty and your suspicion dice — and that is also where you point a check at a clock.' },
  soloSuspicion: { lede: 'Where suspicion stands on you and on the network, and what it now decides.', detail: 'Suspicion is tracked exactly as in group play. From personal suspicion 4 the book stops letting you decide when a raid or an arrest lands and hands that to the Oracle, so the question is asked from here rather than set up by hand.' },
  soloScene: { lede: 'Close the scene when it has played out, and clear it away for the next one.', detail: 'A scene owns a situation: whether the place is watched, what cover and concealment you were rolling against, who you were shooting at, and which clock your checks were feeding. Ending the scene clears all of that so the next one does not start set up as the last one finished. It is the same boundary the combat tracker fires, so it counts whether you end it here or there, and it can be undone once. Your logs, your suspicion and your clocks are not touched.' },
  soloIdeaLog: { lede: 'Every prompt you have rolled, newest first.', detail: 'Kept on this device, capped at a hundred. Delete any single one, or clear the lot.' },

  gmCell: { lede: 'The network\'s suspicion and its story-point bank.', detail: 'Raising cell suspicion here changes the safehouse status automatically: watched at 3, blown at 5.' },
  gmBestiary: { lede: 'Every published opponent, filtered how you like, one tap into the fight.', detail: 'Stats load exactly as printed rather than being recalculated, because the books build opponents to a threat budget rather than to the player formulas.' },
  gmEncounters: { lede: 'Whole encounters reduced to a single check, ready to drop on the table.', detail: 'Each one names the skills involved, how strong the opposition is and what failure costs.' },
  gmTables: { lede: 'Roll on the book\'s tables without leaving the screen.', detail: 'Injuries, random encounters and stranger generation, all rolled with the right die.' },
  gmBuild: { lede: 'Make an opponent from scratch using the book\'s recipes.', detail: 'Opponents built here derive their numbers from the recipes, and are stored separately from published ones so you can always tell which is which.' },

  settingsMode: { lede: 'Choose the seat you are sitting in. The tabs change to match.', detail: 'Nothing is deleted when you switch — the other screens simply stop taking up room in the navigation.' },
  settingsHouse: { lede: 'Two numbers the books never print, so the app makes them yours to set.', detail: 'The manual gives prices but never names the currency or the starting budget, so both are house aids and are labelled as such wherever they appear.' }
};

// Five tabs is the most that stays legible at 360px, so each seat gets its five and
// everything else lives in the header menu.
export const MODES = [
  { id: 'player', name: 'Player', desc: 'You play one character at a table with a GM.', tabs: ['home', 'sheet', 'roll', 'create', 'rules'] },
  { id: 'gm',     name: 'GM',     desc: 'You run the game for other people.',            tabs: ['home', 'gm', 'combat', 'roll', 'rules'] },
  { id: 'solo',   name: 'Solo',   desc: 'You play on your own, with the Oracle as GM.',  tabs: ['home', 'sheet', 'roll', 'solo', 'combat'] },
  { id: 'all',    name: 'Everything', desc: 'Show every screen at once. Past five tabs the bar shows glyphs alone so nothing is clipped.', tabs: null }
];

/** One line per screen, for the header menu. */
export const SCREEN_BLURBS = {
  home: 'Set-up checklist, your characters and your network.',
  sheet: 'The live character sheet you play from.',
  roll: 'Build a check, enter what you rolled, apply the result.',
  create: 'Make a character, or start from a ready-made one.',
  combat: 'Turn order, opponents, vehicles, clocks and session boundaries.',
  solo: 'The Oracle and the prompt tables, for playing without a GM.',
  gm: 'Opponents, encounters, tables and your network.',
  rules: 'Search every rule the app uses.',
  settings: 'Your seat, options, house aids, backup and safety tools.',
  safety: 'Session zero and rule zero, in one screen.'
};
