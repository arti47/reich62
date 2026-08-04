// REICH '62 — bestiary compendium.
// Source of record: source/reich62_bestiary.md, cited as `B§x`; the framework it builds on
// is in the manual (§12C, §12D) and lives in data-npcs.js.
// R-15: every stat below is loaded exactly as printed and is never recomputed from the PC
// formulas in derived.js. R-17: Defence is stored as melee/ranged.

// T61 — Minion groups — B§2 (10)
export const MINION_GROUPS = [
  { id: 'checkpointGuards', name: 'Checkpoint Guards', tier: 'minion', cite: 'B§2',
    hook: 'The default obstacle at any road, rail or district crossing — usually two to four of them, bored and looking for a reason to escalate or extract a bribe.',
    characteristics: { brawn: 2, agility: 2, intellect: 2, cunning: 1, willpower: 2, presence: 1 },
    groupSkills: ['perception', 'coercion', 'ranged'],
    woundThresholdPerMember: 4, // R-18
    equipment: ['P38 pistol or Kar98k rifle', 'Whistle', 'Papers-check stamp kit'],
    abilities: ['papersCheckReflex'], heatHook: true, defaultGroupSize: 3 },

  { id: 'streetPatrol', name: 'Street Patrol (Ordnungspolizei)', tier: 'minion', cite: 'B§2',
    hook: 'Uniformed police walking a beat — the everyday face of surveillance in residential districts.',
    characteristics: { brawn: 2, agility: 2, intellect: 2, cunning: 2, willpower: 2, presence: 1 },
    groupSkills: ['vigilance', 'coercion', 'streetwise'],
    woundThresholdPerMember: 4,
    equipment: ['Truncheon', 'P38 pistol', 'Whistle'],
    abilities: ['beatFamiliarity'], defaultGroupSize: 2 },

  { id: 'ssSecurityDetail', name: 'SS Security Detail', tier: 'minion', cite: 'B§2',
    hook: 'Elite guards on sensitive sites — Party buildings, rail depots with valuable cargo, detention facilities.',
    characteristics: { brawn: 3, agility: 2, intellect: 2, cunning: 2, willpower: 3, presence: 2 },
    groupSkills: ['ranged', 'vigilance', 'discipline'],
    woundThresholdPerMember: 5, soak: 2,
    equipment: ['MP40 submachine gun', 'Flak vest (soak +2)'],
    abilities: ['disciplined'], defaultGroupSize: 3 },

  { id: 'railYardGuards', name: 'Rail Yard Guards', tier: 'minion', cite: 'B§2',
    hook: 'Watch freight and passenger platforms, checking manifests and travel permits.',
    characteristics: { brawn: 2, agility: 2, intellect: 2, cunning: 2, willpower: 2, presence: 1 },
    groupSkills: ['perception', 'knowledge', 'ranged'],
    woundThresholdPerMember: 4,
    equipment: ['Kar98k rifle', 'Manifest ledgers'],
    abilities: ['manifestCrossCheck'], defaultGroupSize: 3 },

  { id: 'factoryOverseers', name: 'Factory Overseers', tier: 'minion', cite: 'B§2',
    hook: 'Enforce labour quotas and watch for sabotage or slowdown among conscripted workers.',
    characteristics: { brawn: 2, agility: 1, intellect: 2, cunning: 2, willpower: 2, presence: 2 },
    groupSkills: ['coercion', 'perception', 'mechanics'],
    woundThresholdPerMember: 4,
    equipment: ['Truncheon', 'Quota sheets'],
    abilities: ['quotaPressure'], defaultGroupSize: 2 },

  { id: 'borderPatrol', name: 'Border Patrol', tier: 'minion', cite: 'B§2',
    hook: 'Watches frontier crossings, forest tracks and river approaches near contested or neutral borders.',
    characteristics: { brawn: 3, agility: 2, intellect: 2, cunning: 2, willpower: 2, presence: 1 },
    groupSkills: ['survival', 'perception', 'ranged'],
    woundThresholdPerMember: 5,
    equipment: ['Kar98k rifle', 'Flare pistol', 'Tracking dog (see Animals)'],
    abilities: ['terrainWise'], companions: ['guardDog'], defaultGroupSize: 3 },

  { id: 'hitlerYouthWatchers', name: 'Hitler Youth Watchers', tier: 'minion', cite: 'B§2',
    hook: 'Teenage informants and block wardens — a low combat threat but a high social and Heat danger through sheer numbers and zeal.',
    characteristics: { brawn: 1, agility: 2, intellect: 1, cunning: 1, willpower: 2, presence: 1 },
    groupSkills: ['vigilance', 'streetwise'],
    woundThresholdPerMember: 3,
    equipment: [],
    abilities: ['everywhere'], defaultGroupSize: 4 },

  { id: 'campGuards', name: 'Camp/Prison Guards', tier: 'minion', cite: 'B§2',
    hook: 'Staff detention facilities and labour camps — among the most dangerous minions, being willing to use lethal force without hesitation.',
    characteristics: { brawn: 3, agility: 2, intellect: 2, cunning: 2, willpower: 3, presence: 1 },
    groupSkills: ['ranged', 'coercion', 'vigilance'],
    woundThresholdPerMember: 5,
    equipment: ['Kar98k rifle', 'Guard dog (see Animals)'],
    abilities: ['shootOnSight'], companions: ['guardDog'], defaultGroupSize: 3 },

  { id: 'roadblockSoldiers', name: 'Roadblock Soldiers (Wehrmacht)', tier: 'minion', cite: 'B§2',
    hook: 'Regular army units manning temporary roadblocks during troop movements or security sweeps.',
    characteristics: { brawn: 2, agility: 2, intellect: 2, cunning: 1, willpower: 2, presence: 1 },
    groupSkills: ['ranged', 'athletics', 'vigilance'],
    woundThresholdPerMember: 4,
    equipment: ['Kar98k rifle', 'StG assault rifle (one in four)'],
    abilities: ['reinforcements'], defaultGroupSize: 4 },

  { id: 'informantNetwork', name: 'Informant Network', tier: 'minion', abstract: true, cite: 'B§2',
    hook: 'Not a physical group but a standing web of low-level watchers — shopkeepers, neighbours, colleagues — handled mechanically rather than placed on a map.',
    characteristics: null, groupSkills: [], woundThresholdPerMember: null,
    equipment: [],
    abilities: ['passiveWatch'], heatHook: true,
    note: 'No combat stats — a social and information hazard resolved with an Oracle roll.' }
];

// T62 — Rivals — B§3 (12). `veryChallenging` follows the §12C threat guidance
// (soak 5+, WT 14+, 3+ skill ranks, or 9+ damage weapons).
export const RIVALS = [
  { id: 'gestapoInterrogator', name: 'Gestapo Interrogator', tier: 'rival', cite: 'B§3',
    hook: 'Runs formal interrogations in a detention facility: calm, methodical and genuinely good at reading people.',
    characteristics: { brawn: 2, agility: 2, intellect: 3, cunning: 3, willpower: 3, presence: 2 },
    soak: 3, defense: { melee: 0, ranged: 0 }, woundThreshold: 14,
    skills: { coercion: 3, perception: 3, discipline: 2, knowledge: 2 },
    abilities: ['interrogatorsEye'], adversary: 1, equipment: [],
    equipmentNote: 'Relies on position and authority rather than weapons.', veryChallenging: true },

  { id: 'sdCaseOfficer', name: 'SD Case Officer', tier: 'rival', cite: 'B§3',
    hook: 'Runs a network of informants and moles — the most persistent unseen adversary in an espionage-led campaign.',
    characteristics: { brawn: 2, agility: 2, intellect: 3, cunning: 3, willpower: 2, presence: 3 },
    soak: 2, defense: { melee: 0, ranged: 0 }, woundThreshold: 12,
    skills: { deception: 3, knowledge: 2, streetwise: 2, leadership: 2 },
    abilities: ['webOfInformants'], adversary: 1,
    equipment: ['P38 pistol', 'Forged identity papers of their own'], veryChallenging: true },

  { id: 'blackMarketEnforcer', name: 'Black-Market Enforcer', tier: 'rival', cite: 'B§3',
    hook: 'Muscle for a criminal syndicate that may be ally, rival or obstacle depending on the deal on the table.',
    characteristics: { brawn: 3, agility: 2, intellect: 2, cunning: 2, willpower: 2, presence: 1 },
    soak: 4, defense: { melee: 0, ranged: 1 }, woundThreshold: 15,
    skills: { coercion: 2, melee: 2, brawl: 2, streetwise: 2 },
    abilities: [], adversary: 1,
    equipment: ['Truncheon (damage +2, Crit 5, Disorient 2)', 'Knife'], veryChallenging: true },

  { id: 'houndHandler', name: 'Hound Handler', tier: 'rival', cite: 'B§3',
    hook: 'Leads a guard dog on manhunts — a serious threat to anyone trying to evade capture on foot.',
    characteristics: { brawn: 2, agility: 3, intellect: 2, cunning: 2, willpower: 2, presence: 1 },
    soak: 2, defense: { melee: 0, ranged: 0 }, woundThreshold: 11,
    skills: { survival: 3, perception: 2, ranged: 2 },
    abilities: ['environmentalAffinityWilderness'], adversary: 1,
    equipment: ['Kar98k rifle'], companions: ['guardDog'], veryChallenging: true },

  { id: 'policeDetective', name: 'Local Police Detective (Collaborator)', tier: 'rival', cite: 'B§3',
    hook: 'A native investigator working with the occupation for advantage, survival or belief — turnable, bribable, or a future nemesis if crossed.',
    characteristics: { brawn: 2, agility: 2, intellect: 3, cunning: 3, willpower: 2, presence: 2 },
    soak: 2, defense: { melee: 0, ranged: 0 }, woundThreshold: 11,
    skills: { perception: 2, streetwise: 2, coercion: 2, knowledge: 2 },
    abilities: [], adversary: 1, equipment: ['P38 pistol', 'Badge and credentials'] },

  { id: 'wehrmachtOfficer', name: 'Wehrmacht Officer', tier: 'rival', cite: 'B§3',
    hook: 'A field-grade officer with real authority over a garrison, a chain of checkpoints or a requisition depot.',
    characteristics: { brawn: 2, agility: 2, intellect: 2, cunning: 2, willpower: 3, presence: 3 },
    soak: 3, defense: { melee: 0, ranged: 0 }, woundThreshold: 13,
    skills: { leadership: 3, ranged: 2, discipline: 2, knowledge: 1 },
    abilities: ['chainOfCommand'], adversary: 1,
    equipment: ['P38 pistol', 'Field uniform (soak +1)'], veryChallenging: true },

  { id: 'informantHandler', name: 'Informant Handler', tier: 'rival', cite: 'B§3',
    hook: 'Runs a stable of paid or coerced informants and knows who is talking and who might be turned.',
    characteristics: { brawn: 2, agility: 2, intellect: 2, cunning: 3, willpower: 2, presence: 3 },
    soak: 2, defense: { melee: 0, ranged: 0 }, woundThreshold: 10,
    skills: { deception: 2, charm: 2, streetwise: 3, negotiation: 2 },
    abilities: ['webOfInformants'], adversary: 1,
    equipment: ['Cash and ration-card bribes', 'Concealed pistol'], veryChallenging: true },

  { id: 'documentsInspector', name: 'Documents Inspector', tier: 'rival', cite: 'B§3',
    hook: 'A specialist assigned to spot forged papers — the natural counter to a Runner\'s or Forger\'s whole skill set.',
    characteristics: { brawn: 1, agility: 2, intellect: 3, cunning: 3, willpower: 2, presence: 1 },
    soak: 1, defense: { melee: 0, ranged: 0 }, woundThreshold: 9,
    skills: { perception: 3, knowledge: 3, vigilance: 2 },
    abilities: ['interrogatorsEye'], adversary: 1,
    equipment: ['Reference ledgers', 'Forgery-detection tools: UV lamp, ink-sample kit'], veryChallenging: true },

  { id: 'directionFinder', name: 'Radio Direction-Finding Specialist', tier: 'rival', cite: 'B§3',
    hook: 'Runs signal-tracking equipment hunting clandestine shortwave traffic — the direct counter to the shortwave radio.',
    characteristics: { brawn: 2, agility: 2, intellect: 3, cunning: 2, willpower: 2, presence: 1 },
    soak: 2, defense: { melee: 0, ranged: 0 }, woundThreshold: 10,
    skills: { perception: 3, mechanics: 2, knowledge: 2 },
    abilities: [], adversary: 1,
    equipment: ['Direction-finding van — treat as a delivery van with detection gear fitted'], veryChallenging: true },

  { id: 'smugglingRingBoss', name: 'Smuggling Ring Boss', tier: 'rival', cite: 'B§3',
    hook: 'A rival operator competing for the same routes and contacts as the PCs.',
    characteristics: { brawn: 2, agility: 2, intellect: 2, cunning: 3, willpower: 2, presence: 2 },
    soak: 2, defense: { melee: 0, ranged: 0 }, woundThreshold: 11,
    skills: { negotiation: 3, streetwise: 3, deception: 2, coercion: 1 },
    abilities: ['ruthless'], adversary: 1,
    equipment: ['P38 pistol', 'Ledger of debts and favours'], veryChallenging: true },

  { id: 'partyFunctionary', name: 'Party Functionary', tier: 'rival', cite: 'B§3',
    hook: 'A civil administrator trading favours, quotas and paperwork for bribes or leverage — as dangerous as any soldier in the right office.',
    characteristics: { brawn: 1, agility: 1, intellect: 3, cunning: 3, willpower: 2, presence: 2 },
    soak: 1, defense: { melee: 0, ranged: 0 }, woundThreshold: 9,
    skills: { knowledge: 3, deception: 2, negotiation: 2, charm: 1 },
    abilities: [], adversary: 1,
    equipment: ['Stacks of forms', 'Official stamps and seals — a high-value theft target'], veryChallenging: true },

  { id: 'foreignIntelligenceRival', name: 'Foreign Intelligence Rival', tier: 'rival', cite: 'B§3',
    hook: 'An operative whose goals only sometimes align with the PCs\' — as likely to be a complication as an ally.',
    characteristics: { brawn: 2, agility: 3, intellect: 3, cunning: 2, willpower: 2, presence: 2 },
    soak: 2, defense: { melee: 0, ranged: 1 }, woundThreshold: 12,
    skills: { stealth: 2, deception: 2, ranged: 2, cool: 2 },
    abilities: [], adversary: 1,
    equipment: ['Concealed pistol', 'Forged credentials', 'Dead-drop kit'] }
];

// T63 — Nemeses — B§4 (4)
export const NEMESES = [
  { id: 'hartmannVoss', name: 'Kriminalrat Hartmann Voss', title: 'Regional Gestapo Chief', tier: 'nemesis', cite: 'B§4',
    hook: 'Runs Gestapo operations across a district: ambitious, patient, and treating the PCs\' cell as the case that makes his career.',
    characteristics: { brawn: 2, agility: 2, intellect: 4, cunning: 4, willpower: 3, presence: 3 },
    soak: 2, defense: { melee: 0, ranged: 0 }, woundThreshold: 16, strainThreshold: 14,
    skills: { coercion: 3, perception: 3, leadership: 3, knowledge: 3, deception: 2, discipline: 2 },
    abilities: ['interrogatorsEye', 'webOfInformants', 'chainOfCommand'], adversary: 2,
    equipment: ['P38 pistol', 'A district-wide informant network — may call in a minion group as reinforcements once per session'],
    heatHook: { cellHeat: 4, effect: 'Escalates personally once Cell Heat reaches 4 or more.' },
    narrativeNote: 'Best kept mostly off-screen, felt through consequences — Heat escalation, NPCs disappearing. A direct confrontation should be a campaign climax, not a random encounter.' },

  { id: 'herrWolf', name: '"Herr Wolf"', title: 'The Interrogator', tier: 'nemesis', cite: 'B§4',
    hook: 'A near-legendary interrogator whose name alone is a fear trigger in resistance circles, and who has genuinely broken cells thought unbreakable.',
    characteristics: { brawn: 2, agility: 2, intellect: 3, cunning: 4, willpower: 4, presence: 3 },
    soak: 2, defense: { melee: 0, ranged: 0 }, woundThreshold: 15, strainThreshold: 16,
    skills: { coercion: 4, discipline: 3, perception: 3, knowledge: 2, vigilance: 2 },
    abilities: ['interrogatorsEye', 'hardened', 'fear'], abilityRanks: { fear: 2 }, adversary: 2,
    equipment: [], equipmentNote: 'None — the reputation is the weapon.',
    narrativeNote: 'Rarely fights. Most dangerous in a social encounter (§11) where he is working on a captured PC or NPC.' },

  { id: 'erichKessler', name: 'Standartenführer Erich Kessler', title: 'Camp/Regional Commander', tier: 'nemesis', cite: 'B§4',
    hook: 'Holds absolute local authority over a camp or garrison region, and combines real military competence with ideological zeal.',
    characteristics: { brawn: 3, agility: 3, intellect: 2, cunning: 2, willpower: 3, presence: 3 },
    soak: 4, defense: { melee: 1, ranged: 0 }, woundThreshold: 20, strainThreshold: 15,
    skills: { ranged: 3, leadership: 3, discipline: 2, melee: 2, coercion: 2 },
    abilities: ['chainOfCommand', 'hardened'], adversary: 2,
    equipment: ['MP40 submachine gun', 'Flak vest (a further soak +2)', 'Sidearm'],
    narrativeNote: 'Unlike most nemeses here, a legitimate combat threat.' },

  { id: 'moleHunter', name: '"The Mole Hunter"', title: 'Counter-Infiltration Specialist', tier: 'nemesis', cite: 'B§4',
    hook: 'An internal-security specialist whose only job is rooting out defectors, double agents and infiltrators inside the Reich\'s own ranks.',
    characteristics: { brawn: 2, agility: 2, intellect: 4, cunning: 4, willpower: 3, presence: 2 },
    soak: 2, defense: { melee: 0, ranged: 0 }, woundThreshold: 14, strainThreshold: 13,
    skills: { perception: 4, knowledge: 3, deception: 3, vigilance: 3, coercion: 2 },
    abilities: ['interrogatorsEye', 'webOfInformants'], adversary: 2,
    equipment: ['P38 pistol', 'Extensive personnel files and cross-references'],
    narrativeNote: 'A slow-burn threat who appears in the margins of several sessions before any direct confrontation. A direct threat to a defecting SD Agent or Party Bureaucrat PC.' }
];

// T64 — Animals — B§5 (2)
export const ANIMALS = [
  { id: 'guardDog', name: 'Guard Dog (trained)', tier: 'minion', promotable: true, ruling: 'R-16', cite: 'B§5',
    hook: 'The standard companion for camp guards, border patrols and hound handlers — used to intimidate as much as to track.',
    characteristics: { brawn: 2, agility: 3, intellect: 1, cunning: 2, willpower: 2, presence: 1 },
    soak: 2, defense: { melee: 0, ranged: 0 }, woundThreshold: 4, woundThresholdPerMember: 4, defaultGroupSize: 1,
    skills: { brawl: 2, perception: 2, athletics: 2 },
    abilities: ['keenSenses', 'bite'], silhouette: 0,
    promotionNote: 'R-16: defaults to minion tier as a single unit; the combatant card offers a one-tap promotion to Rival, which keeps Wound Threshold 4 but resolves Critical Injuries normally.' },

  { id: 'patrolHorse', name: 'Patrol Horse', tier: 'minion', cite: 'B§5',
    hook: 'Used by rural border patrols and some rail security where vehicles cannot easily go.',
    characteristics: { brawn: 4, agility: 3, intellect: 1, cunning: 1, willpower: 2, presence: 2 },
    soak: 3, defense: { melee: 0, ranged: 0 }, woundThreshold: 6, woundThresholdPerMember: 6, defaultGroupSize: 1,
    skills: { athletics: 2 },
    abilities: ['mount'], silhouette: 1,
    statNote: 'R-15: printed Soak 3 sits below its Brawn 4, and is loaded as printed rather than recomputed.' }
];

// T65 — Abstract encounter blocks — B§6 (4). Resolution templates, not combatants.
export const ENCOUNTER_BLOCKS = [
  { id: 'checkpoint', name: 'Checkpoint', cite: 'B§6', heatHook: true,
    hook: 'The most common obstacle in the setting; resolved in seconds or expanded into a full scene.',
    resolution: { type: 'opposed', activeSkills: ['deception', 'cool'], opposingSkill: 'perception', oppositionDice: 2,
      source: 'Checkpoint Guards minion profile' },
    consequence: 'Failure triggers a Personal Heat check (§17.1). Failure with three Threat or a Despair escalates immediately to the Papers-Checked or Tailed threshold effect whatever the current Heat.' },

  { id: 'searchDetail', name: 'Search Detail / House Search', cite: 'B§6',
    hook: 'A team arrives to search a residence, vehicle or person on suspicion.',
    resolution: { type: 'opposed', activeSkills: ['skulduggery'], opposingSkill: 'perception', oppositionDice: [2, 3],
      note: 'Two or three dice depending on how thorough the search is; concealment must have been prepared beforehand.' },
    bonuses: ['Safehouse kit grants one Boost', 'Hidden document pouch grants one Boost'],
    consequence: 'Failure reveals whatever was hidden; consequences follow the GM and the Heat rules.' },

  { id: 'manhuntDragnet', name: 'Manhunt / Dragnet', cite: 'B§6', heatHook: true, extended: true,
    hook: 'A coordinated area-wide search after a serious incident — a killing, a successful sabotage, a high-profile escape.',
    resolution: { type: 'extendedOpposed', activeSkills: ['stealth', 'streetwise'], opposingSkill: 'perception',
      oppositionDiceStart: 2, oppositionDicePerHour: 1, oppositionDiceMax: 4, roundUnit: 'in-game hour' },
    consequence: 'Every failed round advances Personal Heat and Cell Heat by 1.',
    ends: 'Leaving the search zone entirely ends the dragnet.',
    trackerKind: 'dragnet' },

  { id: 'interrogation', name: 'Interrogation', cite: 'B§6',
    hook: 'A captured PC or NPC under questioning; runs on the social encounter subsystem (§11).',
    resolution: { type: 'opposed', activeSkills: ['discipline'], opposingSkill: 'coercion',
      note: 'Use the Gestapo Interrogator or "Herr Wolf" ratings for severity.' },
    consequence: 'Apply the §11 spend tables in full. A Despair may give up a name, a location or a plan for the GM to use in a later session.' }
];

// T66 — Random encounter table — B§7 (d10)
export const RANDOM_ENCOUNTERS = {
  cite: 'B§7', die: 'd10',
  note: 'Weighted toward the everyday texture of occupation.',
  table: [
    { roll: 1,  entry: 'Checkpoint Guards (minion group)', ref: 'checkpointGuards' },
    { roll: 2,  entry: 'Street Patrol',                    ref: 'streetPatrol' },
    { roll: 3,  entry: 'Hitler Youth Watchers',            ref: 'hitlerYouthWatchers' },
    { roll: 4,  entry: 'Local Police Detective',           ref: 'policeDetective' },
    { roll: 5,  entry: 'Informant Handler',                ref: 'informantHandler' },
    { roll: 6,  entry: 'Black-Market Enforcer',            ref: 'blackMarketEnforcer' },
    { roll: 7,  entry: 'Hound Handler with a Guard Dog',   ref: 'houndHandler' },
    { roll: 8,  entry: 'SD Case Officer',                  ref: 'sdCaseOfficer' },
    { roll: 9,  entry: 'SS Security Detail',               ref: 'ssSecurityDetail' },
    { roll: 10, entry: 'GM\'s choice — escalate toward a nemesis if Cell Heat is 4 or more', ref: null, heatHook: true }
  ]
};

// T67 — every published block in one list, for the browser and the combat drop-in.
export const BESTIARY = [
  ...MINION_GROUPS.map(e => ({ ...e, kind: 'minion' })),
  ...RIVALS.map(e => ({ ...e, kind: 'rival' })),
  ...NEMESES.map(e => ({ ...e, kind: 'nemesis' })),
  ...ANIMALS.map(e => ({ ...e, kind: 'animal' }))
].map(e => ({ sourceBook: 'bestiary', derivedFrom: 'printed', ...e })); // R-15
