// data-journey.js — PART V, the Journey & Tension supplement (§31, §33–§40).
// The manual ships this as an **optional module**, adopted subsystem by subsystem rather
// than all at once, so every table here sits behind `Settings.journeyModule()`. All of it
// is printed rules — paraphrased, never copied — and every entry cites its section.
// T70–T78.

// T70 — Cell Trust / Tension — §31.
// Friction inside the party, where Heat (§17) is pressure from outside it. Tracked per
// ordered pair, so A's tension toward B need not equal B's toward A.
export const TENSION = {
  cite: '§31',
  min: 0,
  max: 2,
  directional: true,
  levels: [
    { level: 0, name: 'None', summary: 'No tension.' },
    { level: 1, name: 'Suppressed', summary: 'Irritation, unspoken loyalty, unresolved history — felt but not acted on.' },
    { level: 2, name: 'Uncontained', summary: 'Open conflict, obsessive loyalty, or real fear of one another.' }
  ],
  // The only mechanical effect: in an opposed check between two characters who carry
  // tension toward each other, the higher-tension side adds a Boost per point.
  effect: { dice: 'boost', perPoint: 1, appliesTo: 'opposed checks between the two characters, social or combat' },
  raise: 'A player or the GM proposes +1 when a scene meaningfully strains or charges the relationship — a betrayal, a rescue, a hard call under pressure. It needs the other side\'s agreement.',
  reduce: 'Both sides agree to drop their mutual tension by 1, played out as reconciliation, confrontation or release. Each participant then recovers 2 strain.',
  reduceStrainRecovery: 2,
  vsHeat: 'Tension is orthogonal to Heat: a cell can be tight under heavy outside pressure, or fracturing without having drawn any attention at all.'
};

// T71 — Personal Threat Countdown — §33.
// A per-character antagonist thread, independent of the party-wide Heat track. Named at
// creation beside the Motivation and the Kicker.
export const PERSONAL_THREAT = {
  cite: '§33',
  steps: 3,
  namedAt: 'creation, alongside Motivation and the Kicker',
  examples: ['an old SD file with their name on it', 'a jilted informant', 'a family member used as leverage'],
  advance: 'At GM discretion when the fiction calls for it — roughly once a session at most, tied to a Despair or a major failure involving that character.',
  ladder: [
    { step: 1, name: 'Noticed', summary: 'The threat becomes aware of this character, or turns back toward them. Foreshadowing only, no mechanics.' },
    { step: 2, name: 'Closing in', summary: 'It acts — surveillance, an approach, a warning shot.', dice: { setback: 1, scope: 'checks made to avoid or evade this threat specifically' } },
    { step: 3, name: 'Confrontation', summary: 'A direct scene between the character and their threat, played out rather than summarised. It usually resolves the arc, for now or for good.' }
  ],
  afterStep3: 'Retire the threat, or with the GM\'s agreement escalate it into a fresh three-step arc — which is how a Rival becomes a recurring Nemesis.'
};

// T72 — Journey framework — §34.
export const JOURNEY = {
  cite: '§34',
  // Three loose scales. Round and Scene the app already has; the Shift is new, and is the
  // unit travel encounters and downtime recovery run on.
  timeUnits: [
    { id: 'round', name: 'Round', span: 'seconds', note: 'Structured combat (§5).' },
    { id: 'scene', name: 'Scene', span: 'minutes to hours', note: 'One self-contained beat — a checkpoint, a conversation, a search.' },
    { id: 'shift', name: 'Shift', span: 'roughly 5 to 10 hours', note: 'A leg of travel, a stretch of rest, the gap between Stops. Narrative bookkeeping, not a clock — the GM calls when one has passed.' }
  ],
  lengths: [
    { id: 'oneShot', name: 'One-shot', stops: '1' },
    { id: 'short',   name: 'Short',    stops: '2–4' },
    { id: 'medium',  name: 'Medium',   stops: '4–7' },
    { id: 'long',    name: 'Long',     stops: '8–12' }
  ],
  setup: [
    'Choose a start and a destination — a compromised cell\'s city, say, and a border crossing into a neutral country.',
    'Choose the journey length, which sets how many Stops it has.',
    'Generate each Stop from the Element tables (§15B: location, faction, complication) plus a Blocker.',
    'Roll on the Travel Encounter table between Stops.'
  ],
  blocker: {
    summary: 'The obstacle stopping the party simply passing through — a washed-out bridge needing a specific document, a hostile faction holding the only route, a dragnet triggered by suspicion.',
    generate: 'Roll d10 on the Element tables\' faction or complication list, or invent one to match the location.',
    // The manual points at the two published encounter blocks here; both are in the
    // bestiary rather than the manual, so the app cites them as B§6.
    publishedBlocks: ['checkpoint', 'manhuntDragnet'], blocksCite: 'B§6'
  },
  // Scene-local pressure, rolled when the party lingers past a Stop's natural end.
  stopCountdown: {
    die: 'd10',
    when: 'Whenever the party lingers at a Stop past its natural resolution point — roughly one per scene of delay, at GM discretion.',
    table: [
      { roll: 1,  entry: 'The local patrol pattern or tactics change' },
      { roll: 2,  entry: 'An ally or bystander is captured' },
      { roll: 3,  entry: 'Something the party needs is sabotaged or seized' },
      { roll: 4,  entry: 'Someone pleads for the party\'s help, complicating departure' },
      { roll: 5,  entry: 'The party is accused of something, true or false' },
      { roll: 6,  entry: 'Victims of the Stop\'s central conflict appear, demanding attention' },
      { roll: 7,  entry: 'The party is directly threatened' },
      { roll: 8,  entry: 'The Blocker\'s controlling faction shows its full strength' },
      { roll: 9,  entry: 'The Blocker attacks or moves against the party' },
      { roll: 10, entry: 'A deal is offered — favourable terms with a hidden cost' }
    ]
  }
};

// T73 — Travel Encounter table — §35. Rolled between Stops, or once per Shift.
export const TRAVEL_ENCOUNTERS = {
  cite: '§35',
  die: 'd10',
  when: 'When the party travels between Stops, or once per Shift on a long journey.',
  scope: 'Scoped to movement between Stops — distinct from the Meaning tables (any undefined moment) and the Random Event table (triggered by an emphatic Oracle answer).',
  table: [
    { roll: 1,  entry: 'A hitchhiker or refugee seeking transport' },
    { roll: 2,  entry: 'Road damage or a construction detour' },
    { roll: 3,  entry: 'Severe weather' },
    { roll: 4,  entry: 'A fuel or supply stop with complications' },
    { roll: 5,  entry: 'A notable ruin or landmark — colour, and possible side content' },
    { roll: 6,  entry: 'A wildlife or livestock hazard' },
    { roll: 7,  entry: 'An abandoned, salvageable vehicle' },
    { roll: 8,  entry: 'A staged roadside scene — bait for a robbery, or a genuine emergency' },
    { roll: 9,  entry: 'Unmarked wreckage or a debris field' },
    { roll: 10, entry: 'A checkpoint — run the published Checkpoint encounter block', deploys: 'checkpoint' }
  ]
};

// T74 — Vehicle traits — §36. Rolled once per vehicle for variance, or chosen.
export const VEHICLE_TRAITS = {
  cite: '§36',
  die: 'd10',
  table: [
    { roll: 1,  id: 'fast',        name: 'Fast',        effect: 'Speed +1', apply: { speed: 1 } },
    { roll: 2,  id: 'roomy',       name: 'Roomy',       effect: 'Carries two more passengers, or that much more cargo encumbrance' },
    { roll: 3,  id: 'reliable',    name: 'Reliable',    effect: 'One Boost on Mechanics checks to repair it', dice: { boost: 1, scope: 'repair' } },
    { roll: 4,  id: 'sluggish',    name: 'Sluggish',    effect: 'Speed −1', apply: { speed: -1 } },
    { roll: 5,  id: 'reinforced',  name: 'Reinforced',  effect: 'Hull Trauma Threshold +2', apply: { hullThreshold: 2 } },
    { roll: 6,  id: 'responsive',  name: 'Responsive',  effect: 'Handling +1', apply: { handling: 1 } },
    { roll: 7,  id: 'wellKept',    name: 'Well-kept',   effect: 'Notably valuable and conspicuous — +1 effective rarity if identified', apply: { rarity: 1 } },
    { roll: 8,  id: 'boneshaker',  name: 'Boneshaker',  effect: 'Handling −1, but price and rarity count one step lower', apply: { handling: -1, rarity: -1 } },
    { roll: 9,  id: 'loud',        name: 'Loud',        effect: 'One Setback on Stealth checks while it is running nearby', dice: { setback: 1, scope: 'stealth' } },
    { roll: 10, id: 'distinctive', name: 'Distinctive', effect: 'Easily described — one Boost to anyone trying to identify or track this vehicle later' }
  ]
};

// T75 — Vehicle component damage — §37. Rolled instead of, or alongside, flat hull trauma
// when a vehicle check shows three Threat or a Despair against a vehicle.
export const VEHICLE_COMPONENT_DAMAGE = {
  cite: '§37',
  die: 'd10',
  trigger: 'A vehicle combat check showing three uncancelled Threat, or an uncancelled Despair, against a vehicle.',
  table: [
    { roll: 1,  entry: 'The driver is struck — they take the vehicle\'s remaining unabsorbed damage directly' },
    { roll: 2,  entry: 'A passenger is struck, at random, the same way' },
    { roll: 3,  entry: 'A severe swerve — a Hard Driving or Piloting check or the vehicle crashes' },
    { roll: 4,  entry: 'A mounted weapon or piece of equipment is disabled' },
    { roll: 5,  entry: 'The engine is damaged — Handling counts as −2 until repaired', apply: { handling: -2 } },
    { roll: 6,  entry: 'The steering is damaged — Handling counts as −1 until repaired', apply: { handling: -1 } },
    { roll: 7,  entry: 'A tyre or tread is damaged — Speed is capped at half, rounded down, until repaired' },
    { roll: 8,  entry: 'The fuel line is hit — System Strain +3 at once, then 1 a round until a Mechanics check stops it', apply: { systemStrain: 3 } },
    { roll: 9,  entry: 'The cabin or cargo is breached — loose cargo and exposed passengers take impact damage on the falling scale' },
    { roll: 10, entry: 'The fuel tank ignites — an intensity-8 fire; the vehicle is likely lost without immediate intervention' }
  ]
};

// T76 — Mental Trauma — §38. The companion to the Critical Injury table, for what the
// occupation does to a mind rather than a body. Rolled on a severe dread-check failure.
export const MENTAL_TRAUMA = {
  cite: '§38',
  die: 'd100',
  trigger: 'A dread check (§29) failed with three Threat or a Despair, or any time the GM calls for a lasting consequence to a traumatic scene.',
  table: [
    { min: 1,  max: 15,  id: 'hypervigilance', name: 'Hypervigilance', effect: 'One Setback on checks to relax or rest, and strain recovers at half rate, rounded down, until it is addressed.' },
    { min: 16, max: 30,  id: 'intrusiveMemory', name: 'Intrusive memory', effect: 'Once a session the GM may add one Setback to a check when a trigger is present in the scene.' },
    { min: 31, max: 45,  id: 'avoidance', name: 'Avoidance', effect: '+1 difficulty on checks to revisit a place or situation resembling the event.' },
    { min: 46, max: 60,  id: 'numbness', name: 'Numbness', effect: 'One Setback on social checks involving genuine emotional expression, until it is addressed.' },
    { min: 61, max: 75,  id: 'compulsion', name: 'Compulsion', effect: 'A coping compulsion the player and GM define concretely. Resisting it in a relevant scene takes a Discipline check.' },
    { min: 76, max: 85,  id: 'paranoia', name: 'Paranoia', effect: 'Setback dice are removed from checks to notice threats, and one Setback is added to Charm and Negotiation checks.' },
    { min: 86, max: 95,  id: 'dissociation', name: 'Dissociation', effect: 'Once a session the GM may declare the character loses a maneuver or acts confused during a high-stress scene.' },
    { min: 96, max: 100, id: 'profoundBreak', name: 'A profound break', effect: 'The player and GM define a significant, campaign-relevant change to the character\'s outlook or capabilities together.' }
  ],
  addressing: 'It takes sustained downtime — sessions of narrative rest, trusted support, care — and is resolved between player and GM. There is no dice-check cure.'
};

// T77 — NPC behaviour generator — §39. Layers onto the §20 quick-gen for named NPCs.
export const NPC_BEHAVIOR = {
  cite: '§39',
  use: 'Roll all five for a fleshed-out antagonist or contact; roll fewer for a quick sketch.',
  personality: {
    die: 'd10', name: 'Personality', note: 'Roll twice if you want a primary and a secondary trait.',
    table: [
      { roll: 1,  entry: 'Survivor — pragmatic, self-preserving' },
      { roll: 2,  entry: 'Visionary — driven by an idea bigger than themselves' },
      { roll: 3,  entry: 'Leader — commands, or wants to' },
      { roll: 4,  entry: 'Pragmatist — does what works, not what is right' },
      { roll: 5,  entry: 'Reactionary — clings to how things were' },
      { roll: 6,  entry: 'Observer — watches more than acts' },
      { roll: 7,  entry: 'Schemer — always working an angle' },
      { roll: 8,  entry: 'Zealot — a true believer, for the regime or against it' },
      { roll: 9,  entry: 'Recluse — avoids entanglement' },
      { roll: 10, entry: 'Paranoid — trusts no one, sees threats everywhere' }
    ]
  },
  emotionalState: {
    die: 'd10', name: 'Emotional state',
    table: [
      { roll: 1, entry: 'Angry' }, { roll: 2, entry: 'Obsessed' }, { roll: 3, entry: 'Cautious' },
      { roll: 4, entry: 'Fearful' }, { roll: 5, entry: 'Placatory' }, { roll: 6, entry: 'Curious' },
      { roll: 7, entry: 'Nostalgic' }, { roll: 8, entry: 'Excited' }, { roll: 9, entry: 'Anxious' },
      { roll: 10, entry: 'Confused' }
    ]
  },
  motive: {
    die: 'd4', name: 'Motive',
    table: [
      { roll: 1, entry: 'Narcissism — self-interest, image, advancement' },
      { roll: 2, entry: 'Trauma — driven by past wounds' },
      { roll: 3, entry: 'Community — loyalty to a group, a family, a cause' },
      { roll: 4, entry: 'Ideology — genuine belief, regime or resistance' }
    ]
  },
  method: {
    die: 'd4', name: 'Method',
    table: [
      { roll: 1, entry: 'Power — coercion, authority, force' },
      { roll: 2, entry: 'Deceit — lies, manipulation, misdirection' },
      { roll: 3, entry: 'Appeal — charm, shared belief, solidarity' },
      { roll: 4, entry: 'Leverage — information, blackmail, dependency' }
    ]
  },
  // Tilt colours the §20 disposition rather than replacing it, and feeds §40.
  tilt: {
    die: 'd10', name: 'Tilt',
    note: 'How they lean toward the party. 1 or 10 is extreme, 5 or 6 is mild.',
    bands: [
      { min: 1, max: 5,  id: 'unfavourable', entry: 'Unfavourable — obstructive', dice: { setback: 1 } },
      { min: 6, max: 10, id: 'favourable',   entry: 'Favourable — helpful', dice: { boost: 1 } }
    ],
    degree: 'The further from the middle, the stronger it runs.'
  }
};

// T78 — Conversation generator — §40. What the conversation is about; §11 decides how it goes.
export const CONVERSATION = {
  cite: '§40',
  die: 'd10',
  resolvedBy: 'The social encounter rules (§11) — this table only says what the conversation is about.',
  tiltNote: 'In solo play the NPC\'s Tilt (§39) is a quick modifier: favourable grants a Boost, unfavourable a Setback, on the character\'s check.',
  subject: [
    { roll: 1,  entry: 'Personal background' },
    { roll: 2,  entry: 'Their current emotional state' },
    { roll: 3,  entry: 'Belief or ideology' },
    { roll: 4,  entry: 'Technology or logistics relevant to the scene' },
    { roll: 5,  entry: 'The war and the occupation itself' },
    { roll: 6,  entry: 'The history of this place' },
    { roll: 7,  entry: 'A rumour, or a piece of information' },
    { roll: 8,  entry: 'A request, or a favour' },
    { roll: 9,  entry: 'A warning' },
    { roll: 10, entry: 'Something the NPC wants from the character' }
  ]
};
