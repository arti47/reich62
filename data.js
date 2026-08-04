// REICH '62 — core rules library.
// Source of record: source/reich62_manual.md. Every export cites its section as `§x`.
// Effect text is paraphrased, never copied (CLAUDE.md §14).
// Rulings from CLAUDE.md §4 are cited inline as `R-x`.
// No src/ module may hardcode a rules value — it belongs here (CLAUDE.md §13.2).

// ---------------------------------------------------------------------------
// R-1 — the manual never prints the human archetype base thresholds (§6).
// Confirmed ruling: WT 8 / ST 10. These two constants are the only place the
// bases appear; a single edit here corrects the whole app.
export const BASE_WOUND_THRESHOLD = 8;   // R-1
export const BASE_STRAIN_THRESHOLD = 10; // R-1

// R-B1 — the manual prints only which symbols each die can show (§1), never the face
// distributions, so for the first four phases no simulated roller could be faithful to the
// source and `digitalRoller` stayed force-disabled. The distributions were supplied
// separately as `source/genesys_dice_breakdown.md`, cited `D§`, which is what unblocks it.
// Manual symbol entry remains the default input.
//
// T68 — Die face distributions — D§. Each face lists the symbols printed on it; an empty
// array is a blank face. R-20: the table prints the Proficiency 12 face as Triumph alone
// and the Challenge 12 face as Despair alone, and neither book says a Triumph also counts
// as a Success, so they are stored exactly as printed.
export const DIE_FACES = {
  boost: [                      // blue d6 — D§
    [], [], ['success'], ['success', 'advantage'], ['advantage', 'advantage'], ['advantage']
  ],
  setback: [                    // black d6 — D§
    [], [], ['failure'], ['failure'], ['threat'], ['threat']
  ],
  ability: [                    // green d8 — D§
    [], ['success'], ['success'], ['success', 'success'], ['advantage'], ['advantage'],
    ['success', 'advantage'], ['advantage', 'advantage']
  ],
  difficulty: [                 // purple d8 — D§
    [], ['failure'], ['failure', 'failure'], ['threat'], ['threat'], ['threat', 'threat'],
    ['threat', 'threat'], ['failure', 'threat']
  ],
  proficiency: [                // yellow d12 — D§
    [], ['success'], ['success', 'success'], ['success', 'success'], ['advantage'],
    ['success', 'advantage'], ['success', 'advantage'], ['advantage', 'advantage'],
    ['advantage', 'advantage'], ['advantage', 'advantage'], ['advantage', 'advantage'],
    ['triumph']
  ],
  challenge: [                  // red d12 — D§
    [], ['failure'], ['failure'], ['failure', 'failure'], ['failure', 'failure'], ['threat'],
    ['threat'], ['failure', 'threat'], ['failure', 'threat'], ['threat', 'threat'],
    ['threat', 'threat'], ['despair']
  ]
};

export const DIE_FACES_SOURCE = {
  cite: 'D§',
  file: 'source/genesys_dice_breakdown.md',
  note: 'Supplied separately from the two books. Triumph appears only on the Proficiency die and Despair only on the Challenge die, matching §1.',
  ruling: 'R-20'
};

// T1 — Die types, symbols, cancellation — §1
export const SYMBOLS = [
  { id: 'success',   glyph: '🌟', name: 'Success',   polarity: 'positive', cancels: 'failure' },
  { id: 'advantage', glyph: '🔺', name: 'Advantage', polarity: 'positive', cancels: 'threat' },
  { id: 'triumph',   glyph: '☀️', name: 'Triumph',   polarity: 'positive', cancels: null },
  { id: 'failure',   glyph: '💥', name: 'Failure',   polarity: 'negative', cancels: 'success' },
  { id: 'threat',    glyph: '🔻', name: 'Threat',    polarity: 'negative', cancels: 'advantage' },
  { id: 'despair',   glyph: '⚡', name: 'Despair',   polarity: 'negative', cancels: null }
];

export const DICE = [
  { id: 'ability',     name: 'Ability',     sides: 8,  colour: 'green',  polarity: 'positive', role: 'a skill and its governing characteristic', symbols: ['success', 'advantage'] },
  { id: 'proficiency', name: 'Proficiency', sides: 12, colour: 'yellow', polarity: 'positive', role: 'an upgraded Ability die',  symbols: ['success', 'advantage', 'triumph'] },
  { id: 'difficulty',  name: 'Difficulty',  sides: 8,  colour: 'purple', polarity: 'negative', role: 'the difficulty of the task itself', symbols: ['failure', 'threat'] },
  { id: 'challenge',   name: 'Challenge',   sides: 12, colour: 'red',    polarity: 'negative', role: 'an upgraded Difficulty die', symbols: ['failure', 'threat', 'despair'] },
  { id: 'boost',       name: 'Boost',       sides: 6,  colour: 'blue',   polarity: 'positive', role: 'a situational advantage', symbols: ['success', 'advantage', 'blank'] },
  { id: 'setback',     name: 'Setback',     sides: 6,  colour: 'black',  polarity: 'negative', role: 'a situational hindrance', symbols: ['failure', 'threat', 'blank'] }
];

export const UPGRADE_MAP = { ability: 'proficiency', difficulty: 'challenge' };
export const DOWNGRADE_MAP = { proficiency: 'ability', challenge: 'difficulty' };

export const RESOLUTION_RULES = {
  cite: '§1',
  steps: [
    'Cancel Success against Failure one for one.',
    'Cancel Advantage against Threat one for one.',
    'One or more net Success means the check succeeds; no net Success means it fails.',
    'Leftover Advantage or Threat is narrated whether or not the check succeeded.',
    'Triumph and Despair are never cancelled and always take effect, whatever the outcome.'
  ],
  cancellationPairs: [['success', 'failure'], ['advantage', 'threat']],
  uncancellable: ['triumph', 'despair']
};

// T2 — Pool build + modification order — §2
export const POOL_BUILD = {
  cite: '§2',
  // Higher of (skill rank, linked characteristic) = Ability dice.
  // Lower of the two = how many of those are upgraded to Proficiency.
  abilityDice: (skillRank, characteristic) => Math.max(skillRank, characteristic),
  proficiencyUpgrades: (skillRank, characteristic) => Math.min(skillRank, characteristic),
  notes: [
    'Unskilled (rank 0) means zero upgrades — the pool is all Ability dice.',
    'The GM sets difficulty and may upgrade Difficulty dice to Challenge for skilled opposition or by spending a Story Point.',
    'Boost and Setback dice are added for genuine situational factors and do not cancel each other before the roll.'
  ]
};

export const MODIFICATION_ORDER = ['assemble', 'add', 'upgrade', 'downgrade', 'remove']; // §2.4 — enforced by roller.js

// T3 — Difficulty ladder — §3
export const DIFFICULTIES = [
  { id: 'simple',     name: 'Simple',     dice: 0, symbol: '–',     guidance: 'Trivial — usually no roll at all' },
  { id: 'easy',       name: 'Easy',       dice: 1, symbol: '💠',     guidance: 'A minor obstacle' },
  { id: 'average',    name: 'Average',    dice: 2, symbol: '💠💠',    guidance: 'A standard challenge' },
  { id: 'hard',       name: 'Hard',       dice: 3, symbol: '💠💠💠',   guidance: 'A difficult task' },
  { id: 'daunting',   name: 'Daunting',   dice: 4, symbol: '💠💠💠💠',  guidance: 'An extreme task' },
  { id: 'formidable', name: 'Formidable', dice: 5, symbol: '💠💠💠💠💠', guidance: 'Very nearly impossible' },
  { id: 'impossible', name: 'Impossible', dice: 5, symbol: '💠💠💠💠💠', storyPointCost: 1,
    guidance: 'Formidable dice, and it costs 1 Story Point merely to attempt. Reserve for life-or-death story beats.' }
];

// T4 — Per-skill difficulty guidance — §3
export const SKILL_DIFFICULTY_GUIDANCE = [
  { skill: 'Athletics',   easy: 'Climb a short ladder',           average: 'Scale a rough wall',            hard: 'Climb a sheer cliff',                daunting: 'Free-climb an overhang under fire' },
  { skill: 'Skulduggery', easy: 'Pick a simple padlock',          average: 'Pick a household lock',         hard: 'Pick a reinforced or complex lock',  daunting: 'Pick a lock with no visible mechanism' },
  { skill: 'Deception',   easy: 'Tell a simple, plausible lie',   average: 'Lie under mild scrutiny',       hard: 'Lie to a trained interrogator',      daunting: 'Lie to someone who already suspects the truth' },
  { skill: 'Stealth',     easy: 'Slip past a distracted guard',   average: 'Slip past an alert guard',      hard: 'Slip past a vigilant patrol',        daunting: 'Slip past trained trackers or dogs' },
  { skill: 'Streetwise',  easy: 'Find a common black-market good', average: 'Find a moderately illegal item', hard: 'Find a restricted or military item', daunting: 'Find something the regime actively hunts for' },
  { skill: 'Medicine',    easy: 'Treat a minor cut',              average: 'Treat a serious wound',         hard: 'Perform field surgery',              daunting: 'Perform surgery with improvised tools' },
  { skill: 'Negotiation', easy: 'Haggle over a minor price',      average: 'Negotiate a standard deal',     hard: 'Negotiate with a hostile party',     daunting: 'Negotiate life-or-death terms' }
];

// T5 — Opposed / competitive / assisted — §3A
export const CHECK_PROCEDURES = {
  cite: '§3A',
  opposed: {
    name: 'Opposed check',
    steps: [
      'The active character assembles their pool as normal.',
      'The difficulty side is built from the opposing character\'s relevant skill and characteristic, using the same algorithm: the higher value sets the number of Difficulty dice, the lower value upgrades that many to Challenge.',
      'Only the active character rolls. The opponent never rolls and banks nothing.',
      'Resolve the roll in the usual way.'
    ],
    notation: 'opposed Skill vs. Skill'
  },
  competitive: {
    name: 'Competitive check',
    steps: [
      'The GM sets one difficulty for everyone.',
      'Every participant rolls against it.',
      'Rank participants by total uncancelled Success.'
    ],
    // R-3 — the manual does not state a tie rule for competitive checks.
    tieBreakers: ['success', 'advantage', 'triumph', 'simultaneous'] // R-3
  },
  assisted: {
    name: 'Assisted check',
    summary: 'An engaged ally spends the Assist maneuver to grant one Boost die on your next check. Multiple assistants stack. Unused dice are lost if not spent on that next check.',
    cite: '§3A, §5A'
  }
};

// T6 — Characteristics — §4
export const CHARACTERISTICS = [
  { id: 'brawn',     name: 'Brawn',     abbr: 'Br' },
  { id: 'agility',   name: 'Agility',   abbr: 'Ag' },
  { id: 'intellect', name: 'Intellect', abbr: 'In' },
  { id: 'cunning',   name: 'Cunning',   abbr: 'Cu' },
  { id: 'willpower', name: 'Willpower', abbr: 'Wi' },
  { id: 'presence',  name: 'Presence',  abbr: 'Pr' }
];

export const CHARACTERISTIC_MIN = 1; // R-5 — floor before XP is spent
export const CHARACTERISTIC_MAX = 5; // §7 — cap at creation; Dedication also cannot exceed 5
export const SKILL_RANK_MAX = 5;
export const SKILL_RANK_MAX_AT_CREATION = 2; // §7

// T7 — Skills — §4
export const SKILLS = [
  { id: 'athletics',    name: 'Athletics',    characteristic: 'brawn',     category: 'general' },
  { id: 'computers',    name: 'Computers',    characteristic: 'intellect', category: 'general' },
  { id: 'cool',         name: 'Cool',         characteristic: 'presence',  category: 'general' },
  { id: 'coordination', name: 'Coordination', characteristic: 'agility',   category: 'general' },
  { id: 'discipline',   name: 'Discipline',   characteristic: 'willpower', category: 'general' },
  { id: 'driving',      name: 'Driving',      characteristic: 'agility',   category: 'general' },
  { id: 'mechanics',    name: 'Mechanics',    characteristic: 'intellect', category: 'general' },
  { id: 'medicine',     name: 'Medicine',     characteristic: 'intellect', category: 'general' },
  { id: 'perception',   name: 'Perception',   characteristic: 'cunning',   category: 'general' },
  { id: 'piloting',     name: 'Piloting',     characteristic: 'agility',   category: 'general' },
  { id: 'resilience',   name: 'Resilience',   characteristic: 'brawn',     category: 'general' },
  { id: 'skulduggery',  name: 'Skulduggery',  characteristic: 'cunning',   category: 'general' },
  { id: 'stealth',      name: 'Stealth',      characteristic: 'agility',   category: 'general' },
  { id: 'streetwise',   name: 'Streetwise',   characteristic: 'cunning',   category: 'general' },
  { id: 'survival',     name: 'Survival',     characteristic: 'cunning',   category: 'general' },
  { id: 'vigilance',    name: 'Vigilance',    characteristic: 'willpower', category: 'general' },
  { id: 'charm',        name: 'Charm',        characteristic: 'presence',  category: 'social' },
  { id: 'coercion',     name: 'Coercion',     characteristic: 'willpower', category: 'social' },
  { id: 'deception',    name: 'Deception',    characteristic: 'cunning',   category: 'social' },
  { id: 'leadership',   name: 'Leadership',   characteristic: 'presence',  category: 'social' },
  { id: 'negotiation',  name: 'Negotiation',  characteristic: 'presence',  category: 'social' },
  { id: 'knowledge',    name: 'Knowledge',    characteristic: 'intellect', category: 'knowledge', specialisable: true,
    note: 'The player names the specialisation (Reich bureaucracy, geography, the underworld, and so on).' },
  { id: 'brawl',        name: 'Brawl',        characteristic: 'brawn',     category: 'combat' },
  { id: 'melee',        name: 'Melee',        characteristic: 'brawn',     category: 'combat' },
  { id: 'ranged',       name: 'Ranged',       characteristic: 'agility',   category: 'combat' },
  { id: 'gunnery',      name: 'Gunnery',      characteristic: 'agility',   category: 'combat', note: 'Mounted and vehicle weapons.' }
];

// T8 — Skills this setting does not use — §4
export const EXCLUDED_SKILLS = ['Alchemy', 'Astrocartography', 'Operating', 'Riding', 'Arcana', 'Divine', 'Primal'];

// T9 — Combat sequence and initiative slot filling — §5, §5A'
export const COMBAT_SEQUENCE = {
  cite: '§5, §5A\'',
  initiative: {
    skills: ['cool', 'vigilance'],
    difficulty: 'simple',
    choose: 'Cool when the encounter was planned or anticipated; Vigilance when it began by surprise or ambush. Default to Vigilance if unsure.',
    ranking: 'Rank by uncancelled Success.',
    tieBreakers: ['advantage', 'pcBeforeNpc']
  },
  slotFilling: {
    summary: 'Initiative produces an ordered list of slots, each owned by the PC side or the NPC side. Order and ownership are fixed for the whole encounter. Each round, at each slot in turn, the owning side picks which of its members who has not yet acted takes that slot.',
    modelNote: 'Track slots, not a fixed character order.'
  },
  round: [
    'Work down the slot list; the owning side chooses who fills each slot.',
    'A turn is one action plus one free maneuver.',
    'The round ends when every participant has acted; repeat until the encounter resolves.'
  ]
};

// T10 — Maneuvers — §5A
export const MANEUVER_RULES = {
  cite: '§5A',
  // R-21 — §5's turn-budget summary says "1 action + 2 maneuvers, or 2 maneuvers and strain
  // for a third", while §5A gives the detailed rule: one free maneuver, a second for 2
  // strain, never more than two. The detailed rule governs.
  ruling: 'R-21',
  freePerTurn: 1,
  maxPerTurn: 2,
  secondManeuverStrainCost: 2,
  note: 'Bonus maneuvers granted out of turn at GM discretion do not count against the cap of two.'
};

export const MANEUVERS = [
  { id: 'aim', name: 'Aim', summary: 'Steady the weapon: one maneuver adds one Boost to the next combat check, two consecutive add two. Aiming instead at a specific limb or item adds two Setback to that check, or one Setback if you aim twice. The benefit is lost if you move, act otherwise, or take damage past your soak first.' },
  { id: 'assist', name: 'Assist', summary: 'Give an engaged ally one Boost on their next check. Assistants stack; the dice are lost if unused on that next turn.' },
  { id: 'guardedStance', name: 'Guarded Stance', summary: 'Add one Setback to your own combat checks until the end of your next turn, and gain melee defence 1 for the same span.' },
  { id: 'interactEnvironment', name: 'Interact with the Environment', summary: 'Open or close a door, upend a table, take cover (ranged defence 1, more behind very solid cover), and similar single-maneuver acts.' },
  { id: 'manageGear', name: 'Manage Gear', summary: 'Draw, holster, ready or load a weapon; retrieve or stow an item.' },
  { id: 'mountDismount', name: 'Mount or Dismount', summary: 'Get into or out of a vehicle, or onto a trained animal. Mounting an untrained animal is instead an Average Survival check as an action.' },
  { id: 'move', name: 'Move', summary: 'Change range band (short to medium costs one maneuver; medium to long and long to extreme cost two each), engage or disengage, or reposition within short range.' },
  { id: 'proneStand', name: 'Drop Prone / Stand from Prone', summary: 'Prone grants one Boost against ranged attacks on you but one Setback against melee attacks on you.' },
  { id: 'preparation', name: 'Preparation', summary: 'The setup maneuver some talents and weapons require before use.' }
];

// T11 — Actions — §5B
export const ACTION_TYPES = [
  { id: 'exchangeForManeuver', name: 'Exchange the action for a maneuver', summary: 'Take a second maneuver instead of an action, still capped at two maneuvers.' },
  { id: 'activateTalent', name: 'Activate an ability or talent', summary: 'As written by the talent.' },
  { id: 'skillCheck', name: 'Perform a skill check', summary: 'Any task with a meaningful chance and stake of failure.' },
  { id: 'combatCheck', name: 'Perform a combat check', summary: 'A skill check with the extra combat steps below.' }
];

export const COMBAT_CHECK_PROCEDURE = {
  cite: '§5B',
  steps: [
    'Declare the attack, the weapon and skill, and the target.',
    'Assemble the pool. Melee is always Average; ranged difficulty follows the range band.',
    'Roll. On success, damage is the weapon base plus one per uncancelled Success.',
    'Spend Advantage and Triumph (attacker chooses).',
    'Spend Threat and Despair (GM chooses by default).',
    'Subtract the target\'s soak; the remainder is wounds. Trigger a Critical Injury if uncancelled Advantage meets the weapon\'s Crit rating, by spending two Advantage, or on an uncancelled Despair.'
  ],
  meleeDifficulty: 'average'
};

// T12 — Ranged difficulty by range — §5B Table 5B-1
export const RANGED_DIFFICULTY_BY_RANGE = [
  { range: 'engaged', difficulty: 'easy', note: 'Plus any weapon-specific modifier for firing while engaged.' },
  { range: 'short',   difficulty: 'easy' },
  { range: 'medium',  difficulty: 'average' },
  { range: 'long',    difficulty: 'hard' },
  { range: 'extreme', difficulty: 'daunting' }
];

// T13, T14, T30, T32 — the four spend tables.
// R-12: one Triumph purchases any listed effect at any cost tier; Advantage costs are literal.
export const SPEND_TABLES = {
  combat: { // T13 — §5C
    cite: '§5C',
    positive: [
      { cost: 1, triumph: true, effects: ['Recover 1 strain', 'Give an ally one Boost on their next check', 'Notice a useful tactical detail', 'Inflict a Critical Injury on a damaging hit (cost varies by weapon)', 'Activate an item quality (cost varies)'] },
      { cost: 2, triumph: true, effects: ['Take an immediate free maneuver, still capped at two per turn', 'Add one Boost to the target\'s or an ally\'s next check'] },
      { cost: 3, triumph: true, effects: ['Negate the target\'s defence (cover, gear, Guarded Stance) until the end of the round', 'Ignore penalising environmental effects until your next turn', 'Disable the target or their gear instead of dealing damage, by GM agreement', 'Gain +1 melee or ranged defence until your next turn', 'Force the target to drop a weapon'] },
      { cost: 0, triumphOnly: true, effects: ['Upgrade the difficulty of the target\'s next check', 'Upgrade an ally\'s next check', 'Do something vital, such as sealing a door', 'On an Initiative check, take an immediate free maneuver before combat starts'] },
      { cost: 0, triumphOnly: true, triumphCount: 2, effects: ['Destroy a piece of the target\'s equipment'] }
    ],
    negative: [
      { cost: 1, despair: true, effects: ['The active character suffers 1 strain', 'The active character loses the benefit of an earlier maneuver (cover, Guarded Stance) until it is repeated'] },
      { cost: 2, despair: true, effects: ['An opponent takes an immediate free maneuver as an incidental', 'The target gains one Boost', 'The active character or an ally takes one Setback on their next action'] },
      { cost: 3, despair: true, effects: ['The active character falls prone', 'The active character hands the enemy a significant tactical advantage'] },
      { cost: 0, despairOnly: true, effects: ['The weapon is out of ammunition for the rest of the encounter', 'Upgrade the difficulty of an ally\'s or the active character\'s next check', 'The active character\'s weapon or tool becomes damaged'] }
    ]
  },
  generic: { // T14 — §5C'
    cite: '§5C\'',
    note: 'No fixed table outside combat and social scenes — interpret narratively on this scale.',
    positive: [
      { cost: 1, triumph: true, effects: ['A minor upside: finish faster, notice something extra, leave no trace, gain a Boost on a related follow-up'] },
      { cost: 2, triumph: true, effects: ['A meaningful bonus: an ally benefits too, a complication is avoided outright, extra information surfaces'] },
      { cost: 3, triumph: true, effects: ['A significant swing: something unexpected and valuable follows directly from the attempt'] }
    ],
    negative: [
      { cost: 1, despair: true, effects: ['A minor complication: it takes longer, draws slight attention, costs something small'] },
      { cost: 2, despair: true, effects: ['A meaningful complication: equipment wear, an ally inconvenienced, a witness notices'] },
      { cost: 3, despair: true, effects: ['A real setback — in a surveilled context this is a common Heat trigger'], heatTrigger: true }
    ]
  },
  social: { // T30 — §11
    cite: '§11',
    positive: [
      { cost: 1, triumph: true, effects: ['Recover 1 strain', 'Give an ally one Boost on their next check', 'Notice a useful detail'] },
      { cost: 2, triumph: true, effects: ['Learn the target\'s Strength or Flaw', 'Add one Boost to the target\'s or an ally\'s next check'] },
      { cost: 3, triumph: true, effects: ['Learn the target\'s Desire or Fear', 'Conceal your own goal', 'Learn the target\'s true goal'] },
      { cost: 0, triumphOnly: true, effects: ['Learn any Motivation facet, with GM approval', 'Upgrade the difficulty of the target\'s next check', 'Upgrade an ally\'s next check', 'Accomplish something vital'] }
    ],
    negative: [
      { cost: 1, despair: true, effects: ['The active character suffers 1 strain', 'The active character is sidetracked and loses the use of a maneuver next turn'] },
      { cost: 2, despair: true, effects: ['Let slip your own Strength or Flaw', 'The target gains one Boost', 'The active character or an ally takes one Setback on their next action'] },
      { cost: 3, despair: true, effects: ['Let slip your own Desire or Fear', 'Let slip your true goal'] },
      { cost: 0, despairOnly: true, effects: ['Let slip an ally\'s Motivation facet', 'The target learns a false Motivation facet and believes it', 'Upgrade the difficulty of an ally\'s or the active character\'s next check', 'The active character is sidelined for the round'] }
    ]
  },
  vehicle: { // T32 — §12
    cite: '§12',
    positive: [
      { cost: 1, triumph: true, effects: ['Reduce system strain by 1', 'A passenger notices something useful', 'A minor positioning advantage'] },
      { cost: 2, triumph: true, effects: ['Take a free pilot-only maneuver without its usual system-strain cost', 'Force the target vehicle off its intended course'] },
      { cost: 3, triumph: true, effects: ['Disable a component (tyre, engine, weapon mount) instead of dealing hull trauma', 'Gain a full extra range band of separation'] }
    ],
    negative: [
      { cost: 1, despair: true, effects: ['The vehicle suffers 1 system strain', 'Lose the benefit of an earlier vehicle maneuver'] },
      { cost: 2, despair: true, effects: ['A control check is required next turn or the vehicle loses a range increment of position', 'A passenger is thrown about and suffers 1 strain'] },
      { cost: 3, despair: true, effects: ['The vehicle stalls or skids — treat as losing control (see Crashes)'] },
      { cost: 0, despairOnly: true, effects: ['A component breaks — treat as Major damage under §14B'] }
    ]
  }
};

// T15 — Outnumbering — §5C''
export const MULTIPLE_ATTACKERS = {
  cite: '§5C\'\'',
  fixedBonus: null,
  guidance: [
    'There is no fixed flanking bonus; being outnumbered is represented with situational dice at GM discretion.',
    'A defender meaningfully overwhelmed (three or more engaged attackers) may take one Setback on their own next check.',
    'Attackers may gain one Boost when their target is already engaged with an ally, especially in melee.',
    'Do not apply these automatically — reserve them for scenes where being surrounded genuinely matters.'
  ],
  gatedBySetting: 'gmDiscretionaryDice'
};

// T16 — Range bands and movement — §5D
export const RANGE_BANDS = [
  { id: 'engaged', name: 'Engaged', note: 'A subcategory of short — close enough to touch or fight hand to hand.' },
  { id: 'short',   name: 'Short',   note: 'A few metres; comfortable conversation distance. Most movement inside it is one maneuver.' },
  { id: 'medium',  name: 'Medium',  note: 'Tens of metres; conversation needs a raised voice.' },
  { id: 'long',    name: 'Long',    note: 'Tens to hundreds of metres; you have to shout.' },
  { id: 'extreme', name: 'Extreme', note: 'The furthest interactive range; shouting may not carry.' }
];

export const MOVEMENT_COSTS = [
  { from: 'engaged', to: 'short',   maneuvers: 1 },
  { from: 'short',   to: 'medium',  maneuvers: 1 },
  { from: 'medium',  to: 'long',    maneuvers: 2 },
  { from: 'long',    to: 'extreme', maneuvers: 2 }
];

// T17 — Environmental effects — §5E
export const ENVIRONMENT = [
  { id: 'concealment', name: 'Concealment', summary: 'Darkness, smoke, fog or tall grass adds Boost dice to the concealed character\'s Stealth and an equal number of Setback dice to ranged attacks, Perception and Vigilance aimed at them.',
    ladder: [ { dice: 1, examples: 'Mist, shadow' }, { dice: 2, examples: 'Fog, dusk or dawn, thick grass' }, { dice: 3, examples: 'Heavy fog, smoke, night, dense undergrowth' } ] },
  { id: 'cover', name: 'Cover', summary: 'Grants ranged defence 1 — more for prepared positions such as trenches or bunkers — plus a Boost on relevant checks made from behind it.' },
  { id: 'difficultTerrain', name: 'Difficult terrain', summary: 'Doubles the maneuvers needed to cover the same ground.' },
  { id: 'impassableTerrain', name: 'Impassable terrain', summary: 'Cannot be crossed by maneuver at all — it takes an Athletics or Coordination action, or a narrative workaround.' },
  { id: 'water', name: 'Water', summary: 'Difficult terrain by default; swift or stormy water may need an Athletics action. A submerged character holds their breath for rounds equal to Brawn before suffocation begins.' },
  { id: 'fireAcid', name: 'Fire, acid, corrosive atmosphere', summary: 'The GM rates the hazard 1 to 10 or more; the character takes wounds equal to the rating at the start of each of their turns until they are out of it.' },
  { id: 'extremes', name: 'Extreme cold or heat, thin air', summary: 'GM adjudicated, normally as added Setback dice on relevant physical checks scaled to severity.' }
];

// T18 — Encumbrance — §5F
export const ENCUMBRANCE = {
  cite: '§5F',
  thresholdBase: 5, // + Brawn
  itemScale: [ { size: 'small', encumbrance: '1–2' }, { size: 'medium', encumbrance: '3–4' }, { size: 'large', encumbrance: '5–6' } ],
  incidentals: [ { count: 10, encumbrance: 1, note: 'loose' }, { count: 20, encumbrance: 1, note: 'organised in pockets and pouches' } ],
  overThreshold: 'One Setback on every Agility and Brawn check per point over the threshold.',
  severeOverThreshold: 'Over by an amount equal to or greater than Brawn: lose the free maneuver, so each of up to two maneuvers costs 2 strain.',
  lifting: {
    skill: 'athletics',
    ladder: [ { over: 1, difficulty: 'easy' }, { over: 2, difficulty: 'average' }, { over: 3, difficulty: 'hard' }, { over: 4, difficulty: 'daunting', note: 'Capped at Daunting for 4 or more over.' } ],
    helpers: 'Allies helping to lift add their Brawn to the effective threshold for that task.'
  }
};

// T19 — Recovery and healing — §5G
export const RECOVERY = {
  cite: '§5G',
  methods: [
    { id: 'endOfEncounter', name: 'End-of-encounter strain check', skill: ['discipline', 'cool'], difficulty: 'simple',
      restores: '1 strain per uncancelled Success', limit: 'once per encounter', limitKey: 'perEncounter',
      talents: ['desperateRecovery', 'oneWithNature'] },
    { id: 'nightRest', name: 'Full night\'s rest', restores: '1 wound and all strain', limit: 'once per night', limitKey: 'perDay' },
    { id: 'weekRest', name: 'Full week\'s rest', skill: ['resilience'], difficultyFrom: 'criticalInjurySeverity',
      restores: 'One Critical Injury on success',
      // R-9 — the manual prints Despair here, which would make a Despair grant a benefit and
      // contradict §1. Read as Triumph.
      bonus: 'An uncancelled Triumph heals a second Critical Injury', bonusSymbol: 'triumph', ruling: 'R-9',
      limit: 'once per week', limitKey: 'perWeek' },
    { id: 'medicineWounds', name: 'Medicine check (wounds and strain)', skill: ['medicine'],
      restores: 'Wounds equal to uncancelled Success, strain equal to uncancelled Advantage',
      limit: 'once per encounter per target', limitKey: 'perEncounterPerTarget',
      difficultyRule: [
        { when: 'wounds <= half of wound threshold', difficulty: 'easy' },
        { when: 'wounds > half of wound threshold', difficulty: 'average' },
        { when: 'wounds > wound threshold', difficulty: 'hard' }
      ],
      modifiers: [ { id: 'selfTreatment', label: 'Treating yourself', difficultySteps: 2 }, { id: 'noEquipment', label: 'No medical equipment', difficultySteps: 1 } ],
      talents: ['surgeon'] },
    { id: 'medicineCritical', name: 'Medicine check (Critical Injury)', skill: ['medicine'], difficultyFrom: 'criticalInjurySeverity',
      restores: 'One Critical Injury', limit: 'once per week per injury', limitKey: 'perWeekPerInjury' },
    { id: 'painkillers', name: 'Painkillers', ladder: [5, 4, 3, 2, 1, 0], limit: 'counter resets daily', limitKey: 'perDay',
      note: 'One maneuver to administer to yourself or an engaged ally. Never heals Critical Injuries. The sixth and later doses in a day do nothing.',
      talents: ['painkillerSpecialization'] },
    { id: 'vehicleSystemStrain', name: 'Vehicle system strain', restores: '1 per day if undamaged, or via the Damage Control action', limit: 'once per day', limitKey: 'perDay', cite: '§12' }
  ],
  criticalInjuryPersistence: 'A Critical Injury persists mechanically past its listed duration until it is properly treated, and each untreated injury adds +10 to later Critical Injury rolls.'
};

// T20 — Two-weapon, unarmed, improvised — §5H
export const COMBAT_VARIANTS = {
  cite: '§5H',
  twoWeapon: {
    steps: [
      'Name one one-handed weapon as the primary.',
      'Use the lower of the two skill ranks and the lower of the two characteristics.',
      'Take the higher of the two difficulties and raise it by one more.',
      'On success the primary weapon hits. Spend two Advantage or one Triumph to land the secondary as well.',
      'Each hit deals its own weapon\'s damage.'
    ]
  },
  unarmed: { skill: 'brawl', damage: 'brawn', crit: 5, range: 'engaged', qualities: ['Knockdown'],
    note: 'May target strain instead of wounds. Brawl weapons such as knuckledusters add to this base rather than replacing it.' },
  improvised: { skill: 'melee', damageBonus: 'brawn', note: 'Generates one automatic Threat on any check (equivalent to Inferior) and breaks on two Threat or two Advantage.' }
};

// T21 — Falling and suffocation — §5I
export const FALLING = [
  { band: 'short',   wounds: 10, strain: 10 },
  { band: 'medium',  wounds: 30, strain: 20 },
  { band: 'long',    woundsFormula: 'woundThreshold + 1', strain: 30, criticalModifier: 50 },
  { band: 'extreme', woundsFormula: 'woundThreshold + 1', strain: 40, criticalModifier: 75, note: 'Or outright death at GM discretion.' }
];

export const FALLING_RULES = {
  cite: '§5I',
  soak: 'Wound damage is reduced by soak; strain is not.',
  mitigation: 'An Average Athletics or Coordination check reduces the fall: one wound per uncancelled Success, one strain per uncancelled Advantage, and an uncancelled Triumph may reduce the effective fall by one range band.'
};

export const SUFFOCATION = {
  cite: '§5I',
  strainPerRound: 3,
  timing: 'At the start of the suffocating character\'s turn.',
  escalation: 'Once strain exceeds the strain threshold the character is incapacitated, and every further turn of suffocation adds one more Critical Injury roll until it stops or they die.'
};

// T22 — Silhouette — §5J
export const SILHOUETTES = [
  { value: 0, examples: 'Small animals such as cats and dogs' },
  { value: 1, examples: 'Humans — most PCs and NPCs; motorcycles' },
  { value: 2, examples: 'Large animals, cars, small trucks' },
  { value: 3, examples: 'Light aircraft, large trucks' },
  { value: 4, examples: 'Trains, small ships' },
  { value: 5, examples: 'Not used in Reich \'62' }
];

export const SILHOUETTE_RULE = {
  cite: '§5J',
  largerTarget: { differenceAtLeast: 2, difficultySteps: -1 },
  smallerTarget: { differenceAtLeast: 2, difficultySteps: +1 }
};

// T23 — Derived stats — §6, R-1
export const DERIVED_FORMULAS = [
  { id: 'woundThreshold',       name: 'Wound Threshold',       formula: 'BASE_WOUND_THRESHOLD + Brawn',      fixedAtCreation: true,  raisedBy: 'Toughened (+2 per rank)', cite: '§6', ruling: 'R-1' },
  { id: 'strainThreshold',      name: 'Strain Threshold',      formula: 'BASE_STRAIN_THRESHOLD + Willpower', fixedAtCreation: true,  raisedBy: 'Grit (+1 per rank)',      cite: '§6', ruling: 'R-1' },
  { id: 'soak',                 name: 'Soak',                  formula: 'Brawn + armour soak',               fixedAtCreation: false, note: 'Recalculates live with Brawn, unlike the two thresholds.', cite: '§6' },
  { id: 'meleeDefense',         name: 'Melee Defence',         formula: '0 + armour + cover + talents',      cite: '§6' },
  { id: 'rangedDefense',        name: 'Ranged Defence',        formula: '0 + armour + cover + talents',      cite: '§6' },
  { id: 'encumbranceThreshold', name: 'Encumbrance Threshold', formula: '5 + Brawn',                         cite: '§5F' },
  { id: 'incapacitated',        name: 'Incapacitated',         formula: 'wounds >= wound threshold OR strain >= strain threshold', cite: '§6' },
  { id: 'hardPoints',           name: 'Hard points',           formula: 'ceil(base encumbrance / 2)',        cite: '§14C' },
  { id: 'weaponDamage',         name: 'Weapon damage',         formula: 'weapon base + 1 per uncancelled Success', cite: '§5B' },
  { id: 'unarmedDamage',        name: 'Unarmed damage',        formula: 'Brawn',                             cite: '§5H' },
  { id: 'criticalModifier',     name: 'Critical Injury modifier', formula: '+10 per untreated Critical Injury', cite: '§5G' },
  { id: 'vehicleThresholds',    name: 'Vehicle hull and system strain', formula: 'Printed per vehicle, not derived', cite: '§12' }
];

// T24 — XP costs and gates — §7
export const XP_COSTS = {
  cite: '§7',
  startingXp: 70, // §13
  characteristic: { formula: 'newRating * 10', creationOnly: true, sequential: true, cost: (newRating) => newRating * 10 },
  careerSkill:    { formula: 'newRank * 5',  cost: (newRank) => newRank * 5 },
  nonCareerSkill: { formula: 'newRank * 5 + 5', cost: (newRank) => newRank * 5 + 5 },
  talent:         { formula: 'tier * 5', cost: (tier) => tier * 5 },
  gates: [
    'Skill ranks cannot exceed 2 during character creation, whatever the source.',
    'Characteristics can only be raised during creation — afterwards only Dedication raises one, to a maximum of 5, and never the same characteristic twice.',
    'Talent pyramid: before holding N talents in a tier, hold at least N in the tier below.',
    'Each purchase of a ranked talent beyond the first counts as belonging to the next tier up for pyramid purposes; cost stops rising at tier 5.'
  ]
};

// T25 — Story Points — §8
export const STORY_POINTS = {
  cite: '§8',
  startingPlayerPoolPerPc: 1,
  startingPlayerPoolAlternative: 2, // §8 notes some tables use 2
  startingGmPool: 0, // R-4
  ruling: 'R-4',
  playerSpends: [
    { id: 'upgradeDowngrade', label: 'Upgrade or downgrade one die once on a check' },
    { id: 'addDie',           label: 'Add one Boost or one Setback die' },
    { id: 'narrate',          label: 'Narrate a minor established detail into the scene' },
    { id: 'attemptImpossible', label: 'Attempt an otherwise Impossible check' }
  ],
  gmSpends: [
    { id: 'upgradeDowngrade', label: 'Upgrade or downgrade one die once, against the players' },
    { id: 'addDie',           label: 'Add one Setback or Boost die, against the players' },
    { id: 'narrate',          label: 'Narrate a complication' },
    { id: 'upgradeDifficulty', label: 'Upgrade a Difficulty die' }
  ],
  flow: 'A spent point moves to the other pool once its effect resolves, so the total in circulation is the effective cap.',
  reset: 'Unspent points carry over between sessions unless the GM rules otherwise.',
  otherMovers: ['Critical Injury 26–30, Discouraging Wound, moves one point from the player pool to the GM pool, or the reverse if the target is an NPC.'],
  talentSpends: ['luckyStrike', 'grenadier', 'heroicWill', 'indomitable']
};

// T26 — Critical Injury table — §9
// R-14: the app indexes roll + modifiers, which is how results past 100 are reached.
export const CRITICAL_INJURIES = [
  { min: 1,   max: 5,   severity: 'easy',     name: 'Minor Nick',          effect: 'Suffer 1 strain.', duration: 'immediate', apply: { strain: 1 } },
  { min: 6,   max: 10,  severity: 'easy',     name: 'Slowed Down',         effect: 'Act in the last allied Initiative slot next turn.', duration: 'nextTurn', condition: 'slowed' },
  { min: 11,  max: 15,  severity: 'easy',     name: 'Sudden Jolt',         effect: 'Drop whatever is being held.', duration: 'immediate' },
  { min: 16,  max: 20,  severity: 'easy',     name: 'Distracted',          effect: 'No free maneuver next turn.', duration: 'nextTurn', condition: 'noFreeManeuver' },
  { min: 21,  max: 25,  severity: 'easy',     name: 'Off-Balance',         effect: 'One Setback on the next skill check.', duration: 'nextCheck', dice: { setback: 1 } },
  { min: 26,  max: 30,  severity: 'easy',     name: 'Discouraging Wound',  effect: 'Move one Story Point from the player pool to the GM pool, or the reverse if the target is an NPC.', duration: 'immediate', storyPointShift: 1 },
  { min: 31,  max: 35,  severity: 'easy',     name: 'Stunned',             effect: 'Staggered until the end of the next turn.', duration: 'nextTurn', condition: 'staggered' },
  { min: 36,  max: 40,  severity: 'easy',     name: 'Stinger',             effect: '+1 difficulty on the next check.', duration: 'nextCheck', difficultySteps: 1 },
  { min: 41,  max: 45,  severity: 'average',  name: 'Bowled Over',         effect: 'Knocked prone and suffer 1 strain.', duration: 'immediate', condition: 'prone', apply: { strain: 1 } },
  { min: 46,  max: 50,  severity: 'average',  name: 'Head Ringer',         effect: '+1 difficulty on all Intellect and Cunning checks until healed.', duration: 'untilHealed', difficultySteps: 1, characteristics: ['intellect', 'cunning'] },
  { min: 51,  max: 55,  severity: 'average',  name: 'Fearsome Wound',      effect: '+1 difficulty on all Presence and Willpower checks until healed.', duration: 'untilHealed', difficultySteps: 1, characteristics: ['presence', 'willpower'] },
  { min: 56,  max: 60,  severity: 'average',  name: 'Agonizing Wound',     effect: '+1 difficulty on all Brawn and Agility checks until healed.', duration: 'untilHealed', difficultySteps: 1, characteristics: ['brawn', 'agility'] },
  { min: 61,  max: 65,  severity: 'average',  name: 'Slightly Dazed',      effect: 'Disoriented until healed.', duration: 'untilHealed', condition: 'disoriented' },
  { min: 66,  max: 70,  severity: 'average',  name: 'Scattered Senses',    effect: 'Remove all Setback dice from checks until healed.', duration: 'untilHealed', condition: 'scatteredSenses' },
  { min: 71,  max: 75,  severity: 'average',  name: 'Hamstrung',           effect: 'Lose the free maneuver until healed.', duration: 'untilHealed', condition: 'noFreeManeuver' },
  { min: 76,  max: 80,  severity: 'average',  name: 'Overpowered',         effect: 'The attacker immediately makes one extra attack with the same pool.', duration: 'immediate' },
  { min: 81,  max: 85,  severity: 'average',  name: 'Winded',              effect: 'Cannot voluntarily suffer strain for extra maneuvers or abilities until healed.', duration: 'untilHealed', condition: 'winded' },
  { min: 86,  max: 90,  severity: 'average',  name: 'Compromised',         effect: '+1 difficulty on all skill checks until healed.', duration: 'untilHealed', difficultySteps: 1 },
  { min: 91,  max: 95,  severity: 'hard',     name: 'At the Brink',        effect: 'Suffer 2 strain per action until healed.', duration: 'untilHealed', condition: 'atTheBrink' },
  { min: 96,  max: 100, severity: 'hard',     name: 'Crippled',            effect: 'One limb is impaired: +1 difficulty on checks that need it, until healed.', duration: 'untilHealed', difficultySteps: 1 },
  { min: 101, max: 105, severity: 'hard',     name: 'Maimed',              effect: 'The limb is permanently lost barring a prosthetic; other actions gain one Boost until healed.', duration: 'permanent' },
  { min: 106, max: 110, severity: 'hard',     name: 'Horrific Injury',     effect: 'Roll 1d10: one characteristic drops by 1 until healed (1–3 Brawn, 4–6 Agility, 7 Intellect, 8 Cunning, 9 Presence, 10 Willpower).', duration: 'untilHealed', rollCharacteristic: true },
  { min: 111, max: 115, severity: 'hard',     name: 'Temporarily Disabled', effect: 'Immobilised until healed.', duration: 'untilHealed', condition: 'immobilised' },
  { min: 116, max: 120, severity: 'hard',     name: 'Blinded',             effect: 'Upgrade the difficulty of all checks twice, and of Perception and Vigilance three times, until healed.', duration: 'untilHealed', condition: 'blinded' },
  { min: 121, max: 125, severity: 'hard',     name: 'Knocked Senseless',   effect: 'Staggered until healed.', duration: 'untilHealed', condition: 'staggered' },
  { min: 126, max: 130, severity: 'daunting', name: 'Gruesome Injury',     effect: 'Roll 1d10 as above: that characteristic is permanently reduced by 1, to a minimum of 1.', duration: 'permanent', rollCharacteristic: true },
  { min: 131, max: 140, severity: 'daunting', name: 'Bleeding Out',        effect: 'Suffer 1 wound and 1 strain per turn until healed. Reaching 5 wounds beyond the threshold triggers another Critical Injury roll.', duration: 'untilHealed', death: 'bleedingOut' },
  { min: 141, max: 150, severity: 'daunting', name: 'The End Is Nigh',     effect: 'The character dies at the end of the next round unless healed first.', duration: 'countdown', death: 'endIsNigh', roundsRemaining: 1 },
  { min: 151, max: 9999, severity: 'fatal',   name: 'Dead',                effect: 'Dead. Cannot be revived.', duration: 'permanent', death: 'dead' }
];

export const CRITICAL_INJURY_RULES = {
  cite: '§9, §5B, §5G, §5I',
  roll: 'd100',
  triggers: [
    'Uncancelled Advantage meets or exceeds the weapon\'s Crit rating',
    'Spending two Advantage on a damaging hit',
    'An uncancelled Despair'
  ],
  modifiers: [
    { id: 'untreatedInjuries', label: '+10 per untreated Critical Injury already suffered', perUnit: 10, cite: '§5G' },
    { id: 'vicious',           label: '+10 per rank of Vicious', perUnit: 10, cite: '§10' },
    { id: 'durable',           label: '−10 per rank of Durable, to a minimum result of 01', perUnit: -10, floor: 1, cite: '§12A' },
    { id: 'longFall',          label: '+50 for a long fall', value: 50, cite: '§5I' },
    { id: 'extremeFall',       label: '+75 for an extreme fall', value: 75, cite: '§5I' }
  ],
  ruling: 'R-14',
  minionRule: 'Any Critical Injury result instantly takes one minion out of the fight; the group takes that minion\'s wound share plus one.', // §12C
  rivalRule: 'The GM may rule a rival killed outright rather than incapacitated once their Wound Threshold is exceeded.' // §12C
};

// T27 — Item qualities — §10
export const ITEM_QUALITIES = [
  { id: 'accurate',    name: 'Accurate X',     type: 'passive', effect: 'Adds X Boost dice to combat checks with this weapon.' },
  { id: 'autofire',    name: 'Auto-fire',      type: 'active',  cost: { advantage: 2 }, effect: 'Spend two Advantage for an extra hit, repeatable. Adds +1 difficulty to use, and hits may be spread across designated targets.' },
  { id: 'blast',       name: 'Blast X',        type: 'active',  cost: { advantage: 3, onMissOnly: true }, effect: 'On a hit, everyone engaged with the target takes X plus uncancelled Success damage. On a miss it can still be triggered by spending three Advantage.' },
  { id: 'breach',      name: 'Breach X',       type: 'passive', effect: 'Ignores X points of vehicle armour, counting 10 soak per point against personal-scale targets.' },
  { id: 'burn',        name: 'Burn X',         type: 'active',  effect: 'The target takes the weapon\'s base damage each turn for X rounds; a Coordination check or immersion in water stops it.', condition: 'burning' },
  { id: 'concussive',  name: 'Concussive X',   type: 'active',  effect: 'The target is staggered for X rounds.', condition: 'staggered' },
  { id: 'cumbersome',  name: 'Cumbersome X',   type: 'passive', effect: 'Needs Brawn of at least X, or +1 difficulty per point short.' },
  { id: 'defensive',   name: 'Defensive X',    type: 'passive', effect: 'Grants the wielder +X melee defence.' },
  { id: 'deflection',  name: 'Deflection X',   type: 'passive', effect: 'Grants the wielder +X ranged defence.' },
  { id: 'disorient',   name: 'Disorient X',    type: 'active',  effect: 'The target adds one Setback to all checks for X rounds.', condition: 'disoriented' },
  { id: 'ensnare',     name: 'Ensnare X',      type: 'active',  effect: 'The target is immobilised for X rounds; a Hard Athletics check breaks free early.', condition: 'immobilised' },
  { id: 'guided',      name: 'Guided X',       type: 'active',  cost: { advantage: 3 }, effect: 'After a miss, spend three Advantage to attempt a follow-up Average combat check as an out-of-turn incidental, rolling X dice instead of the usual pool.' },
  { id: 'inaccurate',  name: 'Inaccurate X',   type: 'passive', effect: 'Adds X Setback dice to combat checks with this weapon.' },
  { id: 'inferior',    name: 'Inferior',       type: 'passive', effect: 'Generates one automatic Threat on any check using it.' },
  { id: 'knockdown',   name: 'Knockdown',      type: 'active',  cost: { advantage: 2 }, effect: 'Spend two Advantage, plus one more per silhouette above 1, to knock the target prone.', condition: 'prone' },
  { id: 'limitedAmmo', name: 'Limited Ammo X', type: 'passive', effect: 'Only X attacks before a reload maneuver, or a fresh unit for one-shot items such as grenades.' },
  { id: 'linked',      name: 'Linked X',       type: 'active',  cost: { advantage: 2 }, effect: 'Spend two Advantage for an additional hit on the same target, up to X times.' },
  { id: 'pierce',      name: 'Pierce X',       type: 'passive', effect: 'Ignores X points of the target\'s soak.' },
  { id: 'prepare',     name: 'Prepare X',      type: 'passive', effect: 'Requires X preparation maneuvers before the first use.' },
  { id: 'reinforced',  name: 'Reinforced',     type: 'passive', effect: 'Weapons are immune to Sunder; armour soak is immune to Pierce and Breach.' },
  { id: 'slowFiring',  name: 'Slow-Firing X',  type: 'passive', effect: 'Must wait X rounds between shots.' },
  { id: 'stun',        name: 'Stun X',         type: 'active',  effect: 'Spend to inflict X strain, which soak does not reduce.' },
  { id: 'stunDamage',  name: 'Stun Damage',    type: 'passive', effect: 'Deals strain instead of wounds, and soak still applies.' },
  { id: 'sunder',      name: 'Sunder',         type: 'active',  cost: { advantage: 1 }, effect: 'Spend one Advantage to damage one of the target\'s items by one step; usable even on a miss.' },
  { id: 'superior',    name: 'Superior',       type: 'passive', effect: 'Generates one automatic Advantage on any check using it.' },
  { id: 'unwieldy',    name: 'Unwieldy X',     type: 'passive', effect: 'Needs Agility of at least X, or +1 difficulty per point short.' },
  { id: 'vicious',     name: 'Vicious X',      type: 'passive', effect: 'Adds 10 times X to the Critical Injury roll.' }
];

// T28 — Called shots and disabling attacks — §10A
export const CALLED_SHOTS = {
  cite: '§10A',
  declare: 'Chosen before the roll, aiming at a specific target such as a held weapon, a tyre, or a radio.',
  aimPenalty: 'Uses the Aim maneuver\'s targeted option: one maneuver of aiming this way adds two Setback to the following combat check, two consecutive aim maneuvers reduce that to one Setback.',
  payoff: 'On a hit, spending three Advantage (per §5C) disables the opponent or a piece of their gear instead of dealing normal wounds or strain.',
  limit: 'Effects should be temporary and proportionate, agreed between player and GM.'
};

// T29 — Social encounters — §11
export const SOCIAL_ENCOUNTERS = {
  cite: '§11',
  structure: 'Narrative by default; the GM may impose rounds for complex multi-NPC negotiations so everyone gets a turn.',
  goalBased: 'The GM defines the party\'s goal at the start; the encounter ends on clear success or clear failure.',
  paths: [
    { id: 'agreeable', name: 'Mutually agreeable solution', summary: 'No roll needed when the terms offered are simply acceptable. Good roleplay may still earn a Boost elsewhere.' },
    { id: 'opposed', name: 'Opposed social check', summary: 'The PC\'s social skill against the target\'s opposing skill, usually Discipline or Cool. This is the default method.', defaultOpposition: ['discipline', 'cool'] },
    { id: 'groupInfluence', name: 'Group influence', summary: 'Difficulty scales with the size of the audience.' }
  ],
  groupInfluenceLadder: [
    { audience: '2–5',  difficulty: 'average' },
    { audience: '6–15', difficulty: 'hard' },
    { audience: '16–50', difficulty: 'daunting' },
    { audience: '51+',  difficulty: 'formidable' }
  ],
  note: 'This subsystem underlies checkpoint interrogations, informant handling and Gestapo interviews.'
};

// T31 — Vehicles and chases — §12
export const VEHICLE_RULES = {
  cite: '§12',
  characteristics: [
    { id: 'handling',   name: 'Handling',   summary: 'A plus or minus modifier adding Boost or Setback dice to Driving and Piloting checks.' },
    { id: 'speed',      name: 'Speed',      summary: 'Current value from 0 up to the vehicle\'s maximum, changed with the Accelerate and Decelerate maneuvers.' },
    { id: 'silhouette', name: 'Silhouette', summary: 'Size: motorcycle 1, car 2, truck 2–3, train 4 or more.' },
    { id: 'armour',     name: 'Defence and armour', summary: 'The vehicle\'s soak equivalent.' },
    { id: 'hullTrauma', name: 'Hull Trauma Threshold', summary: 'The vehicle\'s wound threshold.' },
    { id: 'systemStrain', name: 'System Strain Threshold', summary: 'The vehicle\'s strain threshold — overheating and mechanical failure. Recovers 1 per day if undamaged, or through Damage Control.' }
  ],
  maneuvers: ['Accelerate', 'Decelerate', 'Evade', 'Reposition', 'Brace for Impact'],
  actions: ['Perform a combat check (ram or shoot)', 'Dangerous Driving', 'Gain the Advantage', 'Damage Control'],
  turnOrder: 'The pilot acts on their own turn using Driving or Piloting; passengers act independently on theirs.',
  scale: 'All vehicle weapon damage is treated as personal scale, using the standard five range bands.',
  crashes: 'Losing control — a failed Driving or Piloting check with Despair, or a GM call — inflicts hull trauma equal to current speed; occupants may take wounds or a Critical Injury roll as though from a fall.',
  mixedScale: 'Characters on foot act on their own turns while vehicles act on the pilot\'s. The silhouette rule applies, so infantry find vehicles easy to hit but hard to meaningfully damage.'
};

// T33 — Talents — §12A. All 71, tiers 1–5 (24 / 15 / 16 / 11 / 5).
// `settingApplicable: false` marks the 12 talents that reference content this setting
// does not have; they stay in the catalog for completeness and are hidden by default (R-11).
// `hook` names the automation the roller provides for the talent ("tap to use").
export const TALENT_RULES = {
  cite: '§12A, §7',
  costPerTier: [5, 10, 15, 20, 25],
  pyramid: 'Before holding N talents in a tier, hold at least N in the tier below.',
  rankedPyramid: 'Each purchase of a ranked talent past the first counts as belonging to the next tier up for pyramid purposes; cost stops rising once it reaches tier 5.'
};

export const TALENTS = [
  // ---- Tier 1 (24) ----
  { id: 'boughtInfo', name: 'Bought Info', tier: 1, ranked: false, activation: 'action', hook: 'autoSucceed',
    summary: 'Instead of rolling a knowledge check, spend currency equal to fifty times the check\'s difficulty and succeed automatically with one uncancelled Success. The GM may rule some information cannot be bought.' },
  { id: 'cleverRetort', name: 'Clever Retort', tier: 1, ranked: false, activation: 'incidentalOutOfTurn', hook: 'addSymbols', limit: 'perEncounter',
    summary: 'Once per encounter, add two automatic Threat to another character\'s social skill check.' },
  { id: 'defensiveSysops', name: 'Defensive Sysops', tier: 1, ranked: false, activation: 'passive', hook: 'addDiceToOpponent', settingApplicable: false, // R-11
    summary: 'Adds two Setback to checks made to intrude on a computer system your character defends or built, and your character notices any intrusion they have access to observe.' },
  { id: 'desperateRecovery', name: 'Desperate Recovery', tier: 1, ranked: false, activation: 'passive', hook: 'recoveryBonus',
    summary: 'When healing strain at the end of an encounter with strain above half the threshold, heal two more.' },
  { id: 'duelist', name: 'Duelist', tier: 1, ranked: false, activation: 'passive', hook: 'addDice',
    summary: 'Adds one Boost to melee checks while engaged with a single opponent, and one Setback to melee checks while engaged with three or more.' },
  { id: 'durable', name: 'Durable', tier: 1, ranked: true, activation: 'passive', hook: 'criticalModifier',
    summary: 'Reduces any Critical Injury result suffered by 10 per rank, to a minimum of 01.' },
  { id: 'forager', name: 'Forager', tier: 1, ranked: false, activation: 'passive', hook: 'removeDice',
    summary: 'Removes up to two Setback from checks to find food, water or shelter, and halves the time such searches take.' },
  { id: 'grit', name: 'Grit', tier: 1, ranked: true, activation: 'passive', hook: 'derivedBonus', derived: { strainThreshold: 1 },
    summary: 'Each rank raises the strain threshold by one.' },
  { id: 'hamstringShot', name: 'Hamstring Shot', tier: 1, ranked: false, activation: 'action', hook: 'specialAttack', limit: 'perRound',
    summary: 'Once per round, make a ranged combat check against a non-vehicle target. On success the damage is halved before soak and the target is immobilised until the end of its next turn.' },
  { id: 'jumpUp', name: 'Jump Up', tier: 1, ranked: false, activation: 'incidental', hook: 'stateChange', limit: 'perRound',
    summary: 'Once per round on your turn, stand from prone or seated as an incidental.' },
  { id: 'knackForIt', name: 'Knack For It', tier: 1, ranked: true, activation: 'passive', hook: 'removeDice', selects: 'skills',
    summary: 'Choose one skill on purchase and two more per later rank; remove two Setback from checks with those skills. Combat skills cannot be chosen.' },
  { id: 'knowSomebody', name: 'Know Somebody', tier: 1, ranked: true, activation: 'incidental', hook: 'rarityReduction', limit: 'perSession',
    summary: 'Once per session, reduce the rarity of a legally available item by one per rank when trying to buy it.' },
  { id: 'letsRide', name: 'Let\'s Ride', tier: 1, ranked: false, activation: 'incidental', hook: 'stateChange', limit: 'perRound',
    summary: 'Once per round on your turn, mount, dismount or move position within a vehicle as an incidental. A short-range fall from a vehicle or animal does no damage.' },
  { id: 'oneWithNature', name: 'One With Nature', tier: 1, ranked: false, activation: 'incidental', hook: 'recoverySubstitute',
    summary: 'In the wilderness, use a Simple Survival check instead of Discipline or Cool to recover strain at the end of an encounter.' },
  { id: 'parry', name: 'Parry', tier: 1, ranked: true, activation: 'incidentalOutOfTurn', hook: 'damageReduction', cost: { strain: 3 },
    summary: 'When hit by a melee attack, after damage is worked out but before soak, suffer 3 strain to cut the damage by two plus ranks in Parry. Once per hit, and a Melee weapon must be in hand.' },
  { id: 'properUpbringing', name: 'Proper Upbringing', tier: 1, ranked: true, activation: 'incidental', hook: 'addSymbols', cost: { strainPerRank: 1 },
    summary: 'On a social check in polite company, suffer any number of strain up to your ranks to add that many Advantage.' },
  { id: 'quickDraw', name: 'Quick Draw', tier: 1, ranked: false, activation: 'incidental', hook: 'stateChange', limit: 'perRound',
    summary: 'Once per round on your turn, draw or holster an accessible weapon or item as an incidental. Also lowers a weapon\'s Prepare rating by one, to a minimum of one.' },
  { id: 'quickStrike', name: 'Quick Strike', tier: 1, ranked: true, activation: 'passive', hook: 'addDice',
    summary: 'Adds one Boost per rank to combat checks against targets that have not yet taken a turn this encounter.' },
  { id: 'rapidReaction', name: 'Rapid Reaction', tier: 1, ranked: true, activation: 'incidentalOutOfTurn', hook: 'addSymbols', cost: { strainPerRank: 1 },
    summary: 'Suffer any number of strain up to your ranks to add that many Success to a Vigilance or Cool check for Initiative.' },
  { id: 'secondWind', name: 'Second Wind', tier: 1, ranked: true, activation: 'incidental', hook: 'healStrain', limit: 'perEncounter',
    summary: 'Once per encounter, heal strain equal to your ranks.' },
  { id: 'surgeon', name: 'Surgeon', tier: 1, ranked: true, activation: 'passive', hook: 'recoveryBonus',
    summary: 'A Medicine check to heal wounds restores one extra wound per rank.' },
  { id: 'swift', name: 'Swift', tier: 1, ranked: false, activation: 'passive', hook: 'movement',
    summary: 'Difficult terrain costs no extra maneuvers.' },
  { id: 'toughened', name: 'Toughened', tier: 1, ranked: true, activation: 'passive', hook: 'derivedBonus', derived: { woundThreshold: 2 },
    summary: 'Each rank raises the wound threshold by two.' },
  { id: 'unremarkable', name: 'Unremarkable', tier: 1, ranked: false, activation: 'passive', hook: 'addDiceToOpponent',
    summary: 'Others add one Setback to checks made to find or identify your character in a crowd.' },

  // ---- Tier 2 (15) ----
  { id: 'basicMilitaryTraining', name: 'Basic Military Training', tier: 2, ranked: false, activation: 'passive', hook: 'careerSkills',
    // R-2 — the manual writes "Ranged (Heavy)", a split this skill list does not have.
    grantsCareerSkills: ['athletics', 'ranged', 'resilience'], ruling: 'R-2',
    summary: 'Athletics, Ranged and Resilience become career skills.' },
  { id: 'berserk', name: 'Berserk', tier: 2, ranked: false, activation: 'maneuver', hook: 'stance', limit: 'perEncounter',
    summary: 'Once per encounter: until the encounter ends or you are incapacitated, add one Success and two Advantage to every melee check, but opponents add one Success to checks against you and you cannot make ranged checks. You suffer 6 strain when it ends.' },
  { id: 'coordinatedAssault', name: 'Coordinated Assault', tier: 2, ranked: true, activation: 'maneuver', hook: 'grantSymbols', limit: 'perTurn',
    summary: 'Once per turn, a number of engaged allies equal to your Leadership ranks add one Advantage to their combat checks until the end of your next turn. Range extends one band per rank past the first.' },
  { id: 'counteroffer', name: 'Counteroffer', tier: 2, ranked: false, activation: 'action', hook: 'opposedCheck', limit: 'perSession',
    summary: 'Once per session, make an opposed Negotiation against Discipline versus a non-nemesis adversary within medium range. On success they are staggered until the end of their next turn; a Triumph may turn them into an ally for the encounter, at GM discretion.' },
  { id: 'daringAviator', name: 'Daring Aviator', tier: 2, ranked: true, activation: 'incidental', hook: 'addSymbols', settingApplicable: false, // R-11
    summary: 'Before a Driving or Piloting check, add any number of Threat up to your ranks to add an equal number of Success.' },
  { id: 'defensiveStance', name: 'Defensive Stance', tier: 2, ranked: true, activation: 'maneuver', hook: 'upgradeOpponentDifficulty', cost: { strainPerRank: 1 }, limit: 'perRound',
    summary: 'Once per round, suffer strain up to your ranks; until the end of your next turn, upgrade the difficulty of melee checks against you that many times.' },
  { id: 'defensiveSysopsImproved', name: 'Defensive Sysops (Improved)', tier: 2, ranked: false, activation: 'incidental', hook: 'addSymbols', requires: 'defensiveSysops', settingApplicable: false, // R-11
    summary: 'Instead of adding Defensive Sysops\' two Setback, add one Failure and one Threat to the intruder\'s result.' },
  { id: 'dualWielder', name: 'Dual Wielder', tier: 2, ranked: false, activation: 'maneuver', hook: 'difficultyReduction',
    summary: 'Lowers the difficulty of the next combined two-weapon check made this turn by one.' },
  { id: 'fanTheHammer', name: 'Fan The Hammer', tier: 2, ranked: false, activation: 'incidental', hook: 'addQuality', limit: 'perEncounter',
    summary: 'Once per encounter, give a pistol the Auto-fire quality for one combat check; the weapon then runs out of ammunition as though an Out of Ammo result had come up.' },
  { id: 'heightenedAwareness', name: 'Heightened Awareness', tier: 2, ranked: false, activation: 'passive', hook: 'grantDice',
    summary: 'Allies within short range add one Boost to Perception and Vigilance checks; engaged allies add two.' },
  { id: 'inspiringRhetoric', name: 'Inspiring Rhetoric', tier: 2, ranked: false, activation: 'action', hook: 'groupHeal',
    summary: 'Make an Average Leadership check: each Success heals one strain on one ally within short range, and each Advantage heals one more strain on an already affected ally.' },
  { id: 'inventor', name: 'Inventor', tier: 2, ranked: true, activation: 'incidental', hook: 'addDice',
    summary: 'Add one Boost per rank to checks to build or modify items, and attempt to rebuild devices you have only heard described.' },
  { id: 'luckyStrike', name: 'Lucky Strike', tier: 2, ranked: false, activation: 'incidental', hook: 'damageBonus', cost: { storyPoint: 1 }, selects: 'characteristic',
    summary: 'After a successful combat check, spend a Story Point to add damage equal to your rating in a characteristic chosen when the talent was bought.' },
  { id: 'scathingTirade', name: 'Scathing Tirade', tier: 2, ranked: false, activation: 'action', hook: 'groupStrain',
    summary: 'Make an Average Coercion check: each Success inflicts one strain on an enemy within short range, and each Advantage inflicts one more on an already affected enemy.' },
  { id: 'sideStep', name: 'Side Step', tier: 2, ranked: true, activation: 'action', hook: 'upgradeOpponentDifficulty', cost: { strainPerRank: 1 }, limit: 'perRound',
    summary: 'Once per round, suffer strain up to your ranks; until the end of your next turn, upgrade the difficulty of ranged checks against you that many times.' },

  // ---- Tier 3 (16) ----
  { id: 'animalCompanion', name: 'Animal Companion', tier: 3, ranked: true, activation: 'passive', hook: 'companion', settingApplicable: false, // R-11
    summary: 'Bond with one animal of silhouette 0, raised by one per further rank. Once per round in structured play, spend a maneuver to have it take one action and one maneuver while within sight and hearing.' },
  { id: 'barrelRoll', name: 'Barrel Roll', tier: 3, ranked: false, activation: 'incidentalOutOfTurn', hook: 'damageReduction', settingApplicable: false, // R-11
    summary: 'While piloting an aircraft of silhouette 3 or less, spend 3 system strain when the vehicle is hit by a ranged attack to reduce the damage by your Piloting ranks, before armour.' },
  { id: 'distinctiveStyle', name: 'Distinctive Style', tier: 3, ranked: false, activation: 'incidental', hook: 'addSymbols', settingApplicable: false, // R-11
    summary: 'Before a Computers check to hack or break into a network, add two Success and two Threat to the result.' },
  { id: 'dodge', name: 'Dodge', tier: 3, ranked: true, activation: 'incidentalOutOfTurn', hook: 'upgradeOpponentDifficulty', cost: { strainPerRank: 1 },
    summary: 'When targeted by any combat check, suffer strain up to your ranks to upgrade that check\'s difficulty that many times.' },
  { id: 'eagleEyes', name: 'Eagle Eyes', tier: 3, ranked: false, activation: 'incidental', hook: 'rangeIncrease', limit: 'perEncounter',
    summary: 'Once per encounter, extend a weapon\'s range by one band, to a maximum of extreme, for one combat check.' },
  { id: 'fieldCommander', name: 'Field Commander', tier: 3, ranked: false, activation: 'action', hook: 'grantManeuvers',
    summary: 'Make an Average Leadership check; on success, allies equal to your Presence may each suffer 1 strain to take a maneuver out of turn.' },
  { id: 'forgotToCount', name: 'Forgot To Count?', tier: 3, ranked: false, activation: 'incidentalOutOfTurn', hook: 'spendOpponentThreat',
    summary: 'Spend two Threat from an opponent\'s ranged combat check to make their weapon run out of ammunition, if it can.' },
  { id: 'fullThrottle', name: 'Full Throttle', tier: 3, ranked: false, activation: 'action', hook: 'vehicleBoost', settingApplicable: false, // R-11
    summary: 'Make a Hard Piloting or Driving check; on success the vehicle\'s top speed rises by one, to a maximum of 5, for rounds equal to your Cunning.' },
  { id: 'grenadier', name: 'Grenadier', tier: 3, ranked: true, activation: 'incidental', hook: 'triggerQuality', cost: { storyPoint: 1 },
    summary: 'Spend a Story Point to trigger a weapon\'s Blast quality without spending Advantage, even on a miss. Grenades count as having medium range.' },
  { id: 'heroicWill', name: 'Heroic Will', tier: 3, ranked: false, activation: 'incidentalOutOfTurn', hook: 'ignoreCriticals', cost: { storyPoint: 1 }, selects: 'twoCharacteristics',
    summary: 'Spend a Story Point to ignore the effects of all Critical Injuries on checks using two characteristics chosen when the talent was bought, until the encounter ends. The injuries themselves remain.' },
  { id: 'inspiringRhetoricImproved', name: 'Inspiring Rhetoric (Improved)', tier: 3, ranked: false, activation: 'passive', hook: 'grantDice', requires: 'inspiringRhetoric',
    summary: 'Allies affected by your Inspiring Rhetoric add one Boost to all skill checks for rounds equal to your Leadership ranks.' },
  { id: 'natural', name: 'Natural', tier: 3, ranked: false, activation: 'incidental', hook: 'reroll', limit: 'perSession', selects: 'twoSkills',
    summary: 'Once per session, reroll one skill check using either of two skills chosen when the talent was bought.' },
  { id: 'painkillerSpecialization', name: 'Painkiller Specialization', tier: 3, ranked: true, activation: 'passive', hook: 'recoveryBonus',
    summary: 'Painkillers heal one extra wound per rank. The sixth and later doses in a day still do nothing.' },
  { id: 'parryImproved', name: 'Parry (Improved)', tier: 3, ranked: false, activation: 'incidentalOutOfTurn', hook: 'counterAttack', requires: 'parry',
    summary: 'After using Parry, spend one Despair or three Threat from the attacker\'s check to hit them automatically with a Brawl or Melee weapon for its base damage plus applicable bonuses. Not usable if the attack incapacitated you.' },
  { id: 'rapidArchery', name: 'Rapid Archery', tier: 3, ranked: false, activation: 'maneuver', hook: 'addQuality', cost: { strain: 2 }, settingApplicable: false, // R-11
    summary: 'Suffer 2 strain to give a bow the Linked quality equal to your Ranged ranks for your next ranged check this turn.' },
  { id: 'scathingTiradeImproved', name: 'Scathing Tirade (Improved)', tier: 3, ranked: false, activation: 'passive', hook: 'addDiceToOpponent', requires: 'scathingTirade',
    summary: 'Enemies affected by your Scathing Tirade add one Setback to all skill checks for rounds equal to your Coercion ranks.' },

  // ---- Tier 4 (11) ----
  { id: 'cantWeTalkAboutThis', name: 'Can\'t We Talk About This?', tier: 4, ranked: false, activation: 'action', hook: 'opposedCheck',
    summary: 'Opposed Charm or Deception against Discipline versus one non-nemesis adversary within medium range. On success they cannot act against you until the end of their next turn; two Advantage extends it a turn, a Triumph extends it to their identified allies within short range. It ends if you or a known ally attacks them.' },
  { id: 'deadeye', name: 'Deadeye', tier: 4, ranked: false, activation: 'incidental', hook: 'criticalSelect', cost: { strain: 2 },
    summary: 'After rolling a Critical Injury inflicted with a ranged weapon, suffer 2 strain to swap it for any injury of the same severity.' },
  { id: 'defensive', name: 'Defensive', tier: 4, ranked: true, activation: 'passive', hook: 'derivedBonus', derived: { meleeDefense: 1, rangedDefense: 1 },
    summary: 'Each rank raises melee defence and ranged defence by one.' },
  { id: 'defensiveDriving', name: 'Defensive Driving', tier: 4, ranked: true, activation: 'passive', hook: 'vehicleDefense', settingApplicable: false, // R-11
    summary: 'Raises the defence of any vehicle you pilot by one per rank.' },
  { id: 'enduring', name: 'Enduring', tier: 4, ranked: true, activation: 'passive', hook: 'derivedBonus', derived: { soak: 1 },
    summary: 'Each rank raises soak by one.' },
  { id: 'fieldCommanderImproved', name: 'Field Commander (Improved)', tier: 4, ranked: false, activation: 'passive', hook: 'grantManeuvers', requires: 'fieldCommander',
    summary: 'Field Commander affects twice your Presence in allies, and a Triumph lets one ally suffer 1 strain to take an action instead of a maneuver.' },
  { id: 'howConvenient', name: 'How Convenient!', tier: 4, ranked: false, activation: 'action', hook: 'narrative', limit: 'perSession',
    summary: 'Once per session, make a Hard Mechanics check; on success one device in the encounter fails, subject to GM approval.' },
  { id: 'inspiringRhetoricSupreme', name: 'Inspiring Rhetoric (Supreme)', tier: 4, ranked: false, activation: 'incidental', hook: 'activationChange', requires: 'inspiringRhetoric', cost: { strain: 1 },
    summary: 'Suffer 1 strain to use Inspiring Rhetoric as a maneuver rather than an action.' },
  { id: 'madInventor', name: 'Mad Inventor', tier: 4, ranked: false, activation: 'action', hook: 'crafting', limit: 'perSession', settingApplicable: false, // R-11
    summary: 'Once per session, make a Mechanics check at a difficulty set by the item\'s rarity to improvise a functional equivalent of an item from salvage. A Despair may make the result dangerous to use.',
    rarityLadder: [ { rarity: '0–2', difficulty: 'easy' }, { rarity: '3–4', difficulty: 'average' }, { rarity: '5–6', difficulty: 'hard' }, { rarity: '7', difficulty: 'daunting' }, { rarity: '8', difficulty: 'formidable' }, { rarity: '9+', difficulty: 'impossible' } ] },
  { id: 'overcharge', name: 'Overcharge', tier: 4, ranked: false, activation: 'action', hook: 'implantBoost', limit: 'perEncounter', settingApplicable: false, // R-11
    summary: 'Once per encounter, make a Hard Mechanics check to push a cybernetic implant so its bonus doubles until the encounter ends. A Despair or three Threat burns it out until repaired.' },
  { id: 'scathingTiradeSupreme', name: 'Scathing Tirade (Supreme)', tier: 4, ranked: false, activation: 'incidental', hook: 'activationChange', requires: 'scathingTirade', cost: { strain: 1 },
    summary: 'Suffer 1 strain to use Scathing Tirade as a maneuver rather than an action.' },

  // ---- Tier 5 (5) ----
  { id: 'dedication', name: 'Dedication', tier: 5, ranked: true, activation: 'passive', hook: 'characteristicIncrease',
    summary: 'Each rank raises one characteristic by one, never above 5, and never the same characteristic twice.' },
  { id: 'indomitable', name: 'Indomitable', tier: 5, ranked: false, activation: 'incidentalOutOfTurn', hook: 'delayIncapacitation', cost: { storyPoint: 1 }, limit: 'perEncounter',
    summary: 'Once per encounter, when you would be incapacitated by exceeding a threshold, spend a Story Point to delay it until the end of your next turn. Drop back below the threshold in time and it is cancelled entirely.' },
  { id: 'master', name: 'Master', tier: 5, ranked: false, activation: 'incidental', hook: 'difficultyReduction', cost: { strain: 2 }, limit: 'perRound', selects: 'skill',
    summary: 'Once per round, suffer 2 strain to lower the difficulty of your next check with a chosen skill by two, to a minimum of Easy.' },
  { id: 'overchargeImproved', name: 'Overcharge (Improved)', tier: 5, ranked: false, activation: 'passive', hook: 'extraAction', requires: 'overcharge', settingApplicable: false, // R-11
    summary: 'Spend two Advantage or a Triumph from the Overcharge check to take one extra action immediately. Once per check.' },
  { id: 'ruinousRepartee', name: 'Ruinous Repartee', tier: 5, ranked: false, activation: 'action', hook: 'opposedCheck', limit: 'perEncounter',
    summary: 'Once per encounter, opposed Charm or Coercion against Discipline versus one character within medium range or earshot. On success they suffer strain equal to twice your Presence plus one per Success, and you heal the same amount of strain.' }
].map(t => ({ settingApplicable: true, ranked: false, ...t }));

// T34 — Motivation tables — §12B. Rolled on d10 (R-10) or chosen.
export const MOTIVATIONS = {
  cite: '§12B',
  note: 'Motivation facets are social-encounter targets and earn bonus XP at session end when played to.',
  desire: [
    { roll: 1, name: 'Ambition', detail: 'Power or status' },
    { roll: 2, name: 'Belonging', detail: 'Acceptance by a community' },
    { roll: 3, name: 'Expertise', detail: 'Mastery of a craft' },
    { roll: 4, name: 'Fame', detail: 'Recognition' },
    { roll: 5, name: 'Justice', detail: 'Fair treatment for everyone' },
    { roll: 6, name: 'Knowledge', detail: 'Uncovering hidden truths' },
    { roll: 7, name: 'Love', detail: 'Romantic connection' },
    { roll: 8, name: 'Safety', detail: 'Peace, security, shelter' },
    { roll: 9, name: 'Vengeance', detail: 'Repaying a past wrong' },
    { roll: 10, name: 'Wealth', detail: 'Money and possessions' }
  ],
  fear: [
    { roll: 1, name: 'Change', detail: 'Losing stability' },
    { roll: 2, name: 'Commitment', detail: 'Being relied upon' },
    { roll: 3, name: 'Death', detail: '' },
    { roll: 4, name: 'Expression', detail: 'A hidden private truth' },
    { roll: 5, name: 'Failure', detail: '' },
    { roll: 6, name: 'Humiliation', detail: 'Being seen as wrong or foolish' },
    { roll: 7, name: 'Isolation', detail: 'Dying alone' },
    { roll: 8, name: 'Nemesis', detail: 'One specific dreaded foe' },
    { roll: 9, name: 'Obscurity', detail: 'Being forgotten' },
    { roll: 10, name: 'Poverty', detail: 'Being without' }
  ],
  strength: [
    { roll: 1, name: 'Adaptable' }, { roll: 2, name: 'Analytical' }, { roll: 3, name: 'Courageous' },
    { roll: 4, name: 'Curious' }, { roll: 5, name: 'Idealistic' }, { roll: 6, name: 'Independent' },
    { roll: 7, name: 'Patient' }, { roll: 8, name: 'Spiritual' }, { roll: 9, name: 'Wise' }, { roll: 10, name: 'Witty' }
  ],
  flaw: [
    { roll: 1, name: 'Anger', detail: 'Resorts to force' },
    { roll: 2, name: 'Compulsion', detail: 'Addiction or obsession' },
    { roll: 3, name: 'Deception', detail: 'Disloyal, a compulsive liar' },
    { roll: 4, name: 'Greed', detail: '' },
    { roll: 5, name: 'Laziness', detail: '' },
    { roll: 6, name: 'Ignorance', detail: '' },
    { roll: 7, name: 'Intolerance', detail: 'Prejudice toward a group' },
    { roll: 8, name: 'Pride', detail: 'Arrogance and vanity' },
    { roll: 9, name: 'Recklessness', detail: 'Acts without weighing consequences' },
    { roll: 10, name: 'Vanity', detail: 'Obsessed with appearance or reputation' }
  ]
};

// T35 — Creation procedure — §13
export const CREATION_STEPS = [
  { id: 'career', name: 'Career', summary: 'Choose one of eleven careers and pick four of its eight listed skills, gaining rank 1 in each before spending XP. All eight stay career-priced afterwards.', cite: '§13, §14' },
  { id: 'xp', name: 'Spend 70 XP', summary: 'Every PC gets the same 70 XP. Skill ranks cannot pass 2 during creation and characteristics can only be raised here.', cite: '§13, §7' },
  { id: 'derived', name: 'Derived attributes', summary: 'Compute wound and strain thresholds, soak, defences and encumbrance after the XP spend.', cite: '§6' },
  { id: 'motivation', name: 'Motivation', summary: 'One Desire, one Fear, one Strength and one Flaw, rolled or chosen.', cite: '§12B' },
  { id: 'gear', name: 'Gear', summary: 'Spend the starting budget or pick from the gear list.', cite: '§13, §15', ruling: 'R-8' }
];

export const CREATION_RULES = {
  cite: '§13',
  startingXp: 70,
  allHuman: 'Every PC is human; this setting has no other species.',
  characteristicFloor: CHARACTERISTIC_MIN, // R-5
  skillRankCap: SKILL_RANK_MAX_AT_CREATION,
  careerSkillPicks: 4,
  // R-8 — the manual states neither a budget nor a currency name. House aid, labelled as one.
  houseAid: { currencyLabel: 'credits', startingBudget: 500, ruling: 'R-8', badge: 'House aid — not a printed rule' }
};

// T36 — Careers — §14. Eight listed skills each; the player picks four at rank 1.
export const CAREERS = [
  { id: 'resistanceRunner', name: 'Resistance Runner',
    skills: ['deception', 'skulduggery', 'streetwise', 'stealth', 'coordination', 'cool', 'knowledge', 'vigilance'],
    summary: 'Couriers, smugglers and cell organisers moving people, documents and matériel through occupied territory.',
    suggestedMotivation: { desire: 'Free a specific person or place', fear: 'Betrayal from inside their own cell' } },
  { id: 'sdGestapoAgent', name: 'SD/Gestapo Agent',
    skills: ['coercion', 'perception', 'vigilance', 'knowledge', 'discipline', 'ranged', 'streetwise', 'leadership'],
    summary: 'Security-service operatives: investigators, handlers or interrogators — true believers, careerists, or the newly disillusioned.',
    suggestedMotivation: { strength: 'Institutional knowledge and access', flaw: 'Complicity and guilt' } },
  { id: 'wehrmachtVeteran', name: 'Wehrmacht Veteran',
    skills: ['athletics', 'discipline', 'ranged', 'melee', 'resilience', 'survival', 'leadership', 'mechanics'],
    summary: 'Former or serving soldiers with hard combat competence and access to military logistics.',
    suggestedMotivation: { desire: 'Protect surviving comrades', fear: 'Repeating past atrocities' } },
  { id: 'blackMarketFixer', name: 'Black-Market Fixer',
    skills: ['negotiation', 'streetwise', 'deception', 'skulduggery', 'charm', 'knowledge', 'perception', 'coordination'],
    summary: 'Traders in the grey economy — ration cards, medicine, exit visas, information.',
    suggestedMotivation: { desire: 'Accumulate leverage and wealth', flaw: 'Greed overriding caution' } },
  { id: 'partyBureaucrat', name: 'Party Bureaucrat',
    skills: ['knowledge', 'charm', 'deception', 'cool', 'negotiation', 'leadership', 'perception', 'discipline'],
    summary: 'Civil administrators with access to records, permits and quotas — often the first to see the rot from inside.',
    suggestedMotivation: { fear: 'Exposure of past compliance', strength: 'Bureaucratic access others lack' } },
  { id: 'displacedSurvivor', name: 'Displaced Survivor',
    skills: ['survival', 'resilience', 'stealth', 'streetwise', 'coordination', 'vigilance', 'medicine', 'athletics'],
    summary: 'Refugees and escapees living outside the registered population, with no legal identity.',
    suggestedMotivation: { desire: 'Reach safety or reunite with family', fear: 'Recapture' } },
  { id: 'forger', name: 'Forger',
    skills: ['skulduggery', 'knowledge', 'perception', 'coordination', 'deception', 'streetwise', 'vigilance', 'discipline'],
    summary: 'Engravers, printers and calligraphers turned counterfeiters of papers, stamps and permits.',
    suggestedMotivation: { strength: 'Meticulous craft', fear: 'One flawed forgery getting someone killed' } },
  { id: 'fieldMedic', name: 'Field Medic',
    skills: ['medicine', 'resilience', 'knowledge', 'cool', 'perception', 'discipline', 'streetwise', 'survival'],
    summary: 'Doctors, nurses and corpsmen, some still in uniform, others working entirely off the books.',
    suggestedMotivation: { desire: 'Save lives regardless of side', flaw: 'Burnout and compassion fatigue' } },
  { id: 'smugglerPilot', name: 'Smuggler-Pilot',
    skills: ['piloting', 'driving', 'mechanics', 'streetwise', 'cool', 'perception', 'deception', 'athletics'],
    summary: 'Moves people and cargo past checkpoints and borders by road, rail or air.',
    suggestedMotivation: { desire: 'One last big run, then out', fear: 'Losing the vehicle and the livelihood' } },
  { id: 'foreignIntelligenceAsset', name: 'Foreign Intelligence Asset',
    skills: ['deception', 'knowledge', 'cool', 'streetwise', 'coercion', 'perception', 'skulduggery', 'leadership'],
    summary: 'Recruited or embedded operatives feeding information to foreign services, juggling two loyalties or none.',
    suggestedMotivation: { strength: 'Training and tradecraft', fear: 'Exposure to both sides at once' } },
  { id: 'collaborator', name: 'Collaborator',
    skills: ['charm', 'negotiation', 'knowledge', 'deception', 'leadership', 'perception', 'coercion', 'cool'],
    summary: 'Local officials, police or informants working with the regime for survival, advantage or belief.',
    suggestedMotivation: { fear: 'Losing status and protection', flaw: 'Self-justification' } }
];

// T37 — Rarity and purchasing — §14A
export const RARITY = {
  cite: '§14A',
  scale: '0 (trivial) to 10 (nearly impossible); the GM always has the final say on availability.',
  ladder: [
    { rarity: '0',    difficulty: 'simple',     examples: 'Pencil, ration book' },
    { rarity: '2–3',  difficulty: 'easy',       examples: 'Pocketknife, bicycle' },
    { rarity: '4–5',  difficulty: 'average',    examples: 'Pistol, passenger sedan, basic forged papers' },
    { rarity: '6–7',  difficulty: 'hard',       examples: 'Restricted radio, shortwave set, good forged papers' },
    { rarity: '8–9',  difficulty: 'daunting',   examples: 'Military-grade weapon in civilian hands, excellent forged papers' },
    { rarity: '10',   difficulty: 'formidable', examples: 'Armoured vehicle, direct access to classified files' }
  ],
  difficultyFor: (rarity) => rarity <= 1 ? 'simple' : rarity <= 3 ? 'easy' : rarity <= 5 ? 'average' : rarity <= 7 ? 'hard' : rarity <= 9 ? 'daunting' : 'formidable',
  skills: { legal: 'negotiation', illegal: 'streetwise' },
  modifiers: [
    { id: 'majorCity',   label: 'Major city or trading hub',        value: -1 },
    { id: 'midSize',     label: 'Mid-size city',                    value: 0 },
    { id: 'rural',       label: 'Rural or state-controlled economy', value: 1 },
    { id: 'frontier',    label: 'Frontier, or a restricted-ownership item', value: 2 },
    { id: 'crackdown',   label: 'Active security crackdown',        value: 3 },
    { id: 'lockdown',    label: 'Disaster or total lockdown zone',  value: 4 }
  ],
  aboveTen: 'Rarity past 10 stays Formidable, but the GM may upgrade the difficulty once per point over.',
  selling: [
    { result: 'Success',                     fraction: 0.25 },
    { result: 'Success with two Success',    fraction: 0.5 },
    { result: 'Success with three or more Success', fraction: 0.75 }
  ]
};

// T38 — Item damage and repair — §14B
export const ITEM_DAMAGE = {
  cite: '§14B',
  trigger: 'Three uncancelled Threat, or a Despair, on a check using a weapon or tool may break, jam or damage it — the GM decides.',
  levels: [
    { id: 'undamaged', name: 'Undamaged', repairDifficulty: null,      penalty: 'None',                 repairCostFraction: 0 },
    { id: 'minor',     name: 'Minor',     repairDifficulty: 'easy',    penalty: 'One Setback on use',   repairCostFraction: 0.25 },
    { id: 'moderate',  name: 'Moderate',  repairDifficulty: 'average', penalty: '+1 difficulty on use', repairCostFraction: 0.5 },
    { id: 'major',     name: 'Major',     repairDifficulty: 'hard',    penalty: 'Unusable',             repairCostFraction: 1.0 },
    { id: 'destroyed', name: 'Destroyed', repairDifficulty: null,      penalty: 'Beyond repair',        repairCostFraction: null }
  ],
  repair: {
    skill: 'mechanics',
    time: '1 to 2 hours per difficulty level',
    modifiers: [
      { id: 'halfTime', label: 'Working in half the time', difficultySteps: 1 },
      { id: 'noTools',  label: 'Without proper tools',     difficultySteps: 1 }
    ],
    cumulative: true,
    selfRepairDiscount: 'Self-repair cuts the cost by 10% per uncancelled Advantage on the repair check.'
  }
};

// T39 — Hard points and attachments — §14C
export const ATTACHMENTS = {
  cite: '§14C',
  hardPoints: 'Half the item\'s base encumbrance, rounded up, worked out before any attachment changes it.',
  hardPointsFor: (baseEncumbrance) => Math.ceil(baseEncumbrance / 2),
  installation: 'Roughly an hour of work plus a successful Average Mechanics check. Failure means it is not installed and may be retried; failure with two Threat destroys the attachment; success with a Threat means it works but may fail at a bad moment.',
  examples: [
    { id: 'suppressor',       name: 'Suppressor',                   hardPoints: 1, effect: 'One Boost on Stealth checks after firing, but one less damage.' },
    { id: 'scope',            name: 'Scope',                        hardPoints: 1, effect: 'Removes one Setback at long and extreme range.' },
    { id: 'hiddenCompartment', name: 'Hidden vehicle compartment',  hardPoints: 2, effect: 'Conceals small items from a routine search.' }
  ]
};

// T40 — Gear — §15. Seventeen entries; the table of contents claims eighteen (R-13).
export const GEAR = [
  { id: 'forgedPapers', name: 'Forged papers', variants: [ { grade: 'basic', rarity: 3 }, { grade: 'good', rarity: 5 }, { grade: 'excellent', rarity: 7 } ], encumbrance: 0,
    effect: 'Basic papers survive only a cursory glance; good papers survive a standard inspection with no die modifier; excellent papers survive cross-referencing against Reich records and grant one Boost. A forgery caught out is an automatic Personal Heat trigger whatever the roll.', heatHook: true },
  { id: 'rationCards', name: 'Ration cards (real or forged)', encumbrance: 0, rarity: null,
    effect: 'A currency substitute in scarcity zones. Real cards are tied to a registered identity; forged cards work as portable trade goods.' },
  { id: 'p38Pistol', name: 'Wehrmacht P38 pistol', encumbrance: 1, price: 350, rarity: 2,
    effect: 'Standard-issue sidearm. Common enough to pass unremarked on military or police characters, but a red flag on a civilian.' },
  { id: 'rifleVariants', name: 'Kar98k / StG rifle variants', encumbrance: '4–5', price: '700–900', rarity: 4,
    effect: 'Infantry rifles. Concealment is impractical — carrying one openly signals military affiliation or open resistance.' },
  { id: 'shortwaveRadio', name: 'Shortwave radio (concealable)', encumbrance: 2, price: 500, rarity: 6,
    effect: 'Reaches distant cells or foreign listening posts. Any transmission allows an opposed Perception check for signal-monitoring services; detection is an automatic +1 Personal Heat, or +2 if the traffic is incriminating.', heatHook: true },
  { id: 'cyanideCapsule', name: 'Cyanide capsule', encumbrance: 0, price: 0, rarity: 5,
    effect: 'A narrative item only: the last resort against capture. No mechanical effect beyond the GM\'s adjudication.' },
  { id: 'safehouseKit', name: 'Safehouse kit', encumbrance: 1, price: 150, rarity: 3,
    effect: 'Lockpicks and false-wall tools. One Boost on Skulduggery checks to hide people or things, or to breach and reseal a hiding place.' },
  { id: 'miniatureCamera', name: 'Miniature camera', encumbrance: 0, price: 400, rarity: 5,
    effect: 'For photographing documents. Developing film needs a darkroom or trusted contact, and each attempt is itself a surveilled-context check.', heatHook: true },
  { id: 'blackMarketMedicalKit', name: 'Black-market medical kit', encumbrance: 2, price: 300, rarity: 5,
    effect: 'A standard Medicine kit, but hard to source, and possessing one implies black-market contacts if found.' },
  { id: 'engravingKit', name: 'Engraving and printing tool kit', encumbrance: 3, price: 800, rarity: 6,
    effect: 'Professional forgery equipment: one Boost on Skulduggery checks to forge documents. Too bulky to move quickly, so it usually lives at a fixed safehouse.' },
  { id: 'fieldSurgeryKit', name: 'Field surgery kit', encumbrance: 3, price: 600, rarity: 6,
    effect: 'A fuller Medicine kit: removes the Setback normally applied for lacking equipment on Hard or harder Medicine checks.' },
  { id: 'listeningDevice', name: 'Listening device', encumbrance: 0, price: 350, rarity: 6,
    effect: 'Concealable audio surveillance. Planting one is a Skulduggery check opposed by the target\'s Vigilance; later discovery can raise Heat if traced back.', heatHook: true },
  { id: 'compassMaps', name: 'Compass and topographic maps', encumbrance: 1, price: 80, rarity: 2,
    effect: 'One Boost on Survival checks to navigate unfamiliar or rural terrain.' },
  { id: 'winterClothing', name: 'Winter and cold-weather gear', encumbrance: 2, price: 120, rarity: 1,
    effect: 'Removes the Setback that extreme cold imposes on physical checks.' },
  { id: 'partyBadge', name: 'Party membership badge', encumbrance: 0, price: 600, rarity: 8,
    effect: 'One Boost on Charm and Deception checks with lower-level officials who defer to Party rank. A forged badge failing a cross-check is a severe Heat trigger, treated as a caught forgery. Genuine badges cannot be bought.', heatHook: true },
  { id: 'phoneTapKit', name: 'Field telephone tap kit', encumbrance: 2, price: 450, rarity: 7,
    effect: 'Intercepts a landline. Needs physical access to the line and a Mechanics check to fit undetected.' },
  { id: 'documentPouch', name: 'Hidden document pouch', encumbrance: 0, price: 90, rarity: 3,
    effect: 'One Boost on checks to hide small items — papers, film, a pistol — from a routine pat-down. No help against a thorough search.' }
];

// T41 — Weapons — §15C
export const WEAPONS = [
  { id: 'unarmed',    name: 'Fist / unarmed',           skill: 'brawl',  damage: 'brawn', damageType: 'characteristic', crit: 5, range: 'engaged', encumbrance: 0, price: null, rarity: null, qualities: ['Knockdown'] },
  { id: 'knife',      name: 'Fighting knife',           skill: 'melee',  damage: 2, damageType: 'plusBrawn', crit: 3, range: 'engaged', encumbrance: 1, price: 25,  rarity: 1, qualities: ['Pierce 1'] },
  { id: 'truncheon',  name: 'Truncheon / club',         skill: 'melee',  damage: 2, damageType: 'plusBrawn', crit: 5, range: 'engaged', encumbrance: 2, price: 10,  rarity: 0, qualities: ['Disorient 2'] },
  { id: 'p38',        name: 'P38 pistol',               skill: 'ranged', damage: 6, crit: 3, range: 'medium', encumbrance: 1, price: 350, rarity: 2, qualities: [] },
  { id: 'sawnOff',    name: 'Sawn-off shotgun',         skill: 'ranged', damage: 8, crit: 3, range: 'short',  encumbrance: 3, price: 400, rarity: 3, qualities: ['Blast 4', 'Limited Ammo 2'] },
  { id: 'kar98k',     name: 'Kar98k rifle',             skill: 'ranged', damage: 9, crit: 3, range: 'long',   encumbrance: 4, price: 700, rarity: 4, qualities: ['Accurate 1'] },
  { id: 'stg',        name: 'StG assault rifle',        skill: 'ranged', damage: 9, crit: 3, range: 'medium', encumbrance: 5, price: 900, rarity: 5, restricted: true, qualities: ['Auto-fire'] },
  { id: 'mp40',       name: 'MP40 submachine gun',      skill: 'ranged', damage: 7, crit: 4, range: 'medium', encumbrance: 4, price: 600, rarity: 4, restricted: true, qualities: ['Auto-fire'] },
  { id: 'grenade',    name: 'Fragmentation grenade',    skill: 'ranged', damage: 8, crit: 4, range: 'short',  encumbrance: 1, price: 250, rarity: 5, restricted: true, qualities: ['Blast 6', 'Limited Ammo 1'] },
  { id: 'improvised', name: 'Improvised weapon',        skill: 'melee',  damage: 1, damageType: 'plusBrawn', crit: 5, range: 'engaged', encumbrance: 1, price: null, rarity: null, qualities: ['Inferior'] }
];

export const WEAPON_NOTE = 'Carrying a restricted weapon is itself grounds for a Personal Heat check if it is found during a papers check or search.'; // §15C

// T42 — Armour — §15D
export const ARMOUR = [
  { id: 'civilian',    name: 'Civilian clothing',                  defense: 0, soak: 0, encumbrance: 0, price: null, rarity: null, note: 'The baseline: no protection at all.' },
  { id: 'paddedCoat',  name: 'Padded coat or leather jacket',      defense: 0, soak: 1, encumbrance: 1, price: 60,  rarity: 1, note: 'Minor protection, draws no suspicion.' },
  { id: 'concealedVest', name: 'Concealed vest (improvised)',      defense: 0, soak: 1, encumbrance: 2, price: 150, rarity: 3, note: 'One Setback on Perception checks to notice it; illegal for civilians.' },
  { id: 'fieldUniform', name: 'Wehrmacht field uniform and webbing', defense: 0, soak: 1, encumbrance: 2, price: null, rarity: null, note: 'Issued. Signals military affiliation.' },
  { id: 'flakVest',    name: 'Flak vest (military issue)',         defense: 1, soak: 2, encumbrance: 3, price: 500, rarity: 5, restricted: true, note: 'Bulky: one Setback on Stealth.' },
  { id: 'securityVest', name: 'SS/security helmet and vest',       defense: 1, soak: 2, encumbrance: 4, price: null, rarity: null, note: 'Issued. Signals security-service affiliation.' }
];

// T43 — Vehicles — §15E
export const VEHICLES = [
  { id: 'bicycle',       name: 'Bicycle',                       silhouette: 1, handling: 0,  speed: 3, defense: 0, armour: 0, hull: 4,  systemStrain: 3,  price: 40,    rarity: 0 },
  { id: 'moped',         name: 'Moped / light scooter',         silhouette: 1, handling: 0,  speed: 4, defense: 0, armour: 0, hull: 6,  systemStrain: 6,  price: 300,   rarity: 1 },
  { id: 'motorcycle',    name: 'Motorcycle',                    silhouette: 1, handling: 1,  speed: 5, defense: 0, armour: 1, hull: 8,  systemStrain: 8,  price: 600,   rarity: 2 },
  { id: 'sidecar',       name: 'Motorcycle with sidecar',       silhouette: 2, handling: 0,  speed: 4, defense: 0, armour: 1, hull: 10, systemStrain: 9,  price: 900,   rarity: 2 },
  { id: 'economyCar',    name: 'Small economy car',             silhouette: 2, handling: 1,  speed: 4, defense: 0, armour: 1, hull: 12, systemStrain: 9,  price: 1800,  rarity: 2 },
  { id: 'sedan',         name: 'Passenger sedan',               silhouette: 2, handling: 0,  speed: 4, defense: 0, armour: 1, hull: 14, systemStrain: 10, price: 2500,  rarity: 2 },
  { id: 'taxi',          name: 'Taxi (modified sedan)',         silhouette: 2, handling: 0,  speed: 4, defense: 0, armour: 1, hull: 14, systemStrain: 10, price: 2600,  rarity: 2 },
  { id: 'deliveryVan',   name: 'Delivery van',                  silhouette: 2, handling: -1, speed: 3, defense: 0, armour: 1, hull: 18, systemStrain: 12, price: 3200,  rarity: 3 },
  { id: 'lorry',         name: 'Delivery truck / lorry',        silhouette: 2, handling: -1, speed: 3, defense: 0, armour: 2, hull: 22, systemStrain: 14, price: 4500,  rarity: 3 },
  { id: 'fishingBoat',   name: 'Fishing boat',                  silhouette: 2, handling: -1, speed: 3, defense: 0, armour: 1, hull: 20, systemStrain: 14, price: 3800,  rarity: 3 },
  { id: 'staffCar',      name: 'Wehrmacht staff car',           silhouette: 2, handling: 0,  speed: 4, defense: 0, armour: 2, hull: 16, systemStrain: 12, price: null, military: true, rarity: 4 },
  { id: 'troopTruck',    name: 'Wehrmacht troop transport',     silhouette: 3, handling: -1, speed: 3, defense: 0, armour: 2, hull: 26, systemStrain: 16, price: null, military: true, rarity: 5, restricted: true },
  { id: 'courierBike',   name: 'Motorcycle courier bike (SD)',  silhouette: 1, handling: 1,  speed: 5, defense: 0, armour: 1, hull: 8,  systemStrain: 8,  price: null, military: true, rarity: 5, restricted: true },
  { id: 'apc',           name: 'Armoured personnel transport',  silhouette: 3, handling: -2, speed: 3, defense: 1, armour: 4, hull: 30, systemStrain: 18, price: null, military: true, rarity: 6, restricted: true },
  { id: 'reconVehicle',  name: 'Light reconnaissance vehicle',  silhouette: 2, handling: 0,  speed: 5, defense: 0, armour: 2, hull: 18, systemStrain: 12, price: null, military: true, rarity: 6, restricted: true },
  { id: 'freightLoco',   name: 'Rail locomotive (freight)',     silhouette: 4, handling: -2, speed: 3, defense: 0, armour: 3, hull: 40, systemStrain: 20, price: null, stateOwned: true, rarity: null },
  { id: 'passengerLoco', name: 'Rail locomotive (passenger)',   silhouette: 4, handling: -2, speed: 4, defense: 0, armour: 2, hull: 36, systemStrain: 20, price: null, stateOwned: true, rarity: null }
];

export const VEHICLE_NOTE = 'Owning anything past a passenger sedan draws notice at checkpoints, and a military vehicle in civilian hands is an automatic Personal Heat trigger if discovered.'; // §15E

// T44 — Character sheet field reference — §16A
export const SHEET_FIELDS = {
  cite: '§16A',
  groups: [
    { id: 'identity', name: 'Identity', fields: ['Name', 'Player', 'Career', 'Species (human)', 'Motivation: Desire, Fear, Strength, Flaw'] },
    { id: 'characteristics', name: 'Characteristics', fields: ['Brawn', 'Agility', 'Intellect', 'Cunning', 'Willpower', 'Presence'] },
    { id: 'skills', name: 'Skills', fields: ['Rank 0–5 and whether the skill is a career skill'] },
    { id: 'derived', name: 'Derived attributes', fields: ['Wound Threshold and current wounds', 'Strain Threshold and current strain', 'Soak', 'Melee Defence', 'Ranged Defence'] },
    { id: 'xp', name: 'XP', fields: ['Total earned', 'Currently available'] },
    { id: 'talents', name: 'Talents', fields: ['Name, tier, rule reference, active or passive', 'Talent pyramid'] },
    { id: 'weapons', name: 'Weapons', fields: ['Name, skill, damage, crit rating, range, qualities'] },
    { id: 'gear', name: 'Gear log', fields: ['Weapons and armour', 'Personal gear', 'Money'] },
    { id: 'criticals', name: 'Critical Injuries', fields: ['Severity and result, tracked until healed'] },
    { id: 'reich62', name: 'Reich \'62 additions', fields: ['Personal Heat 0–5', 'Cell Heat 0–5 (shared)', 'Quality of forged papers carried'] }
  ]
};

// T45 — Heat — §17
export const HEAT = {
  cite: '§17',
  max: 5,
  min: 0,
  generation: {
    cite: '§17.1',
    scope: 'Only checks made in Reich-surveilled contexts — public spaces, checkpoints, dealings with officials or informants.',
    rules: [
      { id: 'despair', trigger: 'Uncancelled Despair on a surveilled-context check', personalHeat: 1 },
      { id: 'despairEvasion', trigger: 'Uncancelled Despair on an evasion check (Deception, Skulduggery, Streetwise or Cool used to evade or mislead surveillance)', personalHeat: 2,
        skills: ['deception', 'skulduggery', 'streetwise', 'cool'] },
      { id: 'triumph', trigger: 'Uncancelled Triumph — the player may choose to spend it', personalHeat: -1, optional: true }
    ],
    note: 'Ordinary Threat and Advantage never generate Heat; they stay narrative complications.'
  },
  tracks: {
    cite: '§17.2',
    personal: 'Tracked per character, 0 to 5.',
    cell: 'Shared across the whole party or network, 0 to 5. Rises when any member reaches Personal Heat 3 or more, or from group-implicating failures such as a blown safehouse or a flipped informant.'
  },
  thresholds: [
    { level: 1, personal: 'One Setback die on public checks', personalEffect: { setback: 1, scope: 'public' }, cell: null },
    { level: 2, personal: 'Papers checked on sight — opposed Deception or Cool against Perception', cell: 'One Setback die on every cell member\'s public checks', cellEffect: { setback: 1, scope: 'public' } },
    { level: 3, personal: 'Tailed — an opposed Vigilance check to notice', cell: 'The safehouse is placed under watch, at GM discretion', safehouseStatus: 'watched' },
    { level: 4, personal: 'An informant is assigned and the residence is searched', cell: 'Oracle roll: a cell member is flipped or arrested' },
    { level: 5, personal: 'An arrest warrant is issued and a raid is imminent; the Oracle determines timing', cell: 'The cell is burned — the network collapses', safehouseStatus: 'blown' }
  ],
  decay: {
    cite: '§17.4',
    personal: 'Minus one per session of low-risk downtime, or through specific actions: bribery, new papers, relocating or disappearing.',
    cell: 'Only decays once the triggering Personal Heat scores drop and no new group failures occur.'
  },
  adventureEnd: 'A PC at Personal Heat 5 either goes underground, relocating and resetting Heat to 2, or is captured, with the Oracle or GM deciding whether they escape, turn, or leave play.' // §24
};

// T46 — Encounter and adventure sizing — §20B
export const ENCOUNTER_SIZING = {
  cite: '§20B',
  partySize: 4,
  table: [
    { setup: '4 minions acting individually',            difficulty: 'Easy — a good opener' },
    { setup: '2 minion groups of 3–4',                   difficulty: 'Easy to moderate' },
    { setup: '1 rival plus a minion group of 4',         difficulty: 'Moderate' },
    { setup: '3 rivals',                                 difficulty: 'Moderately difficult' },
    { setup: '1 nemesis plus 2 minion groups',           difficulty: 'Difficult' },
    { setup: '1 nemesis, 1 rival and a minion group of 5', difficulty: 'Difficult' }
  ],
  otherLevers: ['Environment: cover, concealment, terrain', 'Bystanders: crowds, allies, potential reinforcements', 'Exits and entrances, and how easily they can be blocked'],
  adventureSizing: 'A one-session adventure works well with 2 major encounters plus 2–3 quick ones; a longer one runs 6–9 encounters across 3–4 major scenes. Mix combat, social and exploration. Resource depletion — wounds, strain, Heat, ammunition — is the core pacing tool.',
  diceDriveStory: 'Let players propose their own Advantage, Triumph, Threat and Despair spends rather than dictating every outcome.'
};

// T47 — Lifecycle bundles — §21–§24, synthesised from the rules each boundary touches.
export const LIFECYCLE = {
  cite: '§21–§24, §5G, §12A, §17.4, §27',
  boundaries: [
    { id: 'encounter', name: 'End Encounter', effects: [
      'Prompt the end-of-encounter strain recovery check (Simple Discipline or Cool).',
      'Clear once-per-encounter talent flags.',
      'Clear "out of ammunition for the encounter" states.',
      'Expire round-duration effects.'
    ], clears: ['perEncounterFlags'] },
    { id: 'scene', name: 'End Scene', effects: [
      'Expire scene-duration effects.',
      'Re-check Heat thresholds.',
      'Clear per-scene dread-check flags — one roll per circumstance per scene.'
    ], clears: ['perSceneFlags'] },
    { id: 'session', name: 'End Session', effects: [
      'Award XP: 20 base, plus or minus 5 for session length, plus 5 for meaningful Motivation play.',
      'Personal Heat minus 1 if the session was low-risk downtime.',
      'Check Cell Heat decay.',
      'Clear once-per-session talent flags.',
      'Story Points carry over — they are not reset.'
    ], clears: ['perSessionFlags'] },
    { id: 'day', name: 'End Day', effects: [
      'Reset the painkiller counter.',
      'Recover 1 vehicle system strain if the vehicle is undamaged.'
    ], clears: ['perDayFlags'] },
    { id: 'week', name: 'End Week', effects: [
      'Make the week-rest Critical Injury check available again.',
      'Reset the per-injury Medicine limit.'
    ], clears: ['perWeekFlags'] },
    { id: 'adventure', name: 'End Adventure', effects: [
      'Resolve any PC at Personal Heat 5: go underground, resetting Heat to 2, or be captured (Oracle or GM).'
    ], clears: [] }
  ],
  ui: 'Every boundary shows a confirmation summary of the deltas it will apply and supports one-step undo.'
};

// T48 — XP awards — §27
export const XP_AWARDS = {
  cite: '§27',
  standardPerSession: 20,
  fastPace: 25,
  slowPace: 15,
  lengthAdjustment: 5,
  motivationBonus: 5,
  note: 'There is no separate combat or kill XP — the award is flat per session and reflects narrative engagement.'
};

// T49 — Dread checks — §29 (optional)
export const DREAD_CHECKS = {
  cite: '§29',
  skill: 'discipline',
  limit: 'Once per circumstance per scene.',
  ladder: [
    { severity: 'Startled',          difficulty: 'easy',     example: 'A sudden raid alarm; a body glimpsed briefly' },
    { severity: 'Shaken',            difficulty: 'average',  example: 'Discovering evidence of a specific atrocity; a close personal betrayal' },
    { severity: 'Deeply Disturbed',  difficulty: 'hard',     example: 'Witnessing mass violence directly; confronting one\'s own complicity' },
    { severity: 'Traumatized',       difficulty: 'daunting', example: 'Reserved for the campaign\'s darkest and rarest beats' }
  ],
  failure: [
    { tier: 'simple', effect: 'Disoriented until the end of the encounter.', condition: 'disoriented' },
    { tier: 'moderate', effect: 'Suffer strain equal to the number of Difficulty dice in the check.' },
    { tier: 'severe', effect: 'A lasting narrative scar the player and GM agree to track — a recurring nightmare, or a standing Setback in specific future scenes.' }
  ],
  success: 'No penalty; an uncancelled Triumph instead grants one Boost on the character\'s very next check.',
  usage: 'An optional lever for grim beats, not a tax on every dark scene.'
};

// T50 — Rules-library quick reference — §30, and skill usage examples — §26
export const SKILL_EXAMPLES = [
  { skill: 'deception',    example: 'Bluffing past a checkpoint with forged papers' },
  { skill: 'skulduggery',  example: 'Picking a lock, forging a signature, bypassing a simple alarm' },
  { skill: 'streetwise',   example: 'Finding a black-market contact, navigating the underworld' },
  { skill: 'stealth',      example: 'Slipping past a night patrol' },
  { skill: 'cool',         example: 'Keeping composure under questioning — opposed against Perception or Discipline' },
  { skill: 'vigilance',    example: 'Noticing a tail or a planted informant' },
  { skill: 'coercion',     example: 'Intimidating a low-level official into silence' },
  { skill: 'negotiation',  example: 'Bartering ration cards or safe passage' },
  { skill: 'knowledge',    example: 'Recalling bureaucratic procedure, geography or history' },
  { skill: 'medicine',     example: 'Treating a gunshot wound off the books' },
  { skill: 'survival',     example: 'Living rough while evading capture' },
  { skill: 'mechanics',    example: 'Repairing a getaway vehicle or a radio' },
  { skill: 'discipline',   example: 'Resisting interrogation — opposed against Coercion' },
  { skill: 'perception',   example: 'Spotting a hidden weapon or a surveillance team' }
];

export const QUICK_REFERENCE = {
  cite: '§30',
  sections: [
    { id: 'difficulty', title: 'Difficulty', body: 'Simple (–) · Easy (1) · Average (2) · Hard (3) · Daunting (4) · Formidable (5) · Impossible (5 plus 1 Story Point to attempt)' },
    { id: 'symbols', title: 'Symbols', body: 'Success · Failure · Advantage · Threat · Triumph (rare, always true) · Despair (rare, always true)' },
    { id: 'heat', title: 'Heat thresholds', body: '1 Setback on public checks · 2 papers checked on sight / cell Setback · 3 tailed / safehouse watched · 4 informant assigned / cell member flipped · 5 raid imminent / cell burned' },
    { id: 'combatSpends', title: 'Combat spends', body: '1 Advantage: minor boost or strain recovery · 2: free maneuver or Boost die · 3: negate defence or disable · Despair: weapon breaks or jams · 3 Threat: knocked prone or a major tactical loss' },
    { id: 'criticals', title: 'Critical Injury severity', body: '01–40 Easy · 41–90 Average · 91–125 Hard · 126–150 Daunting · 151+ Dead' },
    { id: 'oracle', title: 'Oracle', body: 'Likely 2 Ability vs 1 Difficulty · 50-50 2 vs 2 · Unlikely 1 vs 2. Net Success = Yes, net Failure = No, Triumph = Yes and, Despair = No and' },
    { id: 'sizing', title: 'Adversary sizing for four PCs', body: '4 minions easy · 1 rival plus 4 minions moderate · 3 rivals moderately difficult · 1 nemesis plus 2 minion groups difficult' },
    { id: 'xp', title: 'XP per session', body: '20 standard · +5 for Motivation play · plus or minus 5 for session length' }
  ]
};

// Condition registry — CLAUDE.md §3.9. Assembled from the Critical Injury table (§9),
// item qualities (§10), Heat thresholds (§17.3), encumbrance (§5F) and environment (§5E);
// the manual has no condition chapter of its own.
export const CONDITIONS = [
  { id: 'staggered', name: 'Staggered', inferred: true, ruling: 'R-6',
    effect: 'Cannot perform actions. Maneuvers and incidentals are unaffected.',
    sources: ['Critical Injury: Stunned, Knocked Senseless', 'Concussive X'] },
  { id: 'disoriented', name: 'Disoriented', inferred: true, ruling: 'R-7',
    effect: 'Adds one Setback die to all checks.', dice: { setback: 1 },
    sources: ['Critical Injury: Slightly Dazed', 'Disorient X', 'Failed dread check'] },
  { id: 'prone', name: 'Prone', effect: 'One Boost to ranged attacks against you is removed and one Setback added — prone grants a Boost against ranged attacks and a Setback against melee attacks aimed at you. Standing costs a maneuver.', cite: '§5A' },
  { id: 'immobilised', name: 'Immobilised', effect: 'Cannot move. Ensnare X lasts X rounds and a Hard Athletics check breaks free early.', cite: '§10' },
  { id: 'incapacitated', name: 'Incapacitated', effect: 'Wounds or strain have met or passed the matching threshold; the character is out of the fight until healed below it.', cite: '§6' },
  { id: 'blinded', name: 'Blinded', effect: 'Upgrade the difficulty of all checks twice, and of Perception and Vigilance three times.', cite: '§9' },
  { id: 'burning', name: 'Burning', effect: 'Takes the weapon\'s base damage each turn for the listed rounds; a Coordination check or water stops it.', cite: '§10' },
  { id: 'encumbered', name: 'Encumbered', effect: 'One Setback on Agility and Brawn checks per point over the threshold; over by Brawn or more, the free maneuver is lost.', cite: '§5F' },
  { id: 'suffocating', name: 'Suffocating', effect: '3 strain at the start of each turn; past the strain threshold, incapacitated, then an extra Critical Injury roll every further turn.', cite: '§5I' },
  { id: 'noFreeManeuver', name: 'No free maneuver', effect: 'The free maneuver is lost; each maneuver costs 2 strain.', cite: '§9, §5F' },
  { id: 'slowed', name: 'Slowed Down', effect: 'Acts in the last allied Initiative slot next turn.', cite: '§9' },
  { id: 'scatteredSenses', name: 'Scattered Senses', effect: 'Removes all Setback dice from checks.', cite: '§9' },
  { id: 'winded', name: 'Winded', effect: 'Cannot voluntarily suffer strain for extra maneuvers or abilities.', cite: '§9' },
  { id: 'atTheBrink', name: 'At the Brink', effect: 'Suffers 2 strain per action taken.', cite: '§9' },
  { id: 'heatPersonal1', name: 'Personal Heat 1+', effect: 'One Setback die on public checks.', dice: { setback: 1 }, cite: '§17.3' },
  { id: 'heatCell2', name: 'Cell Heat 2+', effect: 'One Setback die on every cell member\'s public checks.', dice: { setback: 1 }, cite: '§17.3' }
];
