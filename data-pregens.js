// REICH '62 — published pre-generated characters — §16.
// Each is printed with 70 XP unspent and with no talents and no Motivation, so instantiating
// one drops the player into the wizard's XP and Motivation steps rather than a finished sheet.
// R-1: Anna Voss's printed Wound 11 does not match base 8 + Brawn 2 the way the other two
// pregens do; it is stored corrected to 10 with the erratum recorded and surfaced in the app.

export const PREGENS = [
  {
    id: 'annaVoss',
    name: 'Anna Voss',
    career: 'resistanceRunner',
    cite: '§16',
    attributes: { brawn: 2, agility: 3, intellect: 2, cunning: 3, willpower: 2, presence: 2 },
    skills: { skulduggery: 2, stealth: 2, streetwise: 2, cool: 1 },
    printed: { woundThreshold: 11, strainThreshold: 12, soak: 2 },
    derived: { woundThreshold: 10, strainThreshold: 12, soak: 2 },
    erratum: {
      field: 'woundThreshold', printedValue: 11, correctedValue: 10, ruling: 'R-1',
      note: 'Printed Wound 11 does not follow base 8 + Brawn 2, the formula the other two pregens do follow. Corrected to 10.'
    },
    gear: ['Forged papers (good)', 'Lockpicks', 'P38 pistol'],
    xpUnspent: 70,
    talents: [],
    motivation: null
  },
  {
    id: 'klausReiniger',
    name: 'Klaus Reiniger',
    career: 'sdGestapoAgent',
    cite: '§16',
    note: 'Defecting.',
    attributes: { brawn: 2, agility: 2, intellect: 3, cunning: 2, willpower: 3, presence: 2 },
    skills: { coercion: 2, perception: 2, knowledge: 2, discipline: 1 },
    printed: { woundThreshold: 10, strainThreshold: 13, soak: 2 },
    derived: { woundThreshold: 10, strainThreshold: 13, soak: 2 },
    erratum: null,
    gear: ['SD credentials', 'P38 pistol', 'Shortwave radio access'],
    xpUnspent: 70,
    talents: [],
    motivation: null
  },
  {
    id: 'eliseBauer',
    name: 'Elise Bauer',
    career: 'blackMarketFixer',
    cite: '§16',
    attributes: { brawn: 2, agility: 2, intellect: 2, cunning: 3, willpower: 2, presence: 3 },
    skills: { negotiation: 2, streetwise: 2, deception: 2, charm: 1 },
    printed: { woundThreshold: 10, strainThreshold: 12, soak: 2 },
    derived: { woundThreshold: 10, strainThreshold: 12, soak: 2 },
    erratum: null,
    gear: ['Ration cards (forged)', 'Miniature camera', 'Contacts list'],
    xpUnspent: 70,
    talents: [],
    motivation: null
  }
];

export const PREGEN_NOTE = 'Every pregen runs on PC rules and arrives with 70 XP unspent, no talents and no Motivation (§16).';
