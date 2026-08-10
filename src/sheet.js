// sheet.js — the live character sheet and in-play tracking, plus the persistent
// resource header that rides on every in-play screen.

import { el, clear, titleCase, clamp, plain } from './core.js';
import { showToast, confirmModal, promptModal, modal, panel, subTabs, accordion, emptyState, outcomeBox, numberStepper } from './ui.js';
import { PANELS, label as termLabel, gloss } from './help.js';
import {
  SKILLS, CHARACTERISTICS, CONDITIONS, HEAT, CRITICAL_INJURIES, SUFFOCATION, RECOVERY,
  XP_COSTS, SKILL_RANK_MAX, FALLING, FALLING_RULES, STORY_POINTS, MOTIVATIONS
} from '../data.js';
import {
  talent, buildPool, canBuyTalent, visibleTalents, xpCost, skill as skillById,
  medicineDifficulty, fallDamage, career as careerById
} from './rules.js';
import { ITEM_DAMAGE, ATTACHMENTS, DIFFICULTIES, GEAR, WEAPONS, ARMOUR, RARITY, BLACK_MARKET, CREATION_RULES } from '../data.js';
import { PERSONAL_THREAT } from '../data-journey.js';
import { blackMarketPurchase, rollKickerSeed, kickerSeedLine } from './rules.js';
import { hardPoints } from './derived.js';
import { Settings } from './settings.js';
import { rollCriticalInjury, spendStoryPoint, applyTalentToCheck, state as rollerState } from './roller.js';
import {
  derivedFor, woundThreshold, strainThreshold, soak, encumbranceState, criticalModifier
} from './derived.js';
import { activeCharacter, saveCharacter, getCell, saveCell as saveCellDirect } from './store.js';
import { personalEffects, cellEffects, applyHeat, heatIsSplit, currentHeat } from './heat.js';

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
    // The story-point chip is the way into the economy, so all eight spends are one tap
    // from every in-play screen rather than buried on one of them.
    el('button', {
      type: 'button', class: 'chip chip-button', id: 'story-points-chip',
      'aria-label': `Story points: ${cell.pools.storyPointsPlayer} for the players, ${cell.pools.storyPointsGM} for the GM. Open the spend list.`,
      title: `${termLabel('storyPoints')}: players / GM. ${gloss('storyPoints')}`,
      text: `Story ${cell.pools.storyPointsPlayer}/${cell.pools.storyPointsGM}`,
      onclick: () => openStoryPoints()
    }),
    heatIsSplit()
      ? chip('Heat', `${character.state.personalHeat}·${cell.cellHeat}`, `${termLabel('personalHeat')} · ${termLabel('cellHeat')}. ${gloss('personalHeat')}`)
      : chip('Heat', `${cell.cellHeat}/${HEAT.max}`, `${termLabel('personalHeat')}. ${gloss('personalHeat')}`),
    chip('Load', `${enc.carried}/${enc.threshold}`, `${termLabel('encumbrance')} — ${gloss('encumbrance')}`)
  );
  if (character.state.incapacitated) node.append(el('span', { class: 'chip', text: 'INCAPACITATED' }));
}

/** Every Story Point spend the manual prints, both pools, with the two-pool flow enforced:
 *  a spent point moves to the other pool once its effect resolves (§8, R-4). */
export function openStoryPoints() {
  const draw = () => {
    const cell = getCell();
    const body = el('div', {});
    body.append(el('p', { class: 'small', id: 'story-pools', text:
      `${cell.pools.storyPointsPlayer} in the player pool, ${cell.pools.storyPointsGM} in the GM pool. ${STORY_POINTS.flow}` }));

    const pool = (side, spends, heading) => {
      body.append(el('h3', { text: heading }));
      const available = side === 'player' ? cell.pools.storyPointsPlayer : cell.pools.storyPointsGM;
      if (!available) body.append(el('p', { class: 'small muted', text: 'Nothing in this pool to spend.' }));
      spends.forEach((spend) => {
        body.append(el('div', { class: 'result' }, [
          el('div', { class: 'result-head' }, [el('span', { class: 'result-title', text: spend.label })]),
          el('button', {
            type: 'button', class: 'secondary', id: `story-${side}-${spend.id}`,
            text: 'Spend one', disabled: !available,
            'aria-label': `${spend.label} — spend one story point from the ${side} pool`,
            onclick: () => {
              const result = spendStoryPoint(side, spend.id);
              if (!result.ok) { showToast(result.reason); return; }
              // The die-modification spends only mean something on an open check, so that
              // one hands the upgrade straight to the roller.
              if (spend.id === 'upgradeDowngrade') {
                if (side === 'player') rollerState.upgradeAbility += 1;
                else rollerState.upgradeDifficulty += 1;
              }
              showToast(`${spend.label}. Pools now ${result.pools.storyPointsPlayer} player / ${result.pools.storyPointsGM} GM.`);
              document.dispatchEvent(new CustomEvent('resource:refresh'));
              dialog.close();
              openStoryPoints();
            }
          })
        ]));
      });
    };
    pool('player', STORY_POINTS.playerSpends, 'Spend from the player pool');
    pool('gm', STORY_POINTS.gmSpends, 'Spend from the GM pool');
    body.append(el('p', { class: 'small muted', text: STORY_POINTS.reset }));
    return body;
  };
  const dialog = modal({ title: 'Story points', body: draw(), actions: [{ label: 'Close', primary: true }] });
  return dialog;
}

export const SHEET_TABS = [
  { id: 'vitals',  label: 'Vitals' },
  { id: 'skills',  label: 'Skills' },
  { id: 'gear',    label: 'Gear' },
  { id: 'talents', label: 'Talents & injuries' },
  { id: 'care',    label: 'Recovery' },
  { id: 'advance', label: 'Advance' },
  { id: 'summary', label: 'Summary' }
];
let sheetTab = 'vitals';

/** The sheet opens on Vitals every time it is navigated to, rather than wherever it was
 *  last left (B-6). Sub-tab choice only survives while you stay on the screen. */
export function resetSheetTab() { sheetTab = 'vitals'; }

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

  const header = el('div', { class: 'card' }, [
    el('h2', { text: character.identity.name || 'Unnamed' }),
    el('p', { class: 'small muted', text: `${careerName(character.identity.career)} · ${character.xp.available} experience unspent` }),
    character.identity.erratum
      ? el('p', { class: 'small muted', text: character.identity.erratum.note })
      : null
  ]);
  // A name is the one thing you might want to change long after creation.
  header.append(el('button', {
    type: 'button', class: 'secondary', id: 'rename-character',
    text: 'Rename', 'aria-label': `Rename ${character.identity.name || 'this character'}`,
    onclick: async () => {
      const next = await promptModal('What should this character be called?', {
        title: 'Rename', value: character.identity.name || '', confirmLabel: 'Rename'
      });
      if (next === null) return;
      const trimmed = String(next).trim();
      if (!trimmed) { showToast('A character needs a name.'); return; }
      if (trimmed === character.identity.name) return;
      character.identity.name = trimmed;
      saveCharacter(character);
      showToast(`Renamed to ${trimmed}`);
      rerender();
    }
  }));
  header.append(subTabs(SHEET_TABS, sheetTab, (id) => { sheetTab = id; rerender(); }));
  mount.append(header);

  PANES[sheetTab](mount, character, derived, rerender);
}

/** Careers are stored by id; the printed name is what a reader wants to see (C-1). */
function careerName(id) {
  const def = careerById(id);
  return def ? def.name : (id ? titleCase(id) : 'no career');
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
  const heatNow = currentHeat(character);
  const heatShown = heatIsSplit() ? character.state.personalHeat : heatNow.shared;
  vitals.append(stepper(`${termLabel('personalHeat')} — ${gloss('personalHeat')}`, heatShown, HEAT.max, (v) => {
    // Through applyPersonalHeat so the change is recorded on the trail and the cell
    // escalation rule still fires (§17.2).
    applyHeat(clamp(v, HEAT.min, HEAT.max) - heatShown, { character, reason: 'Set by hand on the sheet' });
    rerender();
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
    el('p', { class: 'small', text: heatIsSplit()
      ? `Personal ${character.state.personalHeat} / ${HEAT.max} · Cell ${cell.cellHeat} / ${HEAT.max} · safehouse ${cell.safehouseStatus}`
      : `${cell.cellHeat} of ${HEAT.max}, shared by the whole party · safehouse ${cell.safehouseStatus}` })
  ]);
  if (!heatIsSplit()) heatCard.append(el('p', { class: 'small muted', text: plain(HEAT.attribution) }));
  const personal = personalEffects(heatIsSplit() ? character.state.personalHeat : cell.cellHeat);
  const cellFx = cellEffects(cell.cellHeat);
  if (personal.length) heatCard.append(el('ul', { class: 'small' }, personal.map((t) => el('li', { text: t }))));
  if (cellFx.length) heatCard.append(el('ul', { class: 'small muted' }, cellFx.map((t) => el('li', { text: t }))));
  if (!personal.length && !cellFx.length) heatCard.append(el('p', { class: 'small muted', text: 'No threshold effects in force.' }));
  // Why the track sits where it does (C-10).
  const trail = (heatIsSplit() ? character.state.heatTrail : cell.heatTrail) || [];
  if (trail.length) {
    const trailBody = el('div', { id: 'heat-trail' });
    trail.forEach((move) => {
      trailBody.append(el('p', { class: 'small muted', text:
        `${new Date(move.ts).toLocaleString()} · ${move.from} → ${move.to} · ${move.reason}` }));
    });
    heatCard.append(accordion('How it got here', [trailBody], {
      key: 'sheet-heat-trail', summary: `last ${trail.length} change${trail.length === 1 ? '' : 's'}`
    }));
  }
  mount.append(heatCard);

  // §13 step 6 — the Kicker. One sentence, no mechanics, editable in play because it is
  // the thing the GM calls back to.
  const kicker = panel('Kicker', PANELS.sheetKicker, []);
  kicker.append(el('label', { class: 'small', for: 'kicker-text', text: CREATION_RULES.kicker.prompt }));
  const kickerField = el('textarea', {
    id: 'kicker-text', rows: '2', value: character.identity.kicker || '',
    placeholder: CREATION_RULES.kicker.examples[0],
    onchange: (e) => { character.identity.kicker = e.target.value.trim(); saveCharacter(character); }
  });
  kicker.append(kickerField);
  // The same writing seed the creation step offers, for a kicker written or rewritten later.
  const seedOut = el('p', { class: 'small', id: 'kicker-seed', 'aria-live': 'polite' });
  kicker.append(el('button', {
    type: 'button', class: 'secondary', id: 'kicker-roll', text: 'Stuck? Roll an idea',
    onclick: () => {
      const seed = rollKickerSeed();
      seedOut.textContent = `${kickerSeedLine(seed)} Write the sentence that puts your character in the middle of it.`;
    }
  }));
  kicker.append(seedOut);
  mount.append(kicker);

  // §33 — the optional per-character antagonist thread, three steps.
  if (Settings.journeyModule()) {
    const threat = character.state.personalThreat || { name: '', step: 0 };
    const card = panel('Personal threat', PANELS.sheetThreat, []);
    card.append(el('label', { class: 'small', for: 'threat-name', text: 'Who or what is hunting this character specifically?' }));
    card.append(el('input', {
      type: 'text', id: 'threat-name', value: threat.name || '',
      placeholder: PERSONAL_THREAT.examples[0],
      onchange: (e) => {
        character.state.personalThreat = { ...threat, name: e.target.value.trim() };
        saveCharacter(character); rerender();
      }
    }));
    if (threat.name) {
      PERSONAL_THREAT.ladder.forEach((rung) => {
        const reached = threat.step >= rung.step;
        card.append(el('p', { class: reached ? 'small' : 'small muted', text: `${reached ? '●' : '○'} ${rung.step}. ${rung.name} — ${rung.summary}` }));
      });
      card.append(el('button', {
        type: 'button', class: 'secondary', id: 'threat-advance', text: 'Advance the countdown',
        disabled: threat.step >= PERSONAL_THREAT.steps,
        onclick: () => {
          const step = Math.min(PERSONAL_THREAT.steps, (threat.step || 0) + 1);
          character.state.personalThreat = { ...threat, step };
          saveCharacter(character);
          const rung = PERSONAL_THREAT.ladder.find((l) => l.step === step);
          showToast(`${threat.name}: ${rung.name}.`);
          rerender();
        }
      }));
      if (threat.step > 0) {
        card.append(el('button', {
          type: 'button', class: 'secondary', text: 'Step back',
          onclick: () => { character.state.personalThreat = { ...threat, step: threat.step - 1 }; saveCharacter(character); rerender(); }
        }));
      }
      if (threat.step >= 2) card.append(el('p', { class: 'small', text: 'While it is closing in, checks made to avoid or evade it take one Setback die.' }));
      if (threat.step >= PERSONAL_THREAT.steps) card.append(el('p', { class: 'small', text: plain(PERSONAL_THREAT.afterStep3) }));
    }
    mount.append(card);
  }
}

/** The four groups the skill list already carries, so 26 rows read as a contents page
 *  rather than one run (B-8). */
const SKILL_GROUPS = [
  { id: 'combat',    label: 'Combat' },
  { id: 'general',   label: 'General' },
  { id: 'social',    label: 'Social' },
  { id: 'knowledge', label: 'Knowledge' }
];

function pane_skills(mount, character, derived, rerender) {
  const skillCard = panel('Skills', PANELS.sheetSkills, []);
  const trained = SKILLS.filter((s) => character.skills[s.id].rank > 0).length;
  skillCard.append(el('p', { class: 'small muted', text: `${trained} of ${SKILLS.length} have ranks. Tap any name to take it to the Roll screen.` }));

  const rowsFor = (list) => {
    const table = el('table');
    table.append(el('tr', {}, [el('th', { text: 'Skill' }), el('th', { text: 'Rank' }), el('th', { text: 'Dice' })]));
    list.forEach((s) => {
      const rank = character.skills[s.id].rank;
      const pool = buildPool(rank, character.attributes[s.characteristic]);
      table.append(el('tr', {}, [
        // Tapping a skill selects it on the Roll screen and goes there, so the sheet is the
        // way into a check rather than a place to read the skill's name and retype it.
        el('td', {}, [el('button', {
          type: 'button', class: 'skill-link',
          'aria-label': `Roll ${s.name}`,
          text: `${s.name}${character.skills[s.id].career ? ' ●' : ''}`,
          onclick: () => { rollerState.skillId = s.id; location.hash = '#/roll'; }
        })]),
        el('td', { text: String(rank) }),
        el('td', { text: `${pool.ability} plain${pool.proficiency ? `, ${pool.proficiency} upgraded` : ''}` })
      ]));
    });
    return el('div', { class: 'table-wrap' }, [table]);
  };

  SKILL_GROUPS.forEach((group, index) => {
    const list = SKILLS.filter((s) => s.category === group.id);
    if (!list.length) return;
    const withRanks = list.filter((s) => character.skills[s.id].rank > 0).length;
    skillCard.append(accordion(group.label, [rowsFor(list)], {
      key: `sheet-skills-${group.id}`,
      summary: withRanks ? `${withRanks} of ${list.length} trained` : `${list.length}, none trained`,
      defaultOpen: index === 0
    }));
  });
  mount.append(skillCard);

  // Conditions fold away behind what is actually ticked, the way the Roll screen's
  // situation panel and the combat card do (B-9).
  const condBody = el('div', {});
  const list = CONDITIONS.filter((c) => !c.id.startsWith('heat'));
  list.forEach((c) => {
    condBody.append(el('div', { class: 'toggle-row' }, [
      el('input', {
        type: 'checkbox', id: `cond-${c.id}`, checked: !!character.state.conditions[c.id],
        onchange: (e) => { character.state.conditions[c.id] = e.target.checked; saveCharacter(character); rerender(); }
      }),
      el('label', { for: `cond-${c.id}` }, [
        el('span', { text: c.name }),
        el('span', { class: 'toggle-desc', text: c.effect })
      ])
    ]));
  });
  const on = list.filter((c) => character.state.conditions[c.id]).map((c) => c.name);
  const conditionCard = panel('States you are in', PANELS.sheetConditions, [
    accordion('Anything affecting you right now?', [condBody], {
      key: 'sheet-conditions', summary: on.length ? on.join(', ') : 'nothing'
    })
  ]);
  mount.append(conditionCard);
}

function pane_gear(mount, character, derived, rerender) {
  // --- what you can pay with: three separate pockets ---
  const money = character.inventory.money;
  const purse = panel('What you can pay with', {
    lede: `Cash, ration cards and things worth trading. Above the counter you pay in ${Settings.currencyLabel()}; below it, sellers want the other two.`,
    detail: 'Ration cards and barter goods are tracked apart from cash because the black-market house rule spends them directly — a seller who wants two ration cards will not take the equivalent in notes.'
  }, []);
  purse.append(numberStepper({
    id: 'purse-cash', label: `Cash (${Settings.currencyLabel()})`, ariaName: 'Cash', value: money.amount || 0,
    min: 0, max: 99999, steps: [1, 10, 100],
    onChange: (v) => { character.inventory.money.amount = v; saveCharacter(character); rerender(); }
  }));
  purse.append(numberStepper({
    id: 'purse-cards', label: 'Ration cards', ariaName: 'Ration cards', value: money.rationCards || 0,
    min: 0, max: 999, steps: [1, 5],
    onChange: (v) => { character.inventory.money.rationCards = v; saveCharacter(character); rerender(); }
  }));
  purse.append(numberStepper({
    id: 'purse-barter', label: 'Barter goods and favours owed', ariaName: 'Barter goods', value: money.barterGoods || 0,
    min: 0, max: 999, steps: [1, 5],
    onChange: (v) => { character.inventory.money.barterGoods = v; saveCharacter(character); rerender(); }
  }));
  mount.append(purse);

  mount.append(buyPanel(character, rerender));

  // inventory
  const invCard = panel('What you are carrying', PANELS.sheetGear, []);
  const enc = encumbranceState(character);
  invCard.append(el('p', { class: 'small', text: `Carrying ${enc.carried} against a threshold of ${enc.threshold}.` }));
  if (enc.over) {
    invCard.append(el('p', { class: 'small' }, [
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
      // A talent with a roller effect always gets a button, even a passive one: the rule
      // fires automatically but its trigger — engaged with one opponent, a chosen skill,
      // a target that has not acted — is a judgement call the app cannot make (A-22).
      def.roller
        ? el('p', { class: 'small muted', text: def.activation === 'passive'
            ? 'Passive, but only in the right situation. Tap it when that situation applies and the dice go into the open check.'
            : 'Tapping this puts it straight into the open check on the Roll screen.' })
        : def.activation === 'passive' ? null
          : el('p', { class: 'small muted', text: 'Tapping Use pays the cost and marks it spent; the effect itself is yours to narrate.' }),
      (def.activation === 'passive' && !def.roller) ? null : el('button', {
        type: 'button', class: 'secondary',
        text: def.activation === 'passive' ? 'Apply to this check' : 'Use',
        'aria-label': `${def.activation === 'passive' ? 'Apply' : 'Use'} ${def.name}`,
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
      el('strong', { text: def.name }), ' ', def.perTurn
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

  // How hard the Medicine check is, worked out from the patient's own wounds (§5G).
  const medBody = el('div', {});
  const med = medicineDifficulty({
    wounds: character.state.wounds,
    woundThreshold: woundThreshold(character),
    selfTreatment: !!character.state.careFlags.selfTreatment,
    noEquipment: !!character.state.careFlags.noEquipment
  });
  medBody.append(el('p', { class: 'small', id: 'medicine-difficulty' }, [
    `Treating these ${character.state.wounds} wounds is a `,
    el('strong', { text: titleCase(med.difficulty) }),
    ' Medicine check.'
  ]));
  med.applied.forEach((line) => medBody.append(el('p', { class: 'small muted', text: line })));
  [['selfTreatment', 'Treating yourself'], ['noEquipment', 'No medical kit to hand']].forEach(([flag, label]) => {
    medBody.append(el('div', { class: 'toggle-row' }, [
      el('input', {
        type: 'checkbox', id: `medicine-${flag}`, checked: !!character.state.careFlags[flag],
        onchange: (e) => { character.state.careFlags[flag] = e.target.checked; saveCharacter(character); rerender(); }
      }),
      el('label', { for: `medicine-${flag}` }, [el('span', { text: label })])
    ]));
  });
  medBody.append(el('button', {
    type: 'button', class: 'secondary', id: 'medicine-to-roller',
    text: 'Set this check up on the Roll screen',
    onclick: () => {
      rollerState.skillId = 'medicine';
      rollerState.difficultyId = med.difficulty;
      rollerState.opposed = false;
      rollerState.audienceSize = null;
      location.hash = '#/roll';
    }
  }));
  recoveryCard.append(el('h3', { text: 'How hard is the check?' }), medBody);

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

  // --- falls (§5I): the band sets the damage; the mitigation check trims it ---
  const fallCard = panel('Taking a fall', PANELS.sheetFall, []);
  const fallBand = el('select', { id: 'fall-band', 'aria-label': 'How far you fell' });
  FALLING.forEach((f) => fallBand.append(el('option', { value: f.band, text: `${titleCase(f.band)} range` })));
  const fallSuccess = el('input', { type: 'number', id: 'fall-successes', min: '0', value: '0', 'aria-label': 'Uncancelled Success on the mitigation check' });
  const fallAdvantage = el('input', { type: 'number', id: 'fall-advantages', min: '0', value: '0', 'aria-label': 'Uncancelled Advantage on the mitigation check' });
  fallCard.append(
    el('label', { class: 'small', for: 'fall-band', text: 'How far you fell' }), fallBand,
    el('p', { class: 'small muted', text: FALLING_RULES.mitigation }),
    el('label', { class: 'small', for: 'fall-successes', text: 'Uncancelled Success' }), fallSuccess,
    el('label', { class: 'small', for: 'fall-advantages', text: 'Uncancelled Advantage' }), fallAdvantage,
    el('button', {
      type: 'button', class: 'secondary', id: 'apply-fall', text: 'Apply the fall',
      onclick: () => {
        const result = applyFall(character, fallBand.value, {
          successes: Number(fallSuccess.value), advantages: Number(fallAdvantage.value)
        });
        result.events.forEach((e) => showToast(e));
        rerender();
      }
    })
  );
  if (character.state.lastFall) {
    fallCard.append(outcomeBox(character.state.lastFall, { title: 'The last fall', tone: 'bad' }));
  }
  mount.append(fallCard);
}

/** Apply a fall to the sheet: wounds past soak, strain unreduced, and the Critical roll (§5I). */
export function applyFall(character, band, { successes = 0, advantages = 0 } = {}) {
  const result = fallDamage({
    band,
    woundThreshold: woundThreshold(character),
    soak: soak(character),
    successes, advantages
  });
  if (!result) return { ok: false, events: ['Unknown fall distance.'] };
  character.state.wounds = Math.max(0, character.state.wounds + result.wounds);
  character.state.strain = Math.max(0, character.state.strain + result.strain);
  character.state.incapacitated = character.state.wounds >= woundThreshold(character)
    || character.state.strain >= strainThreshold(character);
  const events = [
    `${titleCase(band)} fall: ${result.wounds} wounds after soak, ${result.strain} strain.`
  ];
  if (result.criticalModifier) events.push(`Roll a Critical Injury at +${result.criticalModifier}.`);
  if (result.note) events.push(result.note);
  if (character.state.incapacitated) events.push('Incapacitated.');
  character.state.lastFall = events;
  saveCharacter(character);
  return { ok: true, events, result };
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

/** A read-only account of the whole character on one screen, so it can be printed and
 *  carried as a paper backup (C-6). Nothing here is editable by design. */
function pane_summary(mount, character, derived, rerender) {
  const card = panel('The whole character', PANELS.sheetSummary, [], { id: 'character-summary' });
  const m = character.identity.motivation || {};
  const line = (label, value) => el('p', { class: 'small' }, [el('strong', { text: `${label}: ` }), String(value || '—')]);

  card.append(el('h3', { text: character.identity.name || 'Unnamed' }));
  card.append(line('Career', careerName(character.identity.career)));
  card.append(line('Experience', `${character.xp.available} unspent of ${character.xp.total} earned`));

  card.append(el('h3', { text: 'Characteristics' }));
  card.append(el('div', { class: 'stat-grid' }, CHARACTERISTICS.map((c) => statBox(c.name, character.attributes[c.id]))));

  card.append(el('h3', { text: 'Worked-out numbers' }));
  card.append(el('div', { class: 'stat-grid' }, [
    statBox('Injury limit', `${character.state.wounds} / ${derived.woundThreshold}`),
    statBox('Stress limit', `${character.state.strain} / ${derived.strainThreshold}`),
    statBox(termLabel('soak'), derived.soak),
    statBox('Close defence', derived.meleeDefense),
    statBox('Ranged defence', derived.rangedDefense),
    statBox('Carrying', `${encumbranceState(character).carried} / ${derived.encumbranceThreshold}`)
  ]));

  card.append(el('h3', { text: 'Skills' }));
  const trained = SKILLS.filter((sk) => character.skills[sk.id].rank > 0);
  if (!trained.length) card.append(el('p', { class: 'small muted', text: 'No ranks bought yet.' }));
  else {
    const table = el('table');
    table.append(el('tr', {}, [el('th', { text: 'Skill' }), el('th', { text: 'Rank' }), el('th', { text: 'Pool' })]));
    trained.forEach((sk) => {
      const pool = buildPool(character.skills[sk.id].rank, character.attributes[sk.characteristic]);
      table.append(el('tr', {}, [
        el('td', { text: `${sk.name}${character.skills[sk.id].career ? ' ●' : ''}` }),
        el('td', { text: String(character.skills[sk.id].rank) }),
        el('td', { text: `${pool.ability}A ${pool.proficiency}P` })
      ]));
    });
    card.append(el('div', { class: 'table-wrap' }, [table]));
  }

  card.append(el('h3', { text: 'Talents' }));
  card.append(el('p', { class: 'small', text: character.talents.length
    ? character.talents.map((t) => `${talent(t.id) ? talent(t.id).name : t.id}${t.ranks > 1 ? ` ×${t.ranks}` : ''}`).join(', ')
    : 'None yet.' }));

  card.append(el('h3', { text: 'What drives them' }));
  ['desire', 'fear', 'strength', 'flaw'].forEach((facet) => card.append(line(titleCase(facet), m[facet])));
  card.append(line('Kicker', character.identity.kicker));
  if (Settings.journeyModule() && character.state.personalThreat.name) {
    const step = PERSONAL_THREAT.ladder.find((l) => l.step === character.state.personalThreat.step);
    card.append(line('Personal threat', `${character.state.personalThreat.name} — ${step ? step.name.toLowerCase() : 'not yet noticed'}`));
  }

  card.append(el('h3', { text: 'Carried' }));
  const items = character.inventory.items || [];
  card.append(el('p', { class: 'small', text: items.length ? items.map((i) => i.name || i.id).join(', ') : 'Nothing.' }));
  const money = character.inventory.money;
  card.append(line('Money', `${money.amount || 0} ${Settings.currencyLabel()} · ${money.rationCards || 0} ration cards · ${money.barterGoods || 0} in barter goods`));

  const untreated = (character.state.criticalInjuries || []).filter((c) => !c.healed);
  card.append(el('h3', { text: 'Lasting injuries' }));
  card.append(el('p', { class: 'small', text: untreated.length ? untreated.map((c) => `${c.name} (${c.severity})`).join(', ') : 'None untreated.' }));

  card.append(line(termLabel('personalHeat'), `${heatIsSplit() ? character.state.personalHeat : getCell().cellHeat} of ${HEAT.max}`));
  if (character.notes) { card.append(el('h3', { text: 'Notes' }), el('p', { class: 'small', text: character.notes })); }

  card.append(el('button', {
    type: 'button', class: 'secondary', id: 'print-summary', text: 'Print or save as PDF',
    onclick: () => window.print()
  }));
  mount.append(card);
}

const PANES = { vitals: pane_vitals, skills: pane_skills, gear: pane_gear, talents: pane_talents, care: pane_care, advance: pane_advance, summary: pane_summary };

/** HOUSE RULE — the black-market counter. It reuses the printed rarity ladder and adds the
 *  barter demand on top; every surface here is badged so it never reads as printed. */
function buyPanel(character, rerender) {
  const catalogue = [
    ...GEAR.filter((g) => g.rarity !== null && g.rarity !== undefined).map((g) => ({ ...g, kind: 'gear' })),
    ...WEAPONS.filter((w) => w.rarity !== null && w.rarity !== undefined).map((w) => ({ ...w, kind: 'weapon' })),
    ...ARMOUR.filter((a) => a.rarity !== null && a.rarity !== undefined).map((a) => ({ ...a, kind: 'armour' }))
  ];
  const chosen = catalogue.find((i) => i.id === buyState.itemId) || catalogue[0];
  const money = character.inventory.money;

  const card = panel('Buy something', {
    lede: 'Work out what a purchase will cost and how hard the check is, then pay for it.',
    detail: `Legal goods go through Negotiation, illegal ones through Streetwise, at the difficulty their rarity sets. Above rarity ${BLACK_MARKET.barterFromRarity - 1} this table's house rule also demands ration cards or goods in trade: one card per point of rarity above 5. With nothing to trade the check gets one step harder and the shortfall is made up in cash or favours.`
  }, []);
  card.append(el('p', { class: 'small muted', text: BLACK_MARKET.badge }));

  const itemSelect = el('select', { id: 'buy-item', 'aria-label': 'What to buy', onchange: (e) => { buyState.itemId = e.target.value; rerender(); } });
  catalogue.forEach((item) => itemSelect.append(el('option', {
    value: item.id, selected: chosen && item.id === chosen.id,
    text: `${item.name} — rarity ${item.rarity}${item.price ? `, ${item.price} ${Settings.currencyLabel()}` : ''}`
  })));
  card.append(el('label', { class: 'small', for: 'buy-item', text: 'What are you after?' }), itemSelect);

  const whereSelect = el('select', { id: 'buy-where', 'aria-label': 'Where you are buying', onchange: (e) => { buyState.modifier = e.target.value; rerender(); } });
  RARITY.modifiers.forEach((m) => whereSelect.append(el('option', {
    value: m.id, selected: buyState.modifier === m.id,
    text: `${m.label} (${m.value >= 0 ? '+' : ''}${m.value})`
  })));
  card.append(el('label', { class: 'small', for: 'buy-where', text: 'Where are you buying?' }), whereSelect);

  const modifier = RARITY.modifiers.find((m) => m.id === buyState.modifier) || RARITY.modifiers[1];
  const quote = blackMarketPurchase({
    rarity: chosen ? chosen.rarity : 0,
    modifierValues: [modifier.value],
    rationCards: money.rationCards || 0,
    barterGoods: money.barterGoods || 0
  });

  const lines = [
    `${titleCase(quote.skill)} check at ${quote.difficulty} difficulty${quote.extraSteps ? ` — one step harder, because you have nothing to trade` : ''}.`,
    chosen && chosen.price ? `Price: ${chosen.price} ${Settings.currencyLabel()}, and you have ${money.amount || 0}.` : 'No printed price; settle it with the GM.'
  ];
  if (quote.needsBarter) {
    lines.push(quote.cardsRequired
      ? `Ration cards wanted: ${quote.cardsRequired}, and you have ${money.rationCards || 0}.`
      : 'Trade goods wanted on top of the cash.');
    if (quote.cardsShort && quote.payingWithGoods) lines.push(`Short ${quote.cardsShort} card(s), so a barter good goes instead.`);
    if (quote.cardsShort && !quote.payingWithGoods) lines.push(`Short ${quote.cardsShort} card(s) with nothing to trade: the check is one step harder.`);
  }
  if (quote.upgrades) lines.push(`Rarity above 10: the difficulty is upgraded ${quote.upgrades} time(s).`);
  card.append(outcomeBox(lines, { title: 'What this will take' }));

  card.append(el('button', {
    type: 'button', class: 'primary', id: 'buy-setup',
    text: 'Set this check up on the Roll screen',
    onclick: () => {
      Object.assign(rollerState, {
        skillId: quote.skill,
        difficultyId: quote.difficulty,
        opposed: false,
        blackMarket: quote.needsBarter,
        surveilled: quote.needsBarter
      });
      location.hash = '#/roll';
    }
  }));

  const affordable = (!chosen.price || (money.amount || 0) >= chosen.price)
    && (!quote.cardsRequired || (money.rationCards || 0) >= quote.cardsRequired || (money.barterGoods || 0) > 0);
  card.append(el('button', {
    type: 'button', class: 'secondary', id: 'buy-pay', text: 'Pay and take it', disabled: !affordable,
    onclick: () => {
      const paid = [];
      if (chosen.price) { character.inventory.money.amount = Math.max(0, (money.amount || 0) - chosen.price); paid.push(`${chosen.price} ${Settings.currencyLabel()}`); }
      if (quote.cardsRequired && (money.rationCards || 0) >= quote.cardsRequired) {
        character.inventory.money.rationCards = (money.rationCards || 0) - quote.cardsRequired;
        paid.push(`${quote.cardsRequired} ration card(s)`);
      } else if (quote.needsBarter && (money.barterGoods || 0) > 0) {
        character.inventory.money.barterGoods = (money.barterGoods || 0) - 1;
        paid.push('a barter good');
      }
      character.inventory.items.push({
        id: chosen.id, name: chosen.name, kind: chosen.kind, price: chosen.price || 0,
        encumbrance: chosen.encumbrance || 0, qty: 1, equipped: false, damageLevel: 'undamaged', attachments: []
      });
      saveCharacter(character);
      showToast(`${chosen.name} bought for ${paid.join(' and ') || 'nothing'}`);
      rerender();
    }
  }));
  if (!affordable) card.append(el('p', { class: 'small muted', text: 'You cannot cover this yet — more cash, more ration cards, or something to trade.' }));
  return card;
}

const buyState = { itemId: null, modifier: 'midSize' };

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
  if (def.derived) effects.push('Passive: already folded into the derived stats.');
  // Talents whose printed text names an exact change to your own pool push it into the open
  // check rather than telling you to apply it yourself (A-22).
  const pushed = applyTalentToCheck(def, held.ranks);
  if (pushed) effects.push(`${pushed.note} Applied to the open check on the Roll screen.`);
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
