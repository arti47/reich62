// wizard.js — character creation (§13) and pregen instantiation (§16).
// Order: career → four career skills → 70 XP → derived → Motivation → gear.
// No illegal character can be saved: every step validates before it will advance.

import { el, clear, titleCase } from './core.js';
import { showToast, modal, panel, subTabs, accordion, emptyState } from './ui.js';
import { PANELS } from './help.js';
import {
  CAREERS, SKILLS, CHARACTERISTICS, MOTIVATIONS, CREATION_RULES, XP_COSTS, TALENT_RULES,
  CHARACTERISTIC_MIN, CHARACTERISTIC_MAX, SKILL_RANK_MAX_AT_CREATION, GEAR, WEAPONS, ARMOUR,
  BASE_WOUND_THRESHOLD, BASE_STRAIN_THRESHOLD
} from '../data.js';
import { PREGENS } from '../data-pregens.js';
import { canBuyTalent, pyramidLegal, visibleTalents, xpCost, talent, career as careerById } from './rules.js';
import { blankCharacter, derivedFor, normalise } from './derived.js';
import { saveCharacter, setActiveCharacter } from './store.js';
import { Settings } from './settings.js';
import { rollDie } from './core.js';

const STEPS = ['start', 'career', 'skills', 'xp', 'derived', 'motivation', 'gear', 'review'];

const XP_TABS = [
  { id: 'characteristics', label: 'Characteristics' },
  { id: 'skills',          label: 'Skills' },
  { id: 'talents',         label: 'Talents' }
];
let xpTab = 'characteristics';
let skillFilter = '';
let talentFilter = '';
let gearFilter = '';

const STEP_HELP = {
  start: { lede: 'Two ways in: take a character the book already wrote, or build one from scratch.', detail: 'The three ready-made characters come with their characteristics, four skills and their gear already set, but the book prints them with all 70 experience still unspent and no talents or motivation \u2014 so either way you finish the same steps. Building from a career takes a few minutes longer and the choices are all yours.' },
  career: { lede: 'Your background. It decides which skills stay cheap for you, for good.', detail: 'Pick a career, then choose four of its eight skills to start at rank 1. All eight stay cheaper to raise for the rest of this character\'s life, so the four you pick now are a head start rather than a limit.' },
  skills: { lede: 'Choose four of your career\'s eight skills. Each starts at rank 1.', detail: 'There is no wrong answer: the other four are still cheap to buy later.' },
  xp: { lede: 'Every character gets the same 70 experience. Spend it here.', detail: 'Characteristics can only be raised now, at ten times the new rating per step. Skills cost five times the new rank, plus five if they are not career skills, and stop at rank 2 during creation. Talents cost five times their tier and follow the pyramid rule.' },
  derived: { lede: 'The numbers that fall out of your choices.', detail: 'Injury and stress limits are fixed when creation ends; only talents raise them afterwards. Damage resisted keeps pace with Brawn.' },
  motivation: { lede: 'What drives your character, and what trips them up.', detail: 'One of each: a desire, a fear, a strength and a flaw. They are the levers other people use on you socially, and playing to them earns extra experience at the end of a session.' },
  gear: { lede: 'Spend the starting money on equipment.', detail: 'The book prints prices but never names the currency or the starting budget, so both are house aids you can change in Settings.' },
  review: { lede: 'A last look before the character is saved.', detail: 'Only characteristics lock at this point; skills, talents and gear all keep growing through play.' }
};

/** A legal 70-XP spread for the chosen career, as a starting point to adjust.
 *  Raises the characteristics behind the chosen skills, then the skills themselves. */
export function suggestedSpend() {
  const careerDef = careerById(draft.identity.career);
  if (!careerDef) return { ok: false, reason: 'Choose a career first.' };
  const picks = draft.identity.careerSkills.length ? draft.identity.careerSkills : careerDef.skills.slice(0, 4);
  const wanted = [];
  picks.forEach((id) => {
    const def = SKILLS.find((sk) => sk.id === id);
    if (def && !wanted.includes(def.characteristic)) wanted.push(def.characteristic);
  });

  const applied = [];
  wanted.slice(0, 2).forEach((charId) => {
    while (draft.attributes[charId] < 3) {
      if (raiseCharacteristic(charId)) break;
      applied.push(`${titleCase(charId)} to ${draft.attributes[charId]}`);
    }
  });
  picks.forEach((id) => {
    while (draft.skills[id].rank < SKILL_RANK_MAX_AT_CREATION) {
      if (raiseSkill(id)) break;
      applied.push(`${titleCase(id)} to rank ${draft.skills[id].rank}`);
    }
  });
  return { ok: true, applied, remaining: draft.xp.available };
}

let draft = null;
let step = 0;
let rerender = () => {};

export function startWizard({ pregenId = null } = {}) {
  draft = blankCharacter();
  draft.xp = { total: CREATION_RULES.startingXp, available: CREATION_RULES.startingXp };
  draft.creation = { open: true, spend: [] };
  if (pregenId) applyPregen(pregenId);
  step = pregenId ? STEPS.indexOf('xp') : 0;
  return draft;
}

function applyPregen(id) {
  const pregen = PREGENS.find((p) => p.id === id);
  if (!pregen) return;
  draft.identity.name = pregen.name;
  draft.identity.career = pregen.career;
  draft.identity.pregenId = pregen.id;
  Object.assign(draft.attributes, pregen.attributes);
  const careerDef = careerById(pregen.career);
  Object.entries(pregen.skills).forEach(([skillId, rank]) => {
    draft.skills[skillId] = { rank, career: careerDef.skills.includes(skillId) };
  });
  careerDef.skills.forEach((s) => { draft.skills[s].career = true; });
  draft.identity.careerSkills = Object.keys(pregen.skills);
  draft.inventory.items = pregen.gear.map((g, i) => ({ id: `pregen-${i}`, name: g, encumbrance: 0, qty: 1, kind: 'gear' }));
  if (pregen.erratum) draft.identity.erratum = pregen.erratum; // R-1, surfaced on the sheet
}

// --- legality ---
export function validateStep(index = step) {
  const name = STEPS[index];
  if (name === 'start') return null; // either path is legal; the fork itself decides where to go
  if (name === 'career') {
    if (!draft.identity.career) return 'Choose a career first.';
  }
  if (name === 'skills') {
    if (draft.identity.careerSkills.length !== CREATION_RULES.careerSkillPicks) {
      return `Pick exactly ${CREATION_RULES.careerSkillPicks} career skills.`;
    }
  }
  if (name === 'xp') {
    if (draft.xp.available < 0) return 'You have spent more XP than you have.';
    const overRank = Object.entries(draft.skills).find(([, s]) => s.rank > SKILL_RANK_MAX_AT_CREATION);
    if (overRank) return `Skill ranks cannot pass ${SKILL_RANK_MAX_AT_CREATION} during creation.`;
    const overChar = Object.entries(draft.attributes).find(([, v]) => v > CHARACTERISTIC_MAX);
    if (overChar) return `Characteristics cannot pass ${CHARACTERISTIC_MAX}.`;
    const pyramid = pyramidLegal(heldTalents());
    if (!pyramid.ok) return pyramid.reason;
    // The recorded spends must reconcile with the experience actually gone, so no path can
    // leave the two out of step.
    const spent = draft.creation.spend.reduce((sum, e) => sum + e.cost, 0);
    if (draft.xp.total - spent !== draft.xp.available) {
      return `Experience does not reconcile: ${spent} recorded as spent but ${draft.xp.total - draft.xp.available} gone.`;
    }
  }
  if (name === 'motivation') {
    const m = draft.identity.motivation;
    if (!m.desire || !m.fear || !m.strength || !m.flaw) return 'Choose one of each Motivation facet.';
  }
  if (name === 'gear') {
    if (gearSpent() > Settings.startingBudget()) return `Over the starting budget of ${Settings.startingBudget()} ${Settings.currencyLabel()}.`;
  }
  return null;
}

function gearSpent() {
  return (draft.inventory.items || []).reduce((sum, i) => sum + (Number(i.price) || 0) * (i.qty || 1), 0);
}

// --- XP spending ---
function spendXp(cost, entry) {
  draft.xp.available -= cost;
  draft.creation.spend.push({ ...entry, cost });
  draft.advancementLog.push({ ts: Date.now(), kind: entry.kind, detail: entry.detail, xpSpent: cost });
}

function refundXp(entry) {
  draft.xp.available += entry.cost;
  const index = draft.creation.spend.lastIndexOf(entry);
  if (index >= 0) draft.creation.spend.splice(index, 1);
}

/** Refund every recorded spend that matches, so a change of mind never leaves experience
 *  paid for something the character no longer has. */
function refundAllWhere(predicate) {
  let refunded = 0;
  draft.creation.spend.filter(predicate).forEach((entry) => { refunded += entry.cost; refundXp(entry); });
  return refunded;
}

export function raiseCharacteristic(id) {
  const current = draft.attributes[id];
  if (current >= CHARACTERISTIC_MAX) return `Maximum ${CHARACTERISTIC_MAX} at creation.`;
  const cost = xpCost('characteristic', { newRating: current + 1 });
  if (cost > draft.xp.available) return `Costs ${cost} XP; only ${draft.xp.available} left.`;
  draft.attributes[id] = current + 1;
  spendXp(cost, { kind: 'characteristic', id, detail: `${titleCase(id)} to ${current + 1}` });
  return null;
}

export function lowerCharacteristic(id) {
  const current = draft.attributes[id];
  if (current <= CHARACTERISTIC_MIN) return null;
  const entry = [...draft.creation.spend].reverse().find((s) => s.kind === 'characteristic' && s.id === id);
  if (!entry) return null;
  draft.attributes[id] = current - 1;
  refundXp(entry);
  return null;
}

export function raiseSkill(id) {
  const skill = draft.skills[id];
  if (skill.rank >= SKILL_RANK_MAX_AT_CREATION) return `Capped at rank ${SKILL_RANK_MAX_AT_CREATION} during creation.`;
  const cost = xpCost('skill', { newRank: skill.rank + 1, career: skill.career });
  if (cost > draft.xp.available) return `Costs ${cost} XP; only ${draft.xp.available} left.`;
  skill.rank += 1;
  spendXp(cost, { kind: 'skill', id, detail: `${id} to rank ${skill.rank}` });
  return null;
}

export function lowerSkill(id) {
  const entry = [...draft.creation.spend].reverse().find((s) => s.kind === 'skill' && s.id === id);
  if (!entry) return null;
  draft.skills[id].rank -= 1;
  refundXp(entry);
  return null;
}

export function buyTalent(id) {
  const held = heldTalents();
  const legality = canBuyTalent(id, held);
  if (!legality.ok) return legality.reason;
  if (legality.cost > draft.xp.available) return `Costs ${legality.cost} XP; only ${draft.xp.available} left.`;
  const existing = draft.talents.find((t) => t.id === id);
  if (existing) existing.ranks += 1; else draft.talents.push({ id, tier: talent(id).tier, ranks: 1 });
  spendXp(legality.cost, { kind: 'talent', id, detail: `${talent(id).name} (tier ${legality.tier})` });
  return null;
}

export function sellTalent(id) {
  const entry = [...draft.creation.spend].reverse().find((s) => s.kind === 'talent' && s.id === id);
  if (!entry) return null;
  const held = draft.talents.find((t) => t.id === id);
  if (!held) return null;
  // Refunding a lower-tier talent can leave more talents in a tier than the one below it,
  // which the pyramid forbids (§7). The refund is refused rather than silently allowed.
  const after = {};
  draft.talents.forEach((t) => { after[t.id] = t.ranks; });
  after[id] = (after[id] || 1) - 1;
  if (!after[id]) delete after[id];
  const legality = pyramidLegal(after);
  if (!legality.ok) return `${legality.reason} Refund a tier ${legality.tier} talent first.`;

  held.ranks -= 1;
  if (held.ranks <= 0) draft.talents = draft.talents.filter((t) => t.id !== id);
  refundXp(entry);
  return null;
}

function heldTalents() {
  const map = {};
  draft.talents.forEach((t) => { map[t.id] = t.ranks; });
  return map;
}

export function pickCareer(id) {
  if (draft.identity.career === id) return null;
  // Changing career wipes every skill rank, so the experience spent on those ranks comes
  // back with them rather than staying paid for something the character no longer has.
  const refunded = refundAllWhere((e) => e.kind === 'skill');
  draft.identity.career = id;
  draft.identity.careerSkills = [];
  SKILLS.forEach((s) => { draft.skills[s.id] = { rank: 0, career: false }; });
  careerById(id).skills.forEach((s) => { draft.skills[s].career = true; });
  return refunded ? { refunded } : null;
}

export function toggleCareerSkill(id) {
  const picks = draft.identity.careerSkills;
  const at = picks.indexOf(id);
  if (at >= 0) {
    // Dropping the pick drops the free rank it granted and refunds anything paid on top,
    // so the rank and the experience never fall out of step.
    picks.splice(at, 1);
    refundAllWhere((e) => e.kind === 'skill' && e.id === id);
    draft.skills[id].rank = 0;
    return null;
  }
  if (picks.length >= CREATION_RULES.careerSkillPicks) return `Only ${CREATION_RULES.careerSkillPicks} picks.`;
  picks.push(id);
  draft.skills[id].rank += 1;
  return null;
}

/** Unspent budget is kept, and a d100 of pocket money is rolled after the gear is
 *  bought. Pocket money is spending money in play; it cannot buy more starting gear. */
export function rollPocketMoney() {
  draft.identity.pocketMoney = rollDie(CREATION_RULES.houseAid.pocketMoney.die);
  return draft.identity.pocketMoney;
}

export function startingCash() {
  const unspent = Math.max(0, Settings.startingBudget() - gearSpent());
  const pocket = draft.identity.pocketMoney || 0;
  return { unspent, pocket, total: unspent + pocket };
}

export function rollMotivation(facet) {
  const table = MOTIVATIONS[facet];
  const roll = rollDie(10); // R-10
  draft.identity.motivation[facet] = table.find((e) => e.roll === roll).name;
  return draft.identity.motivation[facet];
}

export function finish() {
  for (let i = 0; i < STEPS.length - 1; i += 1) {
    const problem = validateStep(i);
    if (problem) return { ok: false, reason: problem, step: i };
  }
  const character = normalise(draft);
  character.creation = { open: false, completedAt: Date.now() };
  // Whatever was not spent on gear, plus the pocket money, becomes the character's cash.
  const cash = startingCash();
  character.inventory.money.amount = (character.inventory.money.amount || 0) + cash.total;
  character.state.wounds = 0;
  character.state.strain = 0;
  const saved = saveCharacter(character);
  setActiveCharacter(saved.id);
  // The draft is finished, so the wizard starts clean next time rather than reopening the
  // saved character at its review step and offering to save it a second time.
  draft = null;
  step = 0;
  return { ok: true, character: saved };
}

export function currentDraft() { return draft; }
export function currentStep() { return STEPS[step]; }

// --- rendering ---
export function renderWizard(mount) {
  clear(mount);
  rerender = () => renderWizard(mount);
  if (!draft) startWizard();

  const stepName = STEPS[step];
  mount.append(panel(`Step ${step + 1} of ${STEPS.length}: ${titleCase(stepName)}`, STEP_HELP[stepName], [
    el('p', { class: 'small muted', text: `${draft.xp.available} of ${draft.xp.total} experience left to spend` })
  ]));

  const body = el('div', { class: 'card' });
  ({
    start: renderStartStep, career: renderCareerStep, skills: renderSkillsStep, xp: renderXpStep,
    derived: renderDerivedStep, motivation: renderMotivationStep, gear: renderGearStep,
    review: renderReviewStep
  })[STEPS[step]](body);
  mount.append(body);

  const problem = validateStep();
  const nav = el('div', { class: 'card' }, [
    problem ? el('p', { class: 'small', text: problem }) : null,
    el('button', { type: 'button', class: 'secondary', text: 'Back', disabled: step === 0, onclick: () => { step -= 1; rerender(); } }),
    ' ',
    step < STEPS.length - 1
      ? el('button', {
          type: 'button', class: 'primary', text: 'Next', disabled: !!problem,
          onclick: () => { if (!validateStep()) { step += 1; rerender(); } }
        })
      : el('button', {
          type: 'button', class: 'primary', text: 'Save character',
          onclick: () => {
            const result = finish();
            if (!result.ok) { showToast(result.reason); step = result.step; rerender(); return; }
            showToast(`${result.character.identity.name || 'Character'} saved`);
            location.hash = '#/sheet';
          }
        })
  ]);
  mount.append(nav);
}

/** The fork: a ready-made character, or one built from a career (C-3). */
function renderStartStep(node) {
  node.append(el('h3', { text: 'Start from a ready-made character' }));
  node.append(el('p', { class: 'small muted', text: 'The book prints these three with all 70 experience still unspent and no talents or motivation, so picking one drops you straight into spending it.' }));
  PREGENS.forEach((p) => {
    node.append(el('div', { class: 'result' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: p.name }),
        el('span', { class: 'cite', text: careerById(p.career).name })
      ]),
      el('div', { class: 'result-body', text: `${Object.entries(p.skills).map(([id, r]) => `${titleCase(id)} ${r}`).join(', ')}. Carries ${p.gear.join(', ')}.` }),
      el('button', {
        type: 'button', class: 'secondary', id: `pregen-${p.id}`,
        text: `Play ${p.name}`,
        onclick: () => { startWizard({ pregenId: p.id }); showToast(`${p.name} loaded — 70 experience still to spend`); rerender(); }
      })
    ]));
  });

  node.append(el('h3', { text: 'Or build one from a career' }));
  node.append(el('p', { class: 'small muted', text: 'Eleven careers, about five minutes, and the app checks every rule as you go so an illegal character cannot be saved.' }));
  node.append(el('button', {
    type: 'button', class: 'primary', id: 'build-from-career', text: 'Build my own',
    onclick: () => { step = STEPS.indexOf('career'); rerender(); }
  }));
}

function renderCareerStep(node) {
  node.append(el('label', { class: 'small', for: 'char-name', text: 'Name' }));
  node.append(el('input', {
    type: 'text', id: 'char-name', value: draft.identity.name,
    oninput: (e) => { draft.identity.name = e.target.value; }
  }));
  node.append(el('h3', { text: 'Career' }));
  CAREERS.forEach((c) => {
    node.append(el('div', { class: 'toggle-row' }, [
      el('input', {
        type: 'radio', name: 'career', id: `career-${c.id}`, checked: draft.identity.career === c.id,
        onchange: () => {
          const result = pickCareer(c.id);
          if (result && result.refunded) showToast(`Career changed — ${result.refunded} experience refunded with the skill ranks it wiped.`);
          rerender();
        }
      }),
      el('label', { for: `career-${c.id}` }, [
        el('span', { text: c.name }),
        el('span', { class: 'toggle-desc', text: `${c.summary} Skills: ${c.skills.map((s) => titleCase(s)).join(', ')}.` })
      ])
    ]));
  });

}

function renderSkillsStep(node) {
  const careerDef = careerById(draft.identity.career);
  node.append(el('p', { class: 'small', text: `Pick ${CREATION_RULES.careerSkillPicks} of the ${careerDef.name}'s eight career skills; each starts at rank 1. All eight stay career-priced.` }));
  careerDef.skills.forEach((id) => {
    const picked = draft.identity.careerSkills.includes(id);
    node.append(el('div', { class: 'toggle-row' }, [
      el('input', {
        type: 'checkbox', id: `pick-${id}`, checked: picked,
        onchange: () => { const problem = toggleCareerSkill(id); if (problem) showToast(problem); rerender(); }
      }),
      el('label', { for: `pick-${id}` }, [el('span', { text: titleCase(id) })])
    ]));
  });
}

function renderXpStep(node) {
  node.append(el('button', {
    type: 'button', class: 'primary', id: 'suggest-spend',
    text: 'Suggest a spread for my career',
    onclick: () => {
      const result = suggestedSpend();
      if (!result.ok) { showToast(result.reason); return; }
      showToast(`Spent on ${result.applied.slice(0, 3).join(', ')}${result.applied.length > 3 ? ' and more' : ''}`);
      rerender();
    }
  }));
  node.append(el('p', { class: 'small muted', text: 'It only spends what you have, and every part of it can be undone with the minus buttons.' }));
  node.append(subTabs(XP_TABS, xpTab, (id) => { xpTab = id; rerender(); }));

  if (xpTab === 'characteristics') {
    node.append(el('p', { class: 'lede', text: 'Raise these now or never — after creation only the Dedication talent can.' }));
    const grid = el('div', { class: 'stat-grid' });
    CHARACTERISTICS.forEach((c) => {
      const value = draft.attributes[c.id];
      grid.append(el('div', { class: 'stat' }, [
        el('span', { class: 'stat-label', text: c.name }),
        el('span', { class: 'stat-value', text: String(value) }),
        el('button', { type: 'button', class: 'secondary', text: '−', 'aria-label': `Lower ${c.name}`, onclick: () => { lowerCharacteristic(c.id); rerender(); } }),
        el('button', {
          type: 'button', class: 'secondary', text: `+ (${xpCost('characteristic', { newRating: value + 1 })})`, 'aria-label': `Raise ${c.name}`,
          onclick: () => { const problem = raiseCharacteristic(c.id); if (problem) showToast(problem); rerender(); }
        })
      ]));
    });
    node.append(grid);
  }

  if (xpTab === 'skills') {
    node.append(el('p', { class: 'lede', text: `Career skills are marked with a dot and cost less. Nothing passes rank ${SKILL_RANK_MAX_AT_CREATION} during creation.` }));
    node.append(el('input', {
      type: 'search', id: 'skill-filter', placeholder: 'Filter skills', 'aria-label': 'Filter skills', value: skillFilter,
      oninput: (e) => { skillFilter = e.target.value; rerender(); }
    }));
    const table = el('table');
    table.append(el('tr', {}, [el('th', { text: 'Skill' }), el('th', { text: 'Rank' }), el('th', { text: 'Cost' }), el('th', { text: '' })]));
    const needle = skillFilter.trim().toLowerCase();
    SKILLS.filter((sk) => !needle || sk.name.toLowerCase().includes(needle))
      .slice()
      .sort((a, b) => (draft.skills[b.id].career ? 1 : 0) - (draft.skills[a.id].career ? 1 : 0))
      .forEach((sk) => {
        const skill = draft.skills[sk.id];
        const next = xpCost('skill', { newRank: skill.rank + 1, career: skill.career });
        table.append(el('tr', {}, [
          el('td', { text: `${sk.name}${skill.career ? ' ●' : ''}` }),
          el('td', { text: String(skill.rank) }),
          el('td', { text: skill.rank >= SKILL_RANK_MAX_AT_CREATION ? '—' : String(next) }),
          el('td', {}, [
            el('button', { type: 'button', class: 'secondary', text: '−', 'aria-label': `Lower ${sk.name}`, onclick: () => { lowerSkill(sk.id); rerender(); } }),
            el('button', { type: 'button', class: 'secondary', text: '+', 'aria-label': `Raise ${sk.name}`, onclick: () => { const p = raiseSkill(sk.id); if (p) showToast(p); rerender(); } })
          ])
        ]));
      });
    node.append(el('div', { class: 'table-wrap' }, [table]));
  }

  if (xpTab === 'talents') {
    node.append(el('p', { class: 'lede', text: 'Talents cost five times their tier. You need as many talents in the tier below as you are about to have in the tier above.' }));
    node.append(el('input', {
      type: 'search', id: 'talent-filter', placeholder: 'Filter talents', 'aria-label': 'Filter talents', value: talentFilter,
      oninput: (e) => { talentFilter = e.target.value; rerender(); }
    }));
    const held = heldTalents();
    const needle = talentFilter.trim().toLowerCase();
    const all = visibleTalents(Settings.showNonSettingTalents())
      .filter((t) => !needle || `${t.name} ${t.summary}`.toLowerCase().includes(needle));
    [1, 2, 3, 4, 5].forEach((tier) => {
      const inTier = all.filter((t) => t.tier === tier);
      if (!inTier.length) return;
      const body = el('div', {});
      inTier.forEach((t) => {
        const legality = canBuyTalent(t.id, held);
        const ranks = held[t.id] || 0;
        body.append(el('div', { class: 'result' }, [
          el('div', { class: 'result-head' }, [
            el('span', { class: 'result-title', text: `${t.name}${ranks ? ` ×${ranks}` : ''}` }),
            el('span', { class: 'cite', text: `${TALENT_RULES.costPerTier[t.tier - 1]} XP` })
          ]),
          el('div', { class: 'result-body', text: t.summary }),
          el('button', {
            type: 'button', class: 'secondary', text: legality.ok ? 'Buy' : 'Locked', disabled: !legality.ok,
            title: legality.ok ? '' : legality.reason,
            onclick: () => { const p = buyTalent(t.id); if (p) showToast(p); rerender(); }
          }),
          legality.ok ? null : el('span', { class: 'toggle-desc', text: legality.reason }),
          ranks ? el('button', {
          type: 'button', class: 'secondary', text: 'Refund', 'aria-label': `Refund ${t.name}`,
          onclick: () => { const problem = sellTalent(t.id); if (problem) showToast(problem); rerender(); }
        }) : null
        ]));
      });
      node.append(accordion(`Tier ${tier} — ${TALENT_RULES.costPerTier[tier - 1]} XP each`, [body], {
        key: `wizard-talents-t${tier}`, summary: `${inTier.length} talent${inTier.length === 1 ? '' : 's'}`, defaultOpen: tier === 1 || !!needle
      }));
    });
    if (!all.length) node.append(emptyState('No talents match that filter.'));
  }
}

function renderDerivedStep(node) {
  const derived = derivedFor(draft);
  node.append(el('p', { class: 'small' }, [
    el('span', { class: 'badge badge-inferred', text: 'inferred' }), ' ',
    `Injury limit is ${BASE_WOUND_THRESHOLD} + Brawn and stress limit ${BASE_STRAIN_THRESHOLD} + Willpower. The book states both bases, and flags them as inferred: nothing in the original text printed them, and this pair is what the ready-made characters agree on.`
  ]));
  node.append(el('div', { class: 'stat-grid' }, [
    stat('Wound Threshold', derived.woundThreshold),
    stat('Strain Threshold', derived.strainThreshold),
    stat('Soak', derived.soak),
    stat('Melee Defence', derived.meleeDefense),
    stat('Ranged Defence', derived.rangedDefense),
    stat('Encumbrance Threshold', derived.encumbranceThreshold)
  ]));
  if (draft.identity.erratum) {
    node.append(el('p', { class: 'small' }, [
      el('span', { class: 'badge badge-inferred', text: 'erratum' }), ' ', draft.identity.erratum.note
    ]));
  }
}

function stat(label, value) {
  return el('div', { class: 'stat' }, [
    el('span', { class: 'stat-label', text: label }),
    el('span', { class: 'stat-value', text: String(value) })
  ]);
}

function renderMotivationStep(node) {
  node.append(el('p', { class: 'small muted', text: 'One of each facet, rolled on a d10 or chosen. Motivations are social-encounter targets and earn bonus XP when played to.' }));
  ['desire', 'fear', 'strength', 'flaw'].forEach((facet) => {
    const select = el('select', {
      id: `motivation-${facet}`, 'aria-label': titleCase(facet),
      onchange: (e) => { draft.identity.motivation[facet] = e.target.value || null; rerender(); }
    });
    select.append(el('option', { value: '', text: '—' }));
    MOTIVATIONS[facet].forEach((m) => {
      select.append(el('option', { value: m.name, text: m.detail ? `${m.name} — ${m.detail}` : m.name, selected: draft.identity.motivation[facet] === m.name }));
    });
    node.append(el('div', { class: 'toggle-row' }, [
      el('label', { for: `motivation-${facet}` }, [el('span', { text: titleCase(facet) }), select]),
      el('button', { type: 'button', class: 'secondary', text: 'Roll', onclick: () => { rollMotivation(facet); rerender(); } })
    ]));
  });
}

function renderGearStep(node) {
  const budget = Settings.startingBudget();
  node.append(el('p', { class: 'small' }, [
    el('span', { class: 'badge badge-house', text: 'house aid — not a printed rule' }), ' ',
    `Spending ${gearSpent()} of ${budget} ${Settings.currencyLabel()}.`
  ]));

  // Pocket money: rolled once, after the shopping, and kept apart from the budget.
  const cash = startingCash();
  const pocketRow = el('div', { class: 'result' }, [
    el('div', { class: 'result-head' }, [
      el('span', { class: 'result-title', text: 'Pocket money' }),
      el('span', { class: 'cite', text: `d${CREATION_RULES.houseAid.pocketMoney.die}` })
    ]),
    el('div', { class: 'result-body', text: draft.identity.pocketMoney
      ? `Rolled ${draft.identity.pocketMoney} ${Settings.currencyLabel()}. It cannot buy more starting gear, but you keep it to spend in play.`
      : 'Roll this once you have finished shopping. It cannot buy more starting gear — it is money in your pocket when play begins.' })
  ]);
  pocketRow.append(el('button', {
    type: 'button', class: 'secondary', id: 'roll-pocket-money',
    text: draft.identity.pocketMoney ? 'Roll again' : 'Roll pocket money',
    onclick: () => { const rolled = rollPocketMoney(); showToast(`Pocket money: ${rolled} ${Settings.currencyLabel()}`); rerender(); }
  }));
  node.append(pocketRow);
  node.append(el('p', { class: 'small muted', text: `You will start play with ${cash.total} ${Settings.currencyLabel()}: ${cash.unspent} left from the budget${cash.pocket ? ` and ${cash.pocket} in pocket money` : ''}.` }));
  // 33 priced items in one run is unreadable, so the shop is filtered and grouped the way
  // the skills and talents steps are (C-2).
  node.append(el('input', {
    type: 'search', id: 'gear-filter', placeholder: 'Filter the shop', 'aria-label': 'Filter the shop',
    value: gearFilter, oninput: (e) => { gearFilter = e.target.value; rerender(); }
  }));
  const needle = gearFilter.trim().toLowerCase();
  const groups = [
    { id: 'weapon', label: 'Weapons', items: WEAPONS.filter((w) => w.price) },
    { id: 'armour', label: 'Armour',  items: ARMOUR.filter((a) => a.price) },
    { id: 'gear',   label: 'Everything else', items: GEAR.filter((g) => g.price) }
  ];
  let matched = 0;
  groups.forEach((group) => {
    const items = group.items
      .filter((i) => !needle || `${i.name} ${i.effect || ''}`.toLowerCase().includes(needle))
      .map((i) => ({ ...i, kind: group.id }));
    if (!items.length) return;
    matched += items.length;
    const body = el('div', {});
    items.forEach((item) => {
      const owned = (draft.inventory.items || []).filter((i) => i.id === item.id).length;
      const affordable = gearSpent() + item.price <= budget;
      body.append(el('div', { class: 'result' }, [
        el('div', { class: 'result-head' }, [
          el('span', { class: 'result-title', text: `${item.name}${owned ? ` ×${owned}` : ''}` }),
          el('span', { class: 'cite', text: `${item.price} ${Settings.currencyLabel()} · rarity ${item.rarity ?? '—'}` })
        ]),
        el('div', { class: 'result-body', text: group.id === 'weapon'
          ? `${titleCase(item.skill)}, damage ${item.damage}, crit ${item.crit}, ${item.range} range${item.qualities.length ? `, ${item.qualities.join(', ')}` : ''}.`
          : group.id === 'armour'
            ? `Adds ${item.soak} to damage resisted and ${item.defense} to defence. ${item.note || ''}`
            : (item.effect || '') }),
        el('button', {
          type: 'button', class: 'secondary', text: affordable ? 'Add' : 'Too dear',
          disabled: !affordable, 'aria-label': `Add ${item.name}`,
          onclick: () => {
            draft.inventory.items.push({ id: item.id, name: item.name, kind: item.kind, price: item.price, encumbrance: item.encumbrance || 0, qty: 1, equipped: false });
            rerender();
          }
        }),
        owned ? el('button', {
          type: 'button', class: 'secondary', text: 'Remove', 'aria-label': `Remove ${item.name}`,
          onclick: () => {
            const at = draft.inventory.items.findIndex((i) => i.id === item.id);
            if (at >= 0) draft.inventory.items.splice(at, 1);
            rerender();
          }
        }) : null
      ]));
    });
    node.append(accordion(`${group.label}`, [body], {
      key: `wizard-gear-${group.id}`, summary: `${items.length} item${items.length === 1 ? '' : 's'}`,
      defaultOpen: group.id === 'weapon' || !!needle
    }));
  });
  if (!matched) node.append(emptyState('Nothing in the shop matches that.'));

  // What is already in the basket, so it can be undone without hunting the catalogue.
  const basket = draft.inventory.items || [];
  if (basket.length) {
    node.append(el('h3', { text: 'In the basket' }));
    node.append(el('p', { class: 'small', text: basket.map((i) => i.name).join(', ') }));
  }
}

function renderReviewStep(node) {
  const derived = derivedFor(draft);
  node.append(el('h3', { text: draft.identity.name || 'Unnamed' }));
  node.append(el('p', { class: 'small muted', text: `${careerById(draft.identity.career).name} · ${draft.xp.available} XP unspent` }));
  node.append(el('div', { class: 'stat-grid' }, CHARACTERISTICS.map((c) => stat(c.abbr, draft.attributes[c.id]))));
  node.append(el('div', { class: 'stat-grid' }, [
    stat('Wounds', `0 / ${derived.woundThreshold}`),
    stat('Strain', `0 / ${derived.strainThreshold}`),
    stat('Soak', derived.soak)
  ]));
  const trained = Object.entries(draft.skills).filter(([, s]) => s.rank > 0);
  node.append(el('p', { class: 'small', text: `Skills: ${trained.map(([id, s]) => `${titleCase(id)} ${s.rank}`).join(', ') || 'none'}` }));
  node.append(el('p', { class: 'small', text: `Talents: ${draft.talents.map((t) => `${talent(t.id).name}${t.ranks > 1 ? ` ×${t.ranks}` : ''}`).join(', ') || 'none'}` }));
  const m = draft.identity.motivation;
  node.append(el('p', { class: 'small', text: `Motivation: ${m.desire} / ${m.fear} / ${m.strength} / ${m.flaw}` }));
  const cash = startingCash();
  node.append(el('p', { class: 'small', text: `Starting cash: ${cash.total} ${Settings.currencyLabel()} — ${cash.unspent} unspent from the budget${cash.pocket ? `, plus ${cash.pocket} pocket money` : ', with no pocket money rolled yet'}.` }));
}
