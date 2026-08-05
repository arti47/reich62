// sheet.js — the live character sheet and in-play tracking, plus the persistent
// resource header that rides on every in-play screen.

import { el, clear, titleCase, clamp } from './core.js';
import { showToast, confirmModal, panel, subTabs, emptyState, outcomeBox, numberStepper } from './ui.js';
import { PANELS, label as termLabel, gloss } from './help.js';
import {
  SKILLS, CHARACTERISTICS, CONDITIONS, HEAT, CRITICAL_INJURIES, SUFFOCATION, RECOVERY,
  XP_COSTS, SKILL_RANK_MAX
} from '../data.js';
import { talent, buildPool, canBuyTalent, visibleTalents, xpCost, skill as skillById } from './rules.js';
import { ITEM_DAMAGE, ATTACHMENTS, DIFFICULTIES } from '../data.js';
import { hardPoints } from './derived.js';
import { Settings } from './settings.js';
import { rollCriticalInjury, state as rollerState } from './roller.js';
import {
  derivedFor, woundThreshold, strainThreshold, soak, encumbranceState, criticalModifier
} from './derived.js';
import { activeCharacter, saveCharacter, getCell, saveCell as saveCellDirect } from './store.js';
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
  const chip = (short, value, extra = '') =>
    el('span', { class: 'chip', title: extra }, [`${short} ${value}`]);
  node.append(
    chip('Injury', `${character.state.wounds}/${woundThreshold(character)}`, `${termLabel('wounds')} — ${gloss('wounds')}`),
    chip('Stress', `${character.state.strain}/${strainThreshold(character)}`, `${termLabel('strain')} — ${gloss('strain')}`),
    chip('Story', `${cell.pools.storyPointsPlayer}/${cell.pools.storyPointsGM}`, `${termLabel('storyPoints')}: players / GM. ${gloss('storyPoints')}`),
    chip('Heat', `${character.state.personalHeat}·${cell.cellHeat}`, `${termLabel('personalHeat')} · ${termLabel('cellHeat')}. ${gloss('personalHeat')}`),
    chip('Load', `${enc.carried}/${enc.threshold}`, `${termLabel('encumbrance')} — ${gloss('encumbrance')}`)
  );
  if (character.state.incapacitated) node.append(el('span', { class: 'chip', text: 'INCAPACITATED' }));
}

export const SHEET_TABS = [
  { id: 'vitals',  label: 'Vitals' },
  { id: 'skills',  label: 'Skills' },
  { id: 'gear',    label: 'Gear' },
  { id: 'talents', label: 'Talents & injuries' },
  { id: 'care',    label: 'Recovery' },
  { id: 'advance', label: 'Advance' }
];
let sheetTab = 'vitals';

export function renderSheet(mount) {
  clear(mount);
  const character = activeCharacter();
  const rerender = () => { renderSheet(mount); renderResourceHeader(); };

  if (!character) {
    mount.append(panel('No character yet', {
      lede: 'This screen shows whichever character is active, and there is not one yet.',
      detail: 'Creating one takes about five minutes, and the app checks every rule as you go so an illegal character cannot be saved. You can also start from one of the three ready-made characters the book prints.'
    }, [emptyState('Nothing to show until a character exists.', { href: '#/create', label: 'Create a character' })]));
    return;
  }

  const derived = derivedFor(character);

  mount.append(el('div', { class: 'card' }, [
    el('h2', { text: character.identity.name || 'Unnamed' }),
    el('p', { class: 'small muted', text: `${titleCase(character.identity.career || '')} · ${character.xp.available} experience unspent` }),
    character.identity.erratum
      ? el('p', { class: 'small' }, [el('span', { class: 'badge badge-inferred', text: 'corrected' }), ' ', character.identity.erratum.note])
      : null,
    subTabs(SHEET_TABS, sheetTab, (id) => { sheetTab = id; rerender(); })
  ]));

  PANES[sheetTab](mount, character, derived, rerender);
}

function pane_vitals(mount, character, derived, rerender) {
  // vitals with direct entry plus coarse and fine steps
  const vitals = panel(`${termLabel('wounds')}, ${termLabel('strain')} and ${termLabel('personalHeat')}`, PANELS.sheetVitals, []);
  vitals.append(stepper(`${termLabel('wounds')} — ${gloss('wounds')}`, character.state.wounds, derived.woundThreshold, (v) => {
    character.state.wounds = clamp(v, 0, 99);
    character.state.incapacitated = character.state.wounds >= derived.woundThreshold || character.state.strain >= derived.strainThreshold;
    saveCharacter(character); rerender();
  }, 'Injury'));
  vitals.append(stepper(`${termLabel('strain')} — ${gloss('strain')}`, character.state.strain, derived.strainThreshold, (v) => {
    character.state.strain = clamp(v, 0, 99);
    character.state.incapacitated = character.state.wounds >= derived.woundThreshold || character.state.strain >= derived.strainThreshold;
    saveCharacter(character); rerender();
  }, 'Stress'));
  vitals.append(stepper(`${termLabel('personalHeat')} — ${gloss('personalHeat')}`, character.state.personalHeat, HEAT.max, (v) => {
    character.state.personalHeat = clamp(v, HEAT.min, HEAT.max);
    saveCharacter(character); rerender();
  }, 'Suspicion'));
  if (character.state.incapacitated) {
    vitals.append(outcomeBox(['Out of the fight: injury or stress has reached the limit. Heal below it to act again.'], { tone: 'warn', title: 'Down' }));
  }
  mount.append(vitals);


  // derived stats
  mount.append(el('div', { class: 'card' }, [
    el('h3', { text: 'Worked-out numbers' }),
    el('p', { class: 'lede', text: 'These come from your characteristics, gear and talents. They update themselves.' }),
    el('div', { class: 'stat-grid' }, [
      statBox('Injury limit', derived.woundThreshold),
      statBox('Stress limit', derived.strainThreshold),
      statBox(termLabel('soak'), derived.soak),
      statBox('Close defence', derived.meleeDefense),
      statBox('Ranged defence', derived.rangedDefense),
      statBox('Carrying', `${encumbranceState(character).carried} / ${derived.encumbranceThreshold}`)
    ])
  ]));


  // characteristics
  mount.append(el('div', { class: 'card' }, [
    el('h3', { text: 'Characteristics' }),
    el('div', { class: 'stat-grid' }, CHARACTERISTICS.map((c) => statBox(c.name, character.attributes[c.id])))
  ]));


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

}

function pane_skills(mount, character, derived, rerender) {
  // skills with pool preview
  const skillTable = el('table');
  skillTable.append(el('tr', {}, [el('th', { text: 'Skill' }), el('th', { text: 'Rank' }), el('th', { text: 'Pool' })]));
  SKILLS.forEach((s) => {
    const rank = character.skills[s.id].rank;
    const pool = buildPool(rank, character.attributes[s.characteristic]);
    skillTable.append(el('tr', {}, [
      // Tapping a skill selects it on the Roll screen and goes there, so the sheet is the
      // way into a check rather than a place to read the skill's name and retype it.
      el('td', {}, [el('button', {
        type: 'button', class: 'skill-link',
        'aria-label': `Roll ${s.name}`,
        text: `${s.name}${character.skills[s.id].career ? ' ●' : ''}`,
        onclick: () => { rollerState.skillId = s.id; location.hash = '#/roll'; }
      })]),
      el('td', { text: String(rank) }),
      el('td', { class: 'dice-glyph', text: `${pool.ability}A ${pool.proficiency}P` })
    ]));
  });
  mount.append(panel('Skills', PANELS.sheetSkills, [el('div', { class: 'table-wrap' }, [skillTable])]));


  // conditions — each auto-applies its effect in the roller
  const conditionCard = panel('States you are in', PANELS.sheetConditions, []);
  CONDITIONS.filter((c) => !c.id.startsWith('heat')).forEach((c) => {
    conditionCard.append(el('div', { class: 'toggle-row' }, [
      el('input', {
        type: 'checkbox', id: `cond-${c.id}`, checked: !!character.state.conditions[c.id],
        onchange: (e) => { character.state.conditions[c.id] = e.target.checked; saveCharacter(character); rerender(); }
      }),
      el('label', { for: `cond-${c.id}` }, [
        el('span', { text: c.name }),
        c.inferred ? el('span', { class: 'badge badge-inferred', text: 'inferred' }) : null,
        el('span', { class: 'toggle-desc', text: c.effect })
      ])
    ]));
  });
  mount.append(conditionCard);

}

function pane_gear(mount, character, derived, rerender) {
  // inventory
  const invCard = panel('What you are carrying', PANELS.sheetGear, []);
  const enc = encumbranceState(character);
  invCard.append(el('p', { class: 'small', text: `Carrying ${enc.carried} against a threshold of ${enc.threshold}.` }));
  if (enc.over) {
    invCard.append(el('p', { class: 'small' }, [
      el('span', { class: 'badge', text: 'enforced' }), ' ',
      `${enc.setbackDice} Setback on ${enc.scope}${enc.losesFreeManeuver ? '; the free maneuver is lost, so each maneuver costs 2 strain' : ''}.`
    ]));
  }
  (character.inventory.items || []).forEach((item, index) => {
    const level = ITEM_DAMAGE.levels.find((l) => l.id === (item.damageLevel || 'undamaged'));
    const points = hardPoints(item.encumbrance || 0);
    const used = (item.attachments || []).reduce((sum, a) => sum + a.hardPoints, 0);
    const card = el('div', { class: 'result' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: item.name || item.id }),
        el('span', { class: 'cite', text: `enc ${item.encumbrance || 0} · ${points} hard point${points === 1 ? '' : 's'}` })
      ]),
      el('div', { class: 'result-body', text: `${level.name}${level.penalty !== 'None' ? ` — ${level.penalty}` : ''}${used ? ` · ${used} of ${points} hard points used` : ''}` })
    ]);
    if (item.kind === 'armour') {
      card.append(el('button', {
        type: 'button', class: 'secondary', text: item.equipped ? 'Unequip' : 'Equip',
        onclick: () => { character.inventory.items[index].equipped = !item.equipped; saveCharacter(character); rerender(); }
      }));
    }
    // Item damage ladder (§10 Sunder, §14B): one step each way, with the repair cost shown.
    card.append(el('button', {
      type: 'button', class: 'secondary', text: 'Damage a step',
      onclick: () => {
        const order = ITEM_DAMAGE.levels.map((l) => l.id);
        const at = order.indexOf(item.damageLevel || 'undamaged');
        character.inventory.items[index].damageLevel = order[Math.min(order.length - 1, at + 1)];
        saveCharacter(character); rerender();
      }
    }));
    if (level.repairDifficulty) {
      const price = Number(item.price) || 0;
      card.append(el('button', {
        type: 'button', class: 'secondary',
        text: `Repair (${level.repairDifficulty} Mechanics${price ? `, ${Math.round(level.repairCostFraction * price)} ${Settings.currencyLabel()}` : ''})`,
        onclick: () => {
          const order = ITEM_DAMAGE.levels.map((l) => l.id);
          const at = order.indexOf(item.damageLevel);
          character.inventory.items[index].damageLevel = order[Math.max(0, at - 1)];
          saveCharacter(character);
          showToast(`Repaired one step — ${ITEM_DAMAGE.repair.time} at ${level.repairDifficulty}`);
          rerender();
        }
      }));
    }
    // Attachments and hard points (§14C).
    if (points > 0) {
      const select = el('select', { 'aria-label': `Attachment for ${item.name || item.id}` });
      ATTACHMENTS.examples.forEach((a) => select.append(el('option', { value: a.id, text: `${a.name} (${a.hardPoints} hp)` })));
      card.append(select, el('button', {
        type: 'button', class: 'secondary', text: 'Install',
        onclick: () => {
          const attachment = ATTACHMENTS.examples.find((a) => a.id === select.value);
          if (used + attachment.hardPoints > points) { showToast(`Only ${points - used} hard point(s) free.`); return; }
          character.inventory.items[index].attachments = [...(item.attachments || []), { ...attachment }];
          saveCharacter(character);
          showToast(`${attachment.name} installed — about an hour plus an Average Mechanics check`);
          rerender();
        }
      }));
      (item.attachments || []).forEach((a, ai) => {
        card.append(el('p', { class: 'small muted', text: `${a.name}: ${a.effect}` }));
        card.append(el('button', {
          type: 'button', class: 'secondary', text: `Remove ${a.name}`,
          onclick: () => {
            character.inventory.items[index].attachments.splice(ai, 1);
            saveCharacter(character); rerender();
          }
        }));
      });
    }
    invCard.append(card);
  });
  if (!(character.inventory.items || []).length) invCard.append(emptyState('Carrying nothing.', { href: '#/rules?q=Gear', label: 'Browse the gear list' }));
  mount.append(invCard);

}

function pane_talents(mount, character, derived, rerender) {
  // talents
  const talentCard = panel('Talents', PANELS.sheetTalents, []);
  if (!character.talents.length) talentCard.append(emptyState('No talents yet.', { href: '#/sheet', label: 'Buy one on the Advance tab' }));
  character.talents.forEach((held) => {
    const def = talent(held.id);
    if (!def) return;
    talentCard.append(el('div', { class: 'result' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: `${def.name}${held.ranks > 1 ? ` ×${held.ranks}` : ''}` }),
        el('span', { class: 'cite', text: `T${def.tier} · ${def.activation}` })
      ]),
      el('div', { class: 'result-body', text: def.summary }),
      def.activation === 'passive' ? null : el('button', {
        type: 'button', class: 'secondary', text: 'Use',
        onclick: () => {
          const result = useTalent(character, held.id);
          if (!result.ok) { showToast(result.reason); return; }
          const cost = [result.strainCost ? `${result.strainCost} strain` : null, result.storyPointCost ? `${result.storyPointCost} Story Point` : null].filter(Boolean).join(', ');
          showToast(`${def.name}${cost ? ` — ${cost}` : ''}: ${result.effects[0]}`);
          rerender();
        }
      })
    ]));
  });
  mount.append(talentCard);


  // Critical Injuries with the cumulative modifier
  const mod = criticalModifier(character);
  const critCard = panel(termLabel('criticalInjury'), PANELS.sheetCriticals, [
    el('p', { class: 'small muted', text: `${mod.untreated} untreated, so the next roll on the injury table takes +${mod.plus}.` })
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
  if (!(character.state.criticalInjuries || []).length) critCard.append(el('p', { class: 'small muted', text: 'None — nothing lasting yet.' }));
  mount.append(critCard);


  // --- guided death procedure (§3.10) ---
  const deathCard = panel('Dying', PANELS.sheetDeath, []);
  const deathState = character.state.deathState;
  if (deathState && DEATH_STATES[deathState.kind]) {
    const def = DEATH_STATES[deathState.kind];
    deathCard.append(el('p', { class: 'small' }, [
      el('span', { class: 'badge badge-inferred', text: def.name }), ' ', def.perTurn
    ]));
    if (deathState.kind === 'endIsNigh') {
      deathCard.append(el('p', { class: 'small', text: `Rounds remaining: ${deathState.roundsRemaining ?? 1}.` }));
    }
    if (deathState.kind !== 'dead') {
      deathCard.append(el('button', {
        type: 'button', class: 'secondary', text: 'Tick one turn',
        onclick: () => { const r = tickDeathState(character); r.events.forEach((e) => showToast(e)); rerender(); }
      }));
      deathCard.append(el('button', {
        type: 'button', class: 'secondary', text: 'Healed — clear',
        onclick: () => { clearDeathState(character); showToast('Death state cleared'); rerender(); }
      }));
    }
  } else {
    deathCard.append(el('p', { class: 'small muted', text: 'No death state running. Bleeding Out, The End Is Nigh and suffocation start themselves from the Critical Injury table and the suffocation rules.' }));
    ['bleedingOut', 'endIsNigh', 'suffocating'].forEach((kind) => {
      deathCard.append(el('button', {
        type: 'button', class: 'secondary', text: `Start ${DEATH_STATES[kind].name}`,
        onclick: () => {
          character.state.deathState = { kind, roundsRemaining: kind === 'endIsNigh' ? 1 : null };
          saveCharacter(character); rerender();
        }
      }));
    });
  }
  if (character.talents.some((t) => t.id === 'indomitable')) {
    deathCard.append(el('button', {
      type: 'button', class: 'primary', text: 'Indomitable (1 Story Point)',
      onclick: () => { const r = useIndomitable(character); showToast(r.ok ? r.note : r.reason); rerender(); }
    }));
  }
  mount.append(deathCard);

}

function pane_care(mount, character, derived, rerender) {
  // --- rest and recovery, with the once-per-X limits enforced (§5G) ---
  const recoveryCard = panel('Healing', PANELS.sheetRecovery, []);
  const successInput = el('input', { type: 'number', id: 'recovery-successes', min: '0', value: '0', 'aria-label': 'Uncancelled Success' });
  const advantageInput = el('input', { type: 'number', id: 'recovery-advantages', min: '0', value: '0', 'aria-label': 'Uncancelled Advantage' });
  recoveryCard.append(el('label', { class: 'small', for: 'recovery-successes', text: 'Uncancelled Success' }), successInput);
  recoveryCard.append(el('label', { class: 'small', for: 'recovery-advantages', text: 'Uncancelled Advantage' }), advantageInput);
  RECOVERY.methods.filter((m) => m.id !== 'vehicleSystemStrain').forEach((method) => {
    const gate = recoveryAvailable(character, method.id);
    recoveryCard.append(el('div', { class: 'result' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: method.name }),
        el('span', { class: 'cite', text: method.limit })
      ]),
      el('div', { class: 'result-body', text: method.restores }),
      el('button', {
        type: 'button', class: 'secondary', text: gate.ok ? 'Apply' : 'Used', disabled: !gate.ok,
        id: `recovery-${method.id}`,
        onclick: () => {
          const result = applyRecovery(character, method.id, {
            successes: Number(successInput.value), advantages: Number(advantageInput.value)
          });
          if (!result.ok) { showToast(result.reason); return; }
          result.events.forEach((e) => showToast(e));
          rerender();
        }
      })
    ]));
  });
  mount.append(recoveryCard);

}

function pane_advance(mount, character, derived, rerender) {
  // --- advancement (§3.15) ---
  const advCard = panel('Spend experience', PANELS.sheetAdvance, [
    el('p', { class: 'small', text: `${character.xp.available} XP available of ${character.xp.total} earned.` })
  ]);
  const advSkill = el('select', { id: 'advance-skill', 'aria-label': 'Skill to raise' });
  SKILLS.forEach((s) => {
    const entry = character.skills[s.id];
    advSkill.append(el('option', { value: s.id, text: `${s.name} ${entry.rank} → ${entry.rank + 1} (${xpCost('skill', { newRank: entry.rank + 1, career: entry.career })} XP)` }));
  });
  advCard.append(advSkill, el('button', {
    type: 'button', class: 'secondary', text: 'Buy rank',
    onclick: () => { const r = advanceSkill(character, advSkill.value); showToast(r.ok ? `Bought for ${r.cost} XP` : r.reason); rerender(); }
  }));

  const advTalent = el('select', { id: 'advance-talent', 'aria-label': 'Talent to buy' });
  const heldMap = {};
  character.talents.forEach((t) => { heldMap[t.id] = t.ranks; });
  visibleTalents(Settings.showNonSettingTalents()).forEach((t) => {
    const legality = canBuyTalent(t.id, heldMap);
    advTalent.append(el('option', { value: t.id, text: `${t.name} (T${t.tier})${legality.ok ? '' : ' — locked'}`, disabled: !legality.ok }));
  });
  advCard.append(advTalent, el('button', {
    type: 'button', class: 'secondary', text: 'Buy talent',
    onclick: () => {
      const r = advanceTalent(character, advTalent.value);
      if (!r.ok) { showToast(r.reason); return; }
      showToast(`Bought for ${r.cost} XP`);
      if (r.dedication) showToast('Dedication: pick the characteristic it raises below.');
      rerender();
    }
  }));
  if (character.talents.some((t) => t.id === 'dedication')) {
    const dedSelect = el('select', { id: 'dedication-target', 'aria-label': 'Characteristic Dedication raises' });
    CHARACTERISTICS.forEach((c) => dedSelect.append(el('option', { value: c.id, text: c.name })));
    advCard.append(dedSelect, el('button', {
      type: 'button', class: 'secondary', text: 'Apply Dedication',
      onclick: () => { const r = applyDedication(character, dedSelect.value); showToast(r.ok ? 'Characteristic raised' : r.reason); rerender(); }
    }));
  }
  if (character.advancementLog.length) {
    advCard.append(el('h3', { text: 'Log' }));
    character.advancementLog.slice(-8).reverse().forEach((entry) => {
      advCard.append(el('p', { class: 'small muted', text: `${new Date(entry.ts).toLocaleDateString()} · ${entry.detail} · ${entry.xpSpent > 0 ? `${entry.xpSpent} XP` : `+${-entry.xpSpent} XP`}` }));
    });
  }
  mount.append(advCard);


  // notes
  mount.append(el('div', { class: 'card' }, [
    el('h3', { text: 'Notes' }),
    el('textarea', {
      rows: '4', 'aria-label': 'Notes', value: character.notes || '',
      onchange: (e) => { character.notes = e.target.value; saveCharacter(character); showToast('Notes saved'); }
    })
  ]));
}

const PANES = { vitals: pane_vitals, skills: pane_skills, gear: pane_gear, talents: pane_talents, care: pane_care, advance: pane_advance };

function stepper(labelText, value, max, onChange, ariaName) {
  return numberStepper({
    id: `vital-${ariaName.toLowerCase()}`,
    label: labelText, ariaName, value, min: 0, max, steps: [1, 5],
    suffix: `(limit ${max})`, onChange
  });
}

function statBox(label, value) {
  return el('div', { class: 'stat' }, [
    el('span', { class: 'stat-label', text: label }),
    el('span', { class: 'stat-value', text: String(value) })
  ]);
}

// ---------------------------------------------------------------------------
// Guided death procedure (§3.10) — the highest-stakes moment in play, so every state
// is explicit and the escape hatch is one tap away.
// ---------------------------------------------------------------------------

export const DEATH_STATES = {
  bleedingOut: {
    name: 'Bleeding Out',
    cite: '§9',
    perTurn: 'Suffer 1 wound and 1 strain at the start of each turn until healed.',
    extraRoll: 'Reaching 5 wounds past the threshold triggers another Critical Injury roll.'
  },
  endIsNigh: {
    name: 'The End Is Nigh',
    cite: '§9',
    perTurn: 'Dies at the end of the next round unless healed first.',
    countdown: true
  },
  dead: { name: 'Dead', cite: '§9', perTurn: 'Dead. Cannot be revived.' },
  suffocating: {
    name: 'Suffocating',
    cite: '§5I',
    perTurn: `${SUFFOCATION.strainPerRound} strain at the start of each turn. ${SUFFOCATION.escalation}`
  }
};

/** Tick one turn of whatever death state is running. Returns everything that happened. */
export function tickDeathState(character) {
  const state = character.state.deathState;
  if (!state) return { events: [] };
  const events = [];
  const wt = woundThreshold(character);
  const st = strainThreshold(character);

  if (state.kind === 'bleedingOut') {
    character.state.wounds += 1;
    character.state.strain += 1;
    events.push('Bleeding Out: 1 wound and 1 strain.');
    if (character.state.wounds >= wt + 5) {
      const roll = rollCriticalInjury(character, {});
      events.push(`Five wounds past the threshold: another Critical Injury — ${roll.injury.name}.`);
    }
  }

  if (state.kind === 'endIsNigh') {
    if (state.roundsRemaining > 0) {
      state.roundsRemaining -= 1;
      events.push(`The End Is Nigh: ${state.roundsRemaining} round(s) left before death unless healed.`);
    } else {
      character.state.deathState = { kind: 'dead' };
      events.push('The End Is Nigh ran out — the character dies.');
    }
  }

  if (state.kind === 'suffocating') {
    character.state.strain += SUFFOCATION.strainPerRound;
    events.push(`Suffocating: ${SUFFOCATION.strainPerRound} strain.`);
    if (character.state.strain > st) {
      const roll = rollCriticalInjury(character, {});
      events.push(`Past the strain threshold while suffocating: another Critical Injury — ${roll.injury.name}.`);
    }
  }

  character.state.incapacitated = character.state.wounds >= wt || character.state.strain >= st;
  saveCharacter(character);
  return { events };
}

/** Indomitable (T5): once per encounter, spend a Story Point to delay incapacitation
 *  until the end of the next turn; drop below the threshold in time and it is cancelled. */
export function useIndomitable(character) {
  const held = character.talents.find((t) => t.id === 'indomitable');
  if (!held) return { ok: false, reason: 'Indomitable is not on this sheet.' };
  if (character.state.perEncounterFlags.indomitable) return { ok: false, reason: 'Indomitable is once per encounter.' };
  const cell = getCellPools();
  if (cell.pools.storyPointsPlayer < 1) return { ok: false, reason: 'No Story Point in the player pool.' };
  cell.pools.storyPointsPlayer -= 1;
  cell.pools.storyPointsGM += 1;
  saveCellPools(cell);
  character.state.perEncounterFlags.indomitable = true;
  character.state.incapacitationDelayedUntil = 'endOfNextTurn';
  character.state.incapacitated = false;
  saveCharacter(character);
  return { ok: true, note: 'Incapacitation delayed until the end of the next turn; drop back below the threshold in time and it is cancelled entirely.' };
}

export function clearDeathState(character) {
  character.state.deathState = null;
  character.state.incapacitationDelayedUntil = null;
  saveCharacter(character);
}

// ---------------------------------------------------------------------------
// Rest and recovery (§5G) — the once-per-X limits are rules, so they are enforced.
// ---------------------------------------------------------------------------

const LIMIT_BUCKET = {
  perEncounter: 'perEncounterFlags',
  perEncounterPerTarget: 'perEncounterFlags',
  perDay: 'perDayFlags',
  perWeek: 'perWeekFlags',
  perWeekPerInjury: 'perWeekFlags'
};

export function recoveryAvailable(character, methodId) {
  const method = RECOVERY.methods.find((m) => m.id === methodId);
  if (!method) return { ok: false, reason: 'Unknown recovery method.' };
  const bucket = LIMIT_BUCKET[method.limitKey];
  if (!bucket) return { ok: true, method };
  if (character.state[bucket] && character.state[bucket][methodId]) {
    return { ok: false, reason: `Already used: ${method.limit}.`, method };
  }
  return { ok: true, method };
}

export function applyRecovery(character, methodId, { successes = 0, advantages = 0, triumph = 0 } = {}) {
  const gate = recoveryAvailable(character, methodId);
  if (!gate.ok) return gate;
  const method = gate.method;
  const events = [];
  const talentRank = (id) => { const t = character.talents.find((x) => x.id === id); return t ? t.ranks : 0; };

  if (methodId === 'endOfEncounter') {
    let strain = successes;
    if (talentRank('desperateRecovery') && character.state.strain > strainThreshold(character) / 2) {
      strain += 2;
      events.push('Desperate Recovery: 2 extra strain healed.');
    }
    character.state.strain = Math.max(0, character.state.strain - strain);
    events.push(`Healed ${strain} strain.`);
  }
  if (methodId === 'nightRest') {
    character.state.wounds = Math.max(0, character.state.wounds - 1);
    character.state.strain = 0;
    events.push('Healed 1 wound and all strain.');
  }
  if (methodId === 'medicineWounds') {
    const wounds = successes + talentRank('surgeon');
    character.state.wounds = Math.max(0, character.state.wounds - wounds);
    character.state.strain = Math.max(0, character.state.strain - advantages);
    events.push(`Healed ${wounds} wounds and ${advantages} strain${talentRank('surgeon') ? ', including Surgeon' : ''}.`);
  }
  if (methodId === 'painkillers') {
    const used = character.state.perDayFlags.painkillers || 0;
    const base = RECOVERY.methods.find((m) => m.id === 'painkillers').ladder[Math.min(used, 5)];
    const bonus = base > 0 ? talentRank('painkillerSpecialization') : 0; // the sixth and later still do nothing
    character.state.wounds = Math.max(0, character.state.wounds - (base + bonus));
    character.state.perDayFlags.painkillers = used + 1;
    events.push(`Painkiller ${used + 1} of the day: healed ${base + bonus} wounds.`);
  }
  if (methodId === 'weekRest' || methodId === 'medicineCritical') {
    const untreated = (character.state.criticalInjuries || []).filter((c) => !c.healed);
    if (!untreated.length) return { ok: false, reason: 'No untreated Critical Injury to heal.' };
    untreated[0].healed = true;
    events.push(`${untreated[0].name} treated.`);
    if (methodId === 'weekRest' && triumph > 0) {
      // R-9 — the manual prints Despair here; read as Triumph.
      if (untreated[1]) { untreated[1].healed = true; events.push(`Triumph healed a second Critical Injury: ${untreated[1].name} (R-9).`); }
    }
  }

  const bucket = LIMIT_BUCKET[method.limitKey];
  if (bucket) {
    character.state[bucket] = character.state[bucket] || {};
    character.state[bucket][methodId] = true;
  }
  character.state.incapacitated = character.state.wounds >= woundThreshold(character) || character.state.strain >= strainThreshold(character);
  saveCharacter(character);
  return { ok: true, events };
}

// ---------------------------------------------------------------------------
// Advancement (§3.15, §7) — characteristics are creation-only; only Dedication raises one.
// ---------------------------------------------------------------------------

export function advanceSkill(character, skillId) {
  const entry = character.skills[skillId];
  if (!entry) return { ok: false, reason: 'Unknown skill.' };
  if (entry.rank >= SKILL_RANK_MAX) return { ok: false, reason: `Rank ${SKILL_RANK_MAX} is the ceiling.` };
  const cost = xpCost('skill', { newRank: entry.rank + 1, career: entry.career });
  if (cost > character.xp.available) return { ok: false, reason: `Costs ${cost} XP; ${character.xp.available} available.` };
  entry.rank += 1;
  character.xp.available -= cost;
  character.advancementLog.push({ ts: Date.now(), kind: 'skill', detail: `${skillId} to rank ${entry.rank}`, xpSpent: cost });
  saveCharacter(character);
  return { ok: true, cost };
}

export function advanceTalent(character, talentId) {
  const held = {};
  character.talents.forEach((t) => { held[t.id] = t.ranks; });
  const legality = canBuyTalent(talentId, held);
  if (!legality.ok) return { ok: false, reason: legality.reason };
  if (legality.cost > character.xp.available) return { ok: false, reason: `Costs ${legality.cost} XP; ${character.xp.available} available.` };
  const existing = character.talents.find((t) => t.id === talentId);
  if (existing) existing.ranks += 1;
  else character.talents.push({ id: talentId, tier: talent(talentId).tier, ranks: 1 });
  character.xp.available -= legality.cost;
  character.advancementLog.push({ ts: Date.now(), kind: 'talent', detail: talent(talentId).name, xpSpent: legality.cost });
  // Dedication is the only post-creation characteristic raise, capped at 5 and never twice
  // on the same characteristic (§12A T5).
  saveCharacter(character);
  return { ok: true, cost: legality.cost, dedication: talentId === 'dedication' };
}

export function applyDedication(character, characteristicId) {
  const used = (character.state.dedicationUsed || []);
  if (used.includes(characteristicId)) return { ok: false, reason: 'Dedication cannot raise the same characteristic twice.' };
  if (character.attributes[characteristicId] >= 5) return { ok: false, reason: 'Dedication cannot take a characteristic above 5.' };
  character.attributes[characteristicId] += 1;
  character.state.dedicationUsed = [...used, characteristicId];
  saveCharacter(character);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Talent "tap to use" (§12A) — deducts the cost, sets the once-per-X flag.
// ---------------------------------------------------------------------------

const LIMIT_FLAG = { perEncounter: 'perEncounterFlags', perSession: 'perSessionFlags', perRound: 'perEncounterFlags', perTurn: 'perEncounterFlags' };

export function useTalent(character, talentId) {
  const def = talent(talentId);
  const held = character.talents.find((t) => t.id === talentId);
  if (!def || !held) return { ok: false, reason: 'That talent is not on this sheet.' };
  const bucket = def.limit ? LIMIT_FLAG[def.limit] : null;
  if (bucket && character.state[bucket] && character.state[bucket][talentId]) {
    return { ok: false, reason: `${def.name} is ${def.limit.replace('per', 'once per ').toLowerCase()}.` };
  }

  const cost = def.cost || {};
  const strainCost = cost.strain || (cost.strainPerRank ? held.ranks : 0);
  if (strainCost) {
    if (character.state.strain + strainCost >= strainThreshold(character)) {
      return { ok: false, reason: `${strainCost} strain would incapacitate this character.` };
    }
    character.state.strain += strainCost;
  }
  if (cost.storyPoint) {
    const cell = getCellPools();
    if (cell.pools.storyPointsPlayer < cost.storyPoint) return { ok: false, reason: 'No Story Point in the player pool.' };
    cell.pools.storyPointsPlayer -= cost.storyPoint;
    cell.pools.storyPointsGM += cost.storyPoint; // the point moves to the other pool (§8)
    saveCellPools(cell);
  }

  const effects = [];
  if (talentId === 'secondWind') {
    const healed = held.ranks;
    character.state.strain = Math.max(0, character.state.strain - healed);
    effects.push(`Healed ${healed} strain.`);
  }
  if (talentId === 'knowSomebody') effects.push(`Reduce the item's rarity by ${held.ranks} for this purchase.`);
  if (talentId === 'natural') effects.push('Reroll one check with either chosen skill.');
  if (def.derived) effects.push('Passive: already folded into the derived stats.');
  if (!effects.length) effects.push(def.summary);

  if (bucket) {
    character.state[bucket] = character.state[bucket] || {};
    character.state[bucket][talentId] = true;
  }
  saveCharacter(character);
  return { ok: true, strainCost, storyPointCost: cost.storyPoint || 0, effects };
}

function getCellPools() { return getCell(); }
function saveCellPools(cell) { return saveCellDirect(cell); }
