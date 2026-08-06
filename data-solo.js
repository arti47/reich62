// REICH '62 — official solo play tables — §15A, §15B, §18, §19, §23.
// R-10: every table here is rolled on a d10. The manual calls these "1 Ability die read
// 1–10" while §1 defines the Ability die as a d8; they are table lookups rather than
// symbol rolls, so R-B1 does not apply and the app rolls them digitally.

// T56 — Oracle — §18
export const ORACLE = {
  cite: '§18',
  likelihoods: [
    { id: 'likely',  name: 'Likely',  ability: 2, difficulty: 1 },
    { id: 'fiftyFifty', name: '50-50', ability: 2, difficulty: 2 },
    { id: 'unlikely', name: 'Unlikely', ability: 1, difficulty: 2 }
  ],
  interpretation: [
    { id: 'yes',    when: 'Net Success',                              answer: 'Yes' },
    { id: 'no',     when: 'Net Failure',                              answer: 'No' },
    { id: 'yesAnd', when: 'An emphatic yes — 2 or more net Success with no Threat left over, or an uncancelled Triumph', answer: 'Yes, and…', note: 'A favourable complication; roll a Random Event.', ruling: 'R-22' },
    { id: 'noAnd',  when: 'An emphatic no — 2 or more net Failure with no Advantage left over, or an uncancelled Despair', answer: 'No, and…', note: 'An adverse complication; roll a Random Event. Feeds Heat if the question concerned a surveilled context.', heatHook: true, ruling: 'R-22' },
    { id: 'yesBut', when: 'Net Advantage with no net Success or Failure', answer: 'Yes, but… / No, but…', note: 'Interpret narratively.' }
  ],
  // R-22 — §18.1 keys "Yes, and" to a Triumph and "No, and" to a Despair, but its own pools
  // are Ability against Difficulty, and per D§ Triumph appears only on the Proficiency die
  // and Despair only on the Challenge die. As printed the two rows, the §19 Random Event
  // chain and the §17.1 Oracle Heat hook can never fire. The confirmed reading is by
  // magnitude: an emphatic result stands in for the symbol. A Triumph or Despair that does
  // occur — on a pool upgraded by a Story Point — still reads the same way.
  magnitude: {
    ruling: 'R-22',
    andThreshold: 2,
    yesAnd: 'Two or more net Success with no Threat left over.',
    noAnd: 'Two or more net Failure with no Advantage left over.',
    badge: 'inferred — the printed pool cannot roll a Triumph or a Despair'
  },
  // R-22, second half — the same magnitude reading, carried the whole way up and down the
  // scale rather than stopping at the "and" rung. How many net Success or Failure survive
  // says how hard the answer lands; leftover Advantage or Threat rides alongside it as the
  // string attached. Both are read off the printed symbols; nothing is added to the pool.
  intensity: {
    ruling: 'R-22',
    // `min` is the number of net Success (for a yes) or net Failure (for a no). The wording
    // describes the result rather than instructing the player, and never repeats the yes or
    // no the answer above it already gives.
    levels: [
      { min: 0, id: 'marginal',     note: 'It barely tipped that way.' },
      { min: 1, id: 'slight',       note: 'A straightforward result.' },
      { min: 2, id: 'clear',        note: 'A solid result.' },
      { min: 3, id: 'strong',       note: 'A powerful result — more than you asked for.' },
      { min: 4, id: 'overwhelming', note: 'About as decisive as the dice get.' }
    ],
    // Leftover Threat on a yes, or Advantage on a no, is the string attached.
    riders: [
      { min: 1, id: 'minor',   againstYou: 'small',   yourWay: 'small' },
      { min: 2, id: 'notable', againstYou: 'real',    yourWay: 'real' },
      { min: 3, id: 'major',   againstYou: 'serious', yourWay: 'big' }
    ],
    riderNote: {
      threat: 'There\'s a catch: something {x} goes against you.',
      advantage: 'One consolation: something {x} still goes your way.'
    }
  },
  procedure: [
    'Frame the question and set its likelihood.',
    'Roll the listed Ability dice against the listed Difficulty dice.',
    'Read the result with the normal resolution rules.'
  ]
};

// T57 — Meaning tables — §15A
export const MEANING = {
  cite: '§15A',
  die: 'd10',
  action: [
    { roll: 1, word: 'Betray' }, { roll: 2, word: 'Discover' }, { roll: 3, word: 'Escape' },
    { roll: 4, word: 'Threaten' }, { roll: 5, word: 'Negotiate' }, { roll: 6, word: 'Conceal' },
    { roll: 7, word: 'Pursue' }, { roll: 8, word: 'Sabotage' }, { roll: 9, word: 'Trust' },
    { roll: 10, word: 'Expose' }
  ],
  subject: [
    { roll: 1, word: 'An informant' }, { roll: 2, word: 'A safehouse' }, { roll: 3, word: 'A document or microfilm' },
    { roll: 4, word: 'A Reich official' }, { roll: 5, word: 'A family member' }, { roll: 6, word: 'A border crossing' },
    { roll: 7, word: 'A radio transmission' }, { roll: 8, word: 'A weapon cache' }, { roll: 9, word: 'An old contact' },
    { roll: 10, word: 'A checkpoint' }
  ],
  usage: 'Roll on both and combine the two words into a phrase, then interpret it in context.'
};

// T58 — Element tables — §15B
export const ELEMENTS = {
  cite: '§15B',
  die: 'd10',
  location: [
    { roll: 1, entry: 'Train station or rail checkpoint' },
    { roll: 2, entry: 'Surveilled apartment block' },
    { roll: 3, entry: 'Black-market district or back alley' },
    { roll: 4, entry: 'Government administrative building' },
    { roll: 5, entry: 'Rural farmhouse or safehouse' },
    { roll: 6, entry: 'Factory or labour-camp perimeter' },
    { roll: 7, entry: 'Café or bar frequented by informants' },
    { roll: 8, entry: 'River or canal crossing' },
    { roll: 9, entry: 'Forest or border wilderness' },
    { roll: 10, entry: 'Church or other tolerated gathering place' }
  ],
  faction: [
    { roll: 1, entry: 'Gestapo or SD' },
    { roll: 2, entry: 'Wehrmacht regulars' },
    { roll: 3, entry: 'A local resistance cell, rival or allied' },
    { roll: 4, entry: 'A black-market syndicate' },
    { roll: 5, entry: 'Party bureaucracy and civil administration' },
    { roll: 6, entry: 'A displaced or refugee network' },
    { roll: 7, entry: 'Foreign intelligence' },
    { roll: 8, entry: 'Collaborationist local police' },
    { roll: 9, entry: 'An internal reformist faction' },
    { roll: 10, entry: 'A neutral-country diplomatic presence' }
  ],
  complication: [
    { roll: 1, entry: 'A trusted contact is compromised' },
    { roll: 2, entry: 'Documents or equipment are lost or damaged' },
    { roll: 3, entry: 'An unexpected witness' },
    { roll: 4, entry: 'A schedule or deadline moves up' },
    { roll: 5, entry: 'Weather or transport failure' },
    { roll: 6, entry: 'A personal relationship is jeopardised' },
    { roll: 7, entry: 'Money or ration cards run short' },
    { roll: 8, entry: 'A misunderstanding with an ally' },
    { roll: 9, entry: 'An old enemy resurfaces' },
    { roll: 10, entry: 'The objective is not what it seemed' }
  ]
};

// T59 — Random Event — §19
export const RANDOM_EVENT = {
  cite: '§19',
  die: 'd10',
  trigger: 'Any Oracle result carrying a Triumph or a Despair, or on demand when framing a scene.',
  category: [
    { min: 1, max: 2,  entry: 'NPC action' },
    { min: 3, max: 4,  entry: 'Reich interference' },
    { min: 5, max: 6,  entry: 'Complication or twist', pairsWith: 'complication' },
    { min: 7, max: 8,  entry: 'Ally or opportunity' },
    { min: 9, max: 10, entry: 'Remote event — a shift in the wider world' }
  ],
  subject: [
    { min: 1, max: 3,  entry: 'The current PC or scene' },
    { min: 4, max: 6,  entry: 'The Cell or the Heat state' },
    { min: 7, max: 8,  entry: 'An unresolved thread from earlier' },
    { min: 9, max: 10, entry: 'Something new — interpret freely' }
  ],
  skew: 'A Triumph skews the event favourable; a Despair skews it toward escalation, often raising Heat.'
};

// T60 — Solo play loop — §23
export const SOLO_LOOP = {
  cite: '§23',
  steps: [
    'Frame the scene yourself: where the character is, and what they want.',
    'Ask the Oracle whenever the outcome is uncertain and no roll of the character\'s applies.',
    'On a Triumph or Despair from the Oracle, roll the Random Event table to inject content.',
    'Resolve the character\'s own actions with ordinary skill checks, exactly as in group play.',
    'Generate NPCs as needed with quick-gen.',
    'Track suspicion exactly as in group play; at suspicion 4 or 5 the Oracle decides when a raid or arrest lands, rather than you deciding it.',
    'Repeat until the scene resolves, then frame the next one.'
  ],
  heatRule: { fromLevel: 4, note: 'At suspicion 4 or 5, the Oracle decides when the raid or arrest lands.' }
};
