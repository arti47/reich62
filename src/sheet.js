// sheet.js — the live character sheet and in-play tracking, plus the persistent
// resource header that rides on every in-play screen.

import { el, clear, titleCase, clamp } from './core.js';
import { showToast, confirmModal } from './ui.js';
import { SKILLS, CHARACTERISTICS, CONDITIONS, HEAT } from '../data.js';
import { talent, buildPool } from './rules.js';
import {
  derivedFor, woundThreshold, strainThreshold, soak, encumbranceState, criticalModifier
} from './derived.js';
import { activeCharacter, saveCharacter, getCell } from './store.js';
import { personalEffects, cellEffects } from './heat.js';

/** The persistent resource header: wounds · strain · Story Points · Personal Heat · encumbrance. */
export function renderResourceHeader() {
  const node = document.getElementById('resource-header');
  if (!node) return;
  const character = activeCharacter();
  if (!character) { node.hidden = true; clear(node); return; }
  const cell = getCell();
  const enc = encumbranceState(character);
  node.hidden = false;
  clear(node);
  const chip = (label, value, extra = '') =>
    el('span', { class: 'chip', title: extra }, [`${label} ${value}`]);
  node.append(
    chip('W', `${character.state.wounds}/${woundThreshold(character)}`),
    chip('S', `${character.state.strain}/${strainThreshold(character)}`),
    chip('SP', `${cell.pools.storyPointsPlayer}/${cell.pools.storyPointsGM}`, 'Player pool / GM pool (§8)'),
    chip('Heat', `${character.state.personalHeat}·${cell.cellHeat}`, 'Personal · Cell (§17.2)'),
    chip('Enc', `${enc.carried}/${enc.threshold}`)
  );
  if (character.state.incapacitated) node.append(el('span', { class: 'chip', text: 'INCAPACITATED' }));
}

export function renderSheet(mount) {
  clear(mount);
  const character = activeCharacter();
  const rerender = () => { renderSheet(mount); renderResourceHeader(); };

  if (!character) {
    mount.append(el('div', { class: 'card' }, [
      el('h2', { text: 'No active character' }),
      el('p', { class: 'muted', text: 'Create one first — the wizard walks the manual\'s creation order (§13).' }),
      el('a', { href: '#/create', class: 'small', text: 'Open the creation wizard' })
    ]));
    return;
  }

  const derived = derivedFor(character);

  // identity
  mount.append(el('div', { class: 'card' }, [
    el('h2', { text: character.identity.name || 'Unnamed' }),
    el('p', { class: 'small muted', text: `${titleCase(character.identity.career || '')} · ${character.xp.available} XP available` }),
    character.identity.erratum
      ? el('p', { class: 'small' }, [el('span', { class: 'badge badge-inferred', text: 'erratum' }), ' ', character.identity.erratum.note])
      : null
  ]));

  // vitals with steppers clamped to true maxima
  const vitals = el('div', { class: 'card' }, [el('h3', { text: 'Vitals' })]);
  vitals.append(stepper('Wounds', character.state.wounds, derived.woundThreshold, (v) => {
    character.state.wounds = clamp(v, 0, 99);
    character.state.incapacitated = character.state.wounds >= derived.woundThreshold || character.state.strain >= derived.strainThreshold;
    saveCharacter(character); rerender();
  }));
  vitals.append(stepper('Strain', character.state.strain, derived.strainThreshold, (v) => {
    character.state.strain = clamp(v, 0, 99);
    character.state.incapacitated = character.state.wounds >= derived.woundThreshold || character.state.strain >= derived.strainThreshold;
    saveCharacter(character); rerender();
  }));
  vitals.append(stepper('Personal Heat', character.state.personalHeat, HEAT.max, (v) => {
    character.state.personalHeat = clamp(v, HEAT.min, HEAT.max);
    saveCharacter(character); rerender();
  }));
  if (character.state.incapacitated) {
    vitals.append(el('p', { class: 'small', text: 'Incapacitated: wounds or strain have met the threshold (§6).' }));
  }
  mount.append(vitals);

  // derived stats
  mount.append(el('div', { class: 'card' }, [
    el('h3', { text: 'Derived' }),
    el('div', { class: 'stat-grid' }, [
      statBox('Wound Threshold', derived.woundThreshold),
      statBox('Strain Threshold', derived.strainThreshold),
      statBox('Soak', derived.soak),
      statBox('Melee Defence', derived.meleeDefense),
      statBox('Ranged Defence', derived.rangedDefense),
      statBox('Encumbrance', `${encumbranceState(character).carried} / ${derived.encumbranceThreshold}`)
    ])
  ]));

  // characteristics
  mount.append(el('div', { class: 'card' }, [
    el('h3', { text: 'Characteristics' }),
    el('div', { class: 'stat-grid' }, CHARACTERISTICS.map((c) => statBox(c.name, character.attributes[c.id])))
  ]));

  // skills with pool preview
  const skillTable = el('table');
  skillTable.append(el('tr', {}, [el('th', { text: 'Skill' }), el('th', { text: 'Rank' }), el('th', { text: 'Pool' })]));
  SKILLS.forEach((s) => {
    const rank = character.skills[s.id].rank;
    const pool = buildPool(rank, character.attributes[s.characteristic]);
    skillTable.append(el('tr', {}, [
      el('td', { text: `${s.name}${character.skills[s.id].career ? ' ●' : ''}` }),
      el('td', { text: String(rank) }),
      el('td', { class: 'dice-glyph', text: `${pool.ability}A ${pool.proficiency}P` })
    ]));
  });
  mount.append(el('div', { class: 'card' }, [
    el('h3', { text: 'Skills' }),
    el('p', { class: 'small muted', text: 'Pool preview: the higher of rank and characteristic sets Ability dice, the lower upgrades that many to Proficiency (§2).' }),
    el('div', { class: 'table-wrap' }, [skillTable])
  ]));

  // conditions — each auto-applies its effect in the roller
  const conditionCard = el('div', { class: 'card' }, [el('h3', { text: 'Conditions' })]);
  CONDITIONS.filter((c) => !c.id.startsWith('heat')).forEach((c) => {
    conditionCard.append(el('div', { class: 'toggle-row' }, [
      el('input', {
        type: 'checkbox', id: `cond-${c.id}`, checked: !!character.state.conditions[c.id],
        onchange: (e) => { character.state.conditions[c.id] = e.target.checked; saveCharacter(character); rerender(); }
      }),
      el('label', { for: `cond-${c.id}` }, [
        el('span', { text: c.name }),
        c.inferred ? el('span', { class: 'badge badge-inferred', text: `${c.ruling} inferred` }) : null,
        el('span', { class: 'toggle-desc', text: c.effect })
      ])
    ]));
  });
  mount.append(conditionCard);

  // Heat effects in force
  const cell = getCell();
  const heatCard = el('div', { class: 'card' }, [
    el('h3', { text: 'Heat' }),
    el('p', { class: 'small', text: `Personal ${character.state.personalHeat} / 5 · Cell ${cell.cellHeat} / 5 · safehouse ${cell.safehouseStatus}` })
  ]);
  const personal = personalEffects(character.state.personalHeat);
  const cellFx = cellEffects(cell.cellHeat);
  if (personal.length) heatCard.append(el('ul', { class: 'small' }, personal.map((t) => el('li', { text: t }))));
  if (cellFx.length) heatCard.append(el('ul', { class: 'small muted' }, cellFx.map((t) => el('li', { text: t }))));
  if (!personal.length && !cellFx.length) heatCard.append(el('p', { class: 'small muted', text: 'No threshold effects in force.' }));
  mount.append(heatCard);

  // Critical Injuries with the cumulative modifier
  const mod = criticalModifier(character);
  const critCard = el('div', { class: 'card' }, [
    el('h3', { text: 'Critical Injuries' }),
    el('p', { class: 'small muted', text: `${mod.untreated} untreated — future Critical Injury rolls take +${mod.plus} (§5G).` })
  ]);
  (character.state.criticalInjuries || []).forEach((injury, index) => {
    critCard.append(el('div', { class: 'result' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: `${injury.name} (${injury.severity})` }),
        el('span', { class: 'cite', text: `rolled ${injury.roll} → ${injury.total}` })
      ]),
      el('button', {
        type: 'button', class: 'secondary', text: injury.healed ? 'Mark untreated' : 'Mark healed',
        onclick: () => { character.state.criticalInjuries[index].healed = !injury.healed; saveCharacter(character); rerender(); }
      })
    ]));
  });
  if (!(character.state.criticalInjuries || []).length) critCard.append(el('p', { class: 'small muted', text: 'None.' }));
  mount.append(critCard);

  // talents
  const talentCard = el('div', { class: 'card' }, [el('h3', { text: 'Talents' })]);
  if (!character.talents.length) talentCard.append(el('p', { class: 'small muted', text: 'None bought.' }));
  character.talents.forEach((held) => {
    const def = talent(held.id);
    if (!def) return;
    talentCard.append(el('div', { class: 'result' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: `${def.name}${held.ranks > 1 ? ` ×${held.ranks}` : ''}` }),
        el('span', { class: 'cite', text: `T${def.tier} · ${def.activation}` })
      ]),
      el('div', { class: 'result-body', text: def.summary })
    ]));
  });
  mount.append(talentCard);

  // inventory
  const invCard = el('div', { class: 'card' }, [el('h3', { text: 'Inventory' })]);
  const enc = encumbranceState(character);
  invCard.append(el('p', { class: 'small', text: `Carrying ${enc.carried} against a threshold of ${enc.threshold}.` }));
  if (enc.over) {
    invCard.append(el('p', { class: 'small' }, [
      el('span', { class: 'badge', text: 'enforced' }), ' ',
      `${enc.setbackDice} Setback on ${enc.scope}${enc.losesFreeManeuver ? '; the free maneuver is lost, so each maneuver costs 2 strain' : ''} (§5F).`
    ]));
  }
  (character.inventory.items || []).forEach((item, index) => {
    invCard.append(el('div', { class: 'result' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: item.name || item.id }),
        el('span', { class: 'cite', text: `enc ${item.encumbrance || 0}` })
      ]),
      item.kind === 'armour' ? el('button', {
        type: 'button', class: 'secondary', text: item.equipped ? 'Unequip' : 'Equip',
        onclick: () => { character.inventory.items[index].equipped = !item.equipped; saveCharacter(character); rerender(); }
      }) : null
    ]));
  });
  if (!(character.inventory.items || []).length) invCard.append(el('p', { class: 'small muted', text: 'Empty.' }));
  mount.append(invCard);

  // notes
  mount.append(el('div', { class: 'card' }, [
    el('h3', { text: 'Notes' }),
    el('textarea', {
      rows: '4', 'aria-label': 'Notes', value: character.notes || '',
      onchange: (e) => { character.notes = e.target.value; saveCharacter(character); showToast('Notes saved'); }
    })
  ]));
}

function stepper(label, value, max, onChange) {
  return el('div', { class: 'toggle-row' }, [
    el('label', {}, [el('span', { text: `${label} ${value} / ${max}` })]),
    el('button', { type: 'button', class: 'secondary', text: '−', 'aria-label': `Lower ${label}`, onclick: () => onChange(value - 1) }),
    el('button', { type: 'button', class: 'secondary', text: '+', 'aria-label': `Raise ${label}`, onclick: () => onChange(value + 1) })
  ]);
}

function statBox(label, value) {
  return el('div', { class: 'stat' }, [
    el('span', { class: 'stat-label', text: label }),
    el('span', { class: 'stat-value', text: String(value) })
  ]);
}
