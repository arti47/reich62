// REICH '62 — adversary framework.
// Sources: source/reich62_manual.md (§x) and source/reich62_bestiary.md (B§x).
// Recipes and abilities only; published stat blocks live in data-monsters.js.

// T51 — Minion / Rival / Nemesis recipes — §12C
export const ADVERSARY_TIERS = [
  {
    id: 'minion', name: 'Minion', cite: '§12C',
    summary: 'Faceless and disposable, deployed in groups.',
    rules: [
      'No strain track — anything that would inflict strain inflicts wounds instead, and they cannot choose to suffer strain.',
      'No individual skills: the group gains one rank in each listed skill per member past the first.',
      'The group shares one Wound Threshold equal to the sum of its members\' thresholds; attacks target the group, and one minion drops each time cumulative wounds pass another member\'s share.',
      'Any Critical Injury result instantly takes one minion out, and the group takes that minion\'s wound share plus one.'
    ],
    groupSkillRanks: (members) => Math.max(0, members - 1),
    // R-18 — the bestiary prints per-member thresholds; group WT is per-member × count.
    groupWoundThreshold: (perMember, members) => perMember * members,
    threatGuide: '1 minion is negligible; 2–3 are a fair threat to one starting PC; 3–4 suit a PC with 100 or more XP spent.'
  },
  {
    id: 'rival', name: 'Rival', cite: '§12C',
    summary: 'Named opponents at roughly starting-PC competence, operating alone.',
    rules: [
      'Suffers Critical Injuries normally.',
      'The GM may rule a rival killed outright, not merely incapacitated, once their Wound Threshold is exceeded.',
      'No strain track — strain effects inflict equivalent wounds instead.'
    ],
    threatGuide: 'One rival is reasonably dangerous to one PC; scale the count to the party.',
    veryChallengingIf: { soak: 5, woundThreshold: 14, skillRank: 3, weaponDamage: 9 }
  },
  {
    id: 'nemesis', name: 'Nemesis', cite: '§12C',
    summary: 'Full PC-equivalent antagonists who may exceed PC power levels.',
    rules: [
      'Tracks both wounds and strain with no simplification.',
      'Built essentially as a PC, often with unique named talents and abilities.'
    ]
  }
];

export const ADVERSARY_PROFILE_FIELDS = [
  'Name and type', 'Description', 'Six characteristics', 'Soak, Defence, thresholds (Strain Threshold for nemeses only)',
  'Skills', 'Talents', 'Abilities', 'Equipment — notable gear only'
]; // §12C

// T52 — the Adversary talent — §12C
export const ADVERSARY_TALENT = {
  id: 'adversary', name: 'Adversary', ranked: true, activation: 'passive', cite: '§12C',
  summary: 'Upgrade the difficulty of all combat checks targeting this NPC once per rank.',
  note: 'The standard hard-to-hit NPC talent, standing in for the defensive talents PCs use.'
};

// T53 — Adversary special abilities — §12D (7)
// T54a — plus the 14 defined only in the bestiary — B§2–B§5.
// R-19: Disciplined (Disorient only) and Hardened (Disorient and Stagger) stay distinct.
export const ADVERSARY_ABILITIES = [
  { id: 'fear', name: 'Fear X', source: 'manual', cite: '§12D', type: 'passive',
    summary: 'The first time each encounter a character engages this adversary in melee, they must pass a Discipline check at difficulty X or take one Setback on their combat checks until the end of their next turn.',
    limit: 'perEncounterPerCharacter', ranked: true },
  { id: 'interrogatorsEye', name: 'Interrogator\'s Eye', source: 'manual', cite: '§12D', type: 'passive',
    summary: 'Adds one automatic Advantage to this NPC\'s Perception and Discipline checks made to detect lies or forged documents.' },
  { id: 'chainOfCommand', name: 'Chain of Command', source: 'manual', cite: '§12D', type: 'incidental',
    summary: 'Once per encounter, order one nearby minion group to take a free maneuver as an out-of-turn incidental.', limit: 'perEncounter' },
  { id: 'hardened', name: 'Hardened', source: 'manual', cite: '§12D', type: 'passive',
    summary: 'Immune to the Disorient and Stagger effects of Critical Injuries.', immunities: ['disoriented', 'staggered'] },
  { id: 'webOfInformants', name: 'Web of Informants', source: 'manual', cite: '§12D', type: 'passive',
    summary: 'Reduces this NPC\'s effective rarity by 2 when the party tries to identify or locate them.' },
  { id: 'environmentalAffinityUrban', name: 'Environmental Affinity — Urban', source: 'manual', cite: '§12D', type: 'passive',
    summary: 'Removes Setback dice from this NPC\'s Stealth and Streetwise checks made in cities.' },
  { id: 'ruthless', name: 'Ruthless', source: 'manual', cite: '§12D', type: 'passive',
    summary: 'Once per encounter, reroll a failed Coercion or combat check.', limit: 'perEncounter' },

  { id: 'papersCheckReflex', name: 'Papers-Check Reflex', source: 'bestiary', cite: 'B§2', type: 'passive', heatHook: true,
    summary: 'Automatically triggers a Personal Heat check (§17.1) against any PC who fails a Deception or Cool check against them.' },
  { id: 'beatFamiliarity', name: 'Beat Familiarity', source: 'bestiary', cite: 'B§2', type: 'passive',
    summary: 'Removes Setback from checks to notice unfamiliar faces or behaviour in their own patrol district.' },
  { id: 'disciplined', name: 'Disciplined', source: 'bestiary', cite: 'B§2', type: 'passive', ruling: 'R-19',
    summary: 'Immune to Disorient effects; will not break formation under pressure.', immunities: ['disoriented'] },
  { id: 'manifestCrossCheck', name: 'Manifest Cross-Check', source: 'bestiary', cite: 'B§2', type: 'passive',
    summary: 'One Boost on Perception checks made specifically against forged travel papers.' },
  { id: 'quotaPressure', name: 'Quota Pressure', source: 'bestiary', cite: 'B§2', type: 'passive',
    summary: 'A failed Coercion check against a worker under their watch still adds one Setback to that worker\'s next check this scene.' },
  { id: 'terrainWise', name: 'Terrain-Wise', source: 'bestiary', cite: 'B§2', type: 'passive',
    summary: 'Removes Setback from Survival and Perception checks made inside their own patrol zone.' },
  { id: 'everywhere', name: 'Everywhere', source: 'bestiary', cite: 'B§2', type: 'passive',
    summary: 'Cannot meaningfully be avoided with Stealth in residential areas; evading their notice needs a Deception or Charm check instead.' },
  { id: 'shootOnSight', name: 'Shoot on Sight', source: 'bestiary', cite: 'B§2', type: 'passive',
    summary: 'Inside facility grounds, attacks suspected escapees without warning.' },
  { id: 'reinforcements', name: 'Reinforcements', source: 'bestiary', cite: 'B§2', type: 'triggered',
    summary: 'If the encounter runs to three rounds or more, the GM may add one more minion to the group as backup arrives.',
    trigger: { rounds: 3 } },
  { id: 'passiveWatch', name: 'Passive Watch', source: 'bestiary', cite: 'B§2', type: 'passive', heatHook: true,
    summary: 'At the start of any scene in a populated area the GM may secretly roll to see whether the informant network notices something — an Oracle roll (§18), Unlikely by default, more likely if Heat has risen recently.',
    oracle: { likelihood: 'unlikely' } },
  { id: 'environmentalAffinityWilderness', name: 'Environmental Affinity — Wilderness', source: 'bestiary', cite: 'B§3', type: 'passive',
    summary: 'The rural counterpart of the Urban entry: removes Setback from this NPC\'s tracking checks outside cities.' },
  { id: 'keenSenses', name: 'Keen Senses', source: 'bestiary', cite: 'B§5', type: 'passive',
    summary: 'Removes Setback from Perception checks made to track by scent.' },
  { id: 'bite', name: 'Bite', source: 'bestiary', cite: 'B§5', type: 'attack',
    summary: 'A Brawl attack profile.', attack: { skill: 'brawl', damage: 1, damageType: 'plusBrawn', crit: 4, range: 'engaged', qualities: ['Knockdown'] } },
  { id: 'mount', name: 'Mount', source: 'bestiary', cite: 'B§5', type: 'passive',
    summary: 'A rider adds the animal\'s Brawn to physical checks made to control or direct it; treat the animal as silhouette 1 in combat.' }
];

// T54 — NPC quick-generation — §20. Rolled on d10 (R-10).
export const NPC_QUICKGEN = {
  cite: '§20',
  die: 'd10', ruling: 'R-10',
  archetype: [
    { min: 1, max: 2,  name: 'Reich Official',     tier: 'rival', note: 'Threat 2–3' },
    { min: 3, max: 4,  name: 'Informant',          tier: 'minionOrRival' },
    { min: 5, max: 6,  name: 'Resistance Contact', tier: 'rival', note: 'Often with one unique talent' },
    { min: 7, max: 8,  name: 'Civilian/Bystander', tier: 'minion' },
    { min: 9, max: 10, name: 'Wildcard',           tier: 'any', note: 'Interpret freely' }
  ],
  disposition: [
    { min: 1, max: 3,  name: 'Hostile' },
    { min: 4, max: 6,  name: 'Neutral, self-interested' },
    { min: 7, max: 9,  name: 'Sympathetic' },
    { min: 10, max: 10, name: 'Hidden agenda', note: 'Ask the Oracle whether it runs for or against the PC' }
  ],
  tierMapping: 'Nemesis is reserved for named, recurring antagonists only.',
  motivation: 'Assign a Motivation (§12B), reflavoured for the setting: desire for survival, ideology or power; fear of exposure or reprisal.'
};

// B§1 — bestiary usage conventions. R-15 is the load-bearing one.
export const BESTIARY_CONVENTIONS = {
  cite: 'B§1',
  fields: ['Type', 'Hook', 'Characteristics', 'Derived stats', 'Skills', 'Talents and abilities', 'Equipment'],
  printedStatsAuthoritative: true, // R-15
  note: 'Published stat blocks load exactly as printed and never pass through the PC derivation in derived.js. NPCs built from the §12C recipes do derive, and are stored with derivedFrom: "recipe".',
  defenseNotation: 'melee/ranged', // R-17
  minionThresholds: 'Printed per member; group threshold is per-member times group size.' // R-18
};
