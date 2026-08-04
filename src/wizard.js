// wizard.js — character creation (§13) and pregen instantiation (§16).
// Order: career → four career skills → 70 XP → derived → Motivation → gear.
// No illegal character can be saved: every step validates before it will advance.

import { el, clear, titleCase } from './core.js';
import { showToast, modal } from './ui.js';
import {
  CAREERS, SKILLS, CHARACTERISTICS, MOTIVATIONS, CREATION_RULES, XP_COSTS, TALENT_RULES,
  CHARACTERISTIC_MIN, CHARACTERISTIC_MAX, SKILL_RANK_MAX_AT_CREATION, GEAR, WEAPONS, ARMOUR,
  BASE_WOUND_THRESHOLD, BASE_STRAIN_THRESHOLD
} from '../data.js';
import { PREGENS } from '../data-pregens.js';
import { canBuyTalent, visibleTalents, xpCost, talent, career as careerById } from './rules.js';
import { blankCharacter, derivedFor, normalise } from './derived.js';
import { saveCharacter, setActiveCharacter } from './store.js';
import { Settings } from './settings.js';
import { rollDie } from './core.js';

const STEPS = ['career', 'skills', 'xp', 'derived', 'motivation', 'gear', 'review'];

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
  if (name === 'career') {
    if (!draft.identity.career) return 'Choose a career first (§14).';
  }
  if (name === 'skills') {
    if (draft.identity.careerSkills.length !== CREATION_RULES.careerSkillPicks) {
      return `Pick exactly ${CREATION_RULES.careerSkillPicks} career skills (§14).`;
    }
  }
  if (name === 'xp') {
    if (draft.xp.available < 0) return 'You have spent more XP than you have.';
    const overRank = Object.entries(draft.skills).find(([, s]) => s.rank > SKILL_RANK_MAX_AT_CREATION);
    if (overRank) return `Skill ranks cannot pass ${SKILL_RANK_MAX_AT_CREATION} during creation (§7).`;
    const overChar = Object.entries(draft.attributes).find(([, v]) => v > CHARACTERISTIC_MAX);
    if (overChar) return `Characteristics cannot pass ${CHARACTERISTIC_MAX} (§7).`;
  }
  if (name === 'motivation') {
    const m = draft.identity.motivation;
    if (!m.desire || !m.fear || !m.strength || !m.flaw) return 'Choose one of each Motivation facet (§12B).';
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

export function raiseCharacteristic(id) {
  const current = draft.attributes[id];
  if (current >= CHARACTERISTIC_MAX) return `Maximum ${CHARACTERISTIC_MAX} at creation (§7).`;
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
  if (skill.rank >= SKILL_RANK_MAX_AT_CREATION) return `Capped at rank ${SKILL_RANK_MAX_AT_CREATION} during creation (§7).`;
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
  draft.identity.career = id;
  draft.identity.careerSkills = [];
  SKILLS.forEach((s) => { draft.skills[s.id] = { rank: 0, career: false }; });
  careerById(id).skills.forEach((s) => { draft.skills[s].career = true; });
  return null;
}

export function toggleCareerSkill(id) {
  const picks = draft.identity.careerSkills;
  const at = picks.indexOf(id);
  if (at >= 0) { picks.splice(at, 1); draft.skills[id].rank = Math.max(0, draft.skills[id].rank - 1); return null; }
  if (picks.length >= CREATION_RULES.careerSkillPicks) return `Only ${CREATION_RULES.careerSkillPicks} picks (§14).`;
  picks.push(id);
  draft.skills[id].rank += 1;
  return null;
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
  character.state.wounds = 0;
  character.state.strain = 0;
  const saved = saveCharacter(character);
  setActiveCharacter(saved.id);
  return { ok: true, character: saved };
}

export function currentDraft() { return draft; }
export function currentStep() { return STEPS[step]; }

// --- rendering ---
export function renderWizard(mount) {
  clear(mount);
  rerender = () => renderWizard(mount);
  if (!draft) startWizard();

  mount.append(el('div', { class: 'card' }, [
    el('h2', { text: `Create a character — ${titleCase(STEPS[step])}` }),
    el('p', { class: 'small muted', text: `Step ${step + 1} of ${STEPS.length} · ${draft.xp.available} of ${draft.xp.total} XP left` })
  ]));

  const body = el('div', { class: 'card' });
  ({
    career: renderCareerStep, skills: renderSkillsStep, xp: renderXpStep, derived: renderDerivedStep,
    motivation: renderMotivationStep, gear: renderGearStep, review: renderReviewStep
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

function renderCareerStep(node) {
  node.append(el('label', { class: 'small', for: 'char-name', text: 'Name' }));
  node.append(el('input', {
    type: 'text', id: 'char-name', value: draft.identity.name,
    oninput: (e) => { draft.identity.name = e.target.value; }
  }));
  node.append(el('h3', { text: 'Career (§14)' }));
  CAREERS.forEach((c) => {
    node.append(el('div', { class: 'toggle-row' }, [
      el('input', {
        type: 'radio', name: 'career', id: `career-${c.id}`, checked: draft.identity.career === c.id,
        onchange: () => { pickCareer(c.id); rerender(); }
      }),
      el('label', { for: `career-${c.id}` }, [
        el('span', { text: c.name }),
        el('span', { class: 'toggle-desc', text: `${c.summary} Skills: ${c.skills.map((s) => titleCase(s)).join(', ')}.` })
      ])
    ]));
  });

  node.append(el('h3', { text: 'Or start from a pregen (§16)' }));
  PREGENS.forEach((p) => {
    node.append(el('button', {
      type: 'button', class: 'secondary', text: `${p.name}`,
      onclick: () => { startWizard({ pregenId: p.id }); showToast(`${p.name} loaded — 70 XP still to spend`); rerender(); }
    }));
    node.append(document.createTextNode(' '));
  });
  node.append(el('p', { class: 'small muted', text: 'Pregens are printed with 70 XP unspent and no talents or Motivation, so they open here rather than as a finished sheet.' }));
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
  node.append(el('h3', { text: 'Characteristics (10 × new rating, creation only)' }));
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

  node.append(el('h3', { text: `Skills (career 5 × rank, non-career 5 × rank + 5; capped at ${SKILL_RANK_MAX_AT_CREATION} here)` }));
  const table = el('table');
  table.append(el('tr', {}, [el('th', { text: 'Skill' }), el('th', { text: 'Rank' }), el('th', { text: 'Cost' }), el('th', { text: '' })]));
  SKILLS.forEach((s) => {
    const skill = draft.skills[s.id];
    const next = xpCost('skill', { newRank: skill.rank + 1, career: skill.career });
    table.append(el('tr', {}, [
      el('td', { text: `${s.name}${skill.career ? ' ●' : ''}` }),
      el('td', { text: String(skill.rank) }),
      el('td', { text: skill.rank >= SKILL_RANK_MAX_AT_CREATION ? '—' : String(next) }),
      el('td', {}, [
        el('button', { type: 'button', class: 'secondary', text: '−', 'aria-label': `Lower ${s.name}`, onclick: () => { lowerSkill(s.id); rerender(); } }),
        el('button', { type: 'button', class: 'secondary', text: '+', 'aria-label': `Raise ${s.name}`, onclick: () => { const p = raiseSkill(s.id); if (p) showToast(p); rerender(); } })
      ])
    ]));
  });
  node.append(el('div', { class: 'table-wrap' }, [table]));

  node.append(el('h3', { text: 'Talents (5 × tier; the pyramid is enforced)' }));
  const held = heldTalents();
  const list = el('div');
  visibleTalents(Settings.showNonSettingTalents()).forEach((t) => {
    const legality = canBuyTalent(t.id, held);
    const ranks = held[t.id] || 0;
    list.append(el('div', { class: 'result' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: `${t.name}${ranks ? ` ×${ranks}` : ''}` }),
        el('span', { class: 'cite', text: `T${t.tier} · ${TALENT_RULES.costPerTier[t.tier - 1]} XP` })
      ]),
      el('div', { class: 'result-body', text: t.summary }),
      el('button', {
        type: 'button', class: 'secondary', text: legality.ok ? 'Buy' : 'Locked', disabled: !legality.ok,
        title: legality.ok ? '' : legality.reason,
        onclick: () => { const p = buyTalent(t.id); if (p) showToast(p); rerender(); }
      }),
      ranks ? el('button', { type: 'button', class: 'secondary', text: 'Refund', onclick: () => { sellTalent(t.id); rerender(); } }) : null
    ]));
  });
  node.append(list);
}

function renderDerivedStep(node) {
  const derived = derivedFor(draft);
  node.append(el('p', { class: 'small' }, [
    el('span', { class: 'badge badge-inferred', text: 'R-1 inferred' }), ' ',
    `The manual never prints the human base thresholds (§6). This app uses Wound ${BASE_WOUND_THRESHOLD} + Brawn and Strain ${BASE_STRAIN_THRESHOLD} + Willpower, taken from the pregens that agree.`
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
  node.append(el('p', { class: 'small muted', text: 'One of each facet, rolled on a d10 or chosen (§12B). Motivations are social-encounter targets and earn bonus XP when played to.' }));
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
    `The manual names neither a currency nor a budget (R-8). Spending ${gearSpent()} of ${budget} ${Settings.currencyLabel()}.`
  ]));
  const catalogue = [
    ...WEAPONS.filter((w) => w.price).map((w) => ({ ...w, kind: 'weapon' })),
    ...ARMOUR.filter((a) => a.price).map((a) => ({ ...a, kind: 'armour' })),
    ...GEAR.filter((g) => g.price).map((g) => ({ ...g, kind: 'gear' }))
  ];
  catalogue.forEach((item) => {
    const owned = (draft.inventory.items || []).filter((i) => i.id === item.id).length;
    node.append(el('div', { class: 'result' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: `${item.name}${owned ? ` ×${owned}` : ''}` }),
        el('span', { class: 'cite', text: `${item.price} · rarity ${item.rarity ?? '—'}` })
      ]),
      el('button', {
        type: 'button', class: 'secondary', text: 'Add',
        onclick: () => {
          draft.inventory.items.push({ id: item.id, name: item.name, kind: item.kind, price: item.price, encumbrance: item.encumbrance || 0, qty: 1, equipped: false });
          rerender();
        }
      }),
      owned ? el('button', {
        type: 'button', class: 'secondary', text: 'Remove',
        onclick: () => {
          const at = draft.inventory.items.findIndex((i) => i.id === item.id);
          if (at >= 0) draft.inventory.items.splice(at, 1);
          rerender();
        }
      }) : null
    ]));
  });
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
}
