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
  personalHeat:  { plain: 'Suspicion on you',  term: 'Personal Heat', cite: '§17', gloss: 'How closely the regime is watching you, 0 to 5. It climbs on a disaster in public and falls during quiet weeks.' },
  cellHeat:      { plain: 'Suspicion on the network', term: 'Cell Heat', cite: '§17.2', gloss: 'The same track for your whole group. It rises when any member gets too hot.' },
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
  sheetGear: { lede: 'What you are carrying, what it weighs, and what state it is in.', detail: 'Going over your carrying limit adds a penalty die to physical checks, and going far over costs you your free move each turn. Items can be damaged and repaired a step at a time, and larger items have slots for attachments.' },
  sheetTalents: { lede: 'Your talents. Tap Use on the ones that do something on demand.', detail: 'Using a talent deducts its cost — stress or a story point — and marks it as spent for the encounter or session where the book says so.' },
  sheetConditions: { lede: 'States your character is in. Anything ticked here changes the dice on the Roll screen automatically.', detail: 'The manual has no single list of conditions, so this one is assembled from the injury table, item effects, suspicion thresholds and the carrying rules. Two of them are marked "inferred": the book uses the words without defining them, so the app states the reading it uses.' },
  sheetCriticals: { lede: 'Lasting injuries. Each untreated one makes the next roll on the injury table worse.', detail: 'Every untreated injury adds ten to future rolls on that table, so they stack up fast. Treating one takes a Medicine check or a week of rest.' },
  sheetDeath: { lede: 'When something on the injury table starts a countdown, run it here.', detail: 'Bleeding out costs a wound and a point of stress each turn. "The end is nigh" kills at the end of the next round unless treated. Suffocation piles on stress and then extra injuries. If you have the Indomitable talent you can spend a story point to hold off going down.' },
  sheetRecovery: { lede: 'Healing, and the limits on how often each kind can be used.', detail: 'The book puts a hard limit on most of these — once per encounter, once a night, once a week per injury — and the app enforces them rather than trusting you to remember.' },
  sheetAdvance: { lede: 'Spend earned experience on skills and talents.', detail: 'Characteristics can only be raised during creation; afterwards only the Dedication talent raises one, never above 5 and never the same one twice. Talents follow the pyramid: you need as many talents in the tier below as you are about to have in the tier above.' },

  rollCheck: { lede: 'Pick the skill and how hard the task is. The pool builds itself.', detail: 'Choose "opposed" when another person is actively resisting you: they never roll, their rating builds the opposing dice instead.' },
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
  combatTasks: { lede: 'Anything that takes several rolls: a manhunt, a repair job, or a clock you invent.', detail: 'The manhunt is the one the books actually publish: the search gets stronger every hour, and each failed round raises suspicion on both you and your network.' },

  soloOracle: { lede: 'Ask a yes-or-no question when nothing on your sheet decides it.', detail: 'Set how likely the answer is, roll the dice listed, and enter what came up. A best or worst result also triggers a random event.' },
  soloTables: { lede: 'Prompts when you need one: a phrase, a place, a faction, a complication, a stranger, an encounter.', detail: 'These are the book\'s own tables, rolled for you.' },

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
  { id: 'all',    name: 'Everything', desc: 'Show every screen at once — nine tabs, tight on a phone.', tabs: null }
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
