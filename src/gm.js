// gm.js — the GM dashboard: bestiary browser, one-tap encounter blocks, the NPC builder,
// and every rollable reference table (§3.21, B§6–B§7). Gated behind the gmScreen flag.

import { el, clear, titleCase, rollDie } from './core.js';
import { showToast, modal, panel, subTabs, accordion, emptyState, confirmModal } from './ui.js';
import { PANELS, label as termLabel } from './help.js';
import {
  CRITICAL_INJURIES, ENCOUNTER_SIZING, DIFFICULTIES, SPEND_TABLES, HEAT, DREAD_CHECKS,
  RARITY, ITEM_DAMAGE, FALLING, SILHOUETTES, QUICK_REFERENCE, CHARACTERISTICS
} from '../data.js';
import { ADVERSARY_TIERS, ADVERSARY_ABILITIES, NPC_QUICKGEN, ADVERSARY_TALENT } from '../data-npcs.js';
import { BESTIARY, ENCOUNTER_BLOCKS, RANDOM_ENCOUNTERS, MINION_GROUPS } from '../data-monsters.js';
import { isVeryChallenging, minionGroupWoundThreshold, adversaryAbility } from './rules.js';
import { addFromBestiary, createTask, addRecipeNpc, papersCheckReflex } from './combat.js';
import { setUpEncounterBlock } from './roller.js';
import { activeCharacter } from './store.js';
import { getCell, saveCell } from './store.js';
import { applyCellHeat, applyPersonalHeat } from './heat.js';

const filters = { tier: 'all', heatOnly: false, challengingOnly: false, query: '' };

/** Papers-Check Reflex outside a running encounter: the ability's Heat effect applies even
 *  when the guards are not on the combat tracker (B§2). */
function applyCellHeatless(character) {
  const applied = applyPersonalHeat(character, 1, 'Papers-Check Reflex at a checkpoint');
  return { applied, note: `Papers-Check Reflex: Personal Heat ${applied.before} → ${applied.after}.` };
}

const GM_TABS = [
  { id: 'cell',       label: 'Network' },
  { id: 'bestiary',   label: 'Opponents' },
  { id: 'encounters', label: 'Encounters' },
  { id: 'tables',     label: 'Tables' },
  { id: 'build',      label: 'Build' }
];
let gmTab = 'bestiary';

/** Arriving at the GM screen opens it at Opponents with the browser unfiltered, rather than
 *  wherever the last visit left it (B-6). */
export function resetGmTab() {
  gmTab = 'bestiary';
  filters.tier = 'all';
  filters.heatOnly = false;
  filters.challengingOnly = false;
  filters.query = '';
}

export function renderGm(mount) {
  clear(mount);
  const rerender = () => renderGm(mount);
  mount.append(el('div', { class: 'card' }, [
    el('h2', { text: 'GM screen' }),
    el('p', { class: 'lede', text: 'Everything you need behind the screen, one section at a time.' }),
    subTabs(GM_TABS, gmTab, (id) => { gmTab = id; rerender(); })
  ]));
  ({ cell: gmCell, bestiary: gmBestiary, encounters: gmEncounters, tables: gmTables, build: gmBuild })[gmTab](mount, rerender);
}

function gmCell(mount, rerender) {
  // --- the Cell ---
  const cell = getCell();
  const cellCard = panel(termLabel('cell'), PANELS.gmCell, [
    el('label', { class: 'small', for: 'cell-name', text: 'Name' }),
    el('input', {
      type: 'text', id: 'cell-name', value: cell.name,
      onchange: (e) => { const c = getCell(); c.name = e.target.value; saveCell(c); showToast('Cell name saved'); }
    }),
    el('p', { class: 'small', text: `Cell Heat ${cell.cellHeat} / ${HEAT.max} · safehouse ${cell.safehouseStatus} · Story Points ${cell.pools.storyPointsPlayer} player / ${cell.pools.storyPointsGM} GM` }),
    el('button', { type: 'button', class: 'secondary', text: 'Cell Heat +1', onclick: () => { const r = applyCellHeat(1); showToast(`Cell Heat ${r.before} → ${r.after}`); rerender(); } }),
    el('button', { type: 'button', class: 'secondary', text: 'Cell Heat −1', onclick: () => { const r = applyCellHeat(-1); showToast(`Cell Heat ${r.before} → ${r.after}`); rerender(); } })
  ]);
  mount.append(cellCard);
}

function gmBestiary(mount, rerender) {
  // --- bestiary browser ---
  const browser = panel('Opponents', PANELS.gmBestiary, []);
  const search = el('input', {
    type: 'search', id: 'bestiary-search', placeholder: 'Search adversaries…', 'aria-label': 'Search the bestiary',
    value: filters.query, oninput: (e) => { filters.query = e.target.value; drawList(); }
  });
  const tierSelect = el('select', { id: 'bestiary-tier', 'aria-label': 'Filter by tier', onchange: (e) => { filters.tier = e.target.value; drawList(); } });
  [['all', 'All tiers'], ['minion', 'Minions'], ['rival', 'Rivals'], ['nemesis', 'Nemeses'], ['animal', 'Animals']]
    .forEach(([value, label]) => tierSelect.append(el('option', { value, text: label, selected: filters.tier === value })));
  const heatToggle = el('input', { type: 'checkbox', id: 'bestiary-heat', checked: filters.heatOnly, onchange: (e) => { filters.heatOnly = e.target.checked; drawList(); } });
  const challengeToggle = el('input', { type: 'checkbox', id: 'bestiary-challenging', checked: filters.challengingOnly, onchange: (e) => { filters.challengingOnly = e.target.checked; drawList(); } });
  browser.append(search, tierSelect);
  browser.append(el('div', { class: 'toggle-row' }, [heatToggle, el('label', { for: 'bestiary-heat' }, [el('span', { text: 'Heat-relevant only' })])]));
  browser.append(el('div', { class: 'toggle-row' }, [challengeToggle, el('label', { for: 'bestiary-challenging' }, [el('span', { text: 'Very challenging only' })])]));

  const list = el('div', { id: 'bestiary-list' });
  browser.append(list);
  mount.append(browser);

  function drawList() {
    clear(list);
    const q = filters.query.trim().toLowerCase();
    const entries = BESTIARY.filter((e) => {
      if (filters.tier !== 'all' && e.kind !== filters.tier) return false;
      if (filters.heatOnly && !e.heatHook) return false;
      if (filters.challengingOnly && !(e.kind === 'rival' && isVeryChallenging(e))) return false;
      if (q && !`${e.name} ${e.hook}`.toLowerCase().includes(q)) return false;
      return true;
    });
    list.append(el('p', { class: 'small muted', text: `${entries.length} of ${BESTIARY.length} entries` }));
    // Grouped by tier and collapsed, the way the rules library groups its entries, so 28
    // full stat blocks do not arrive as one 6,500px run (B-5).
    const groups = [
      { id: 'minion', label: 'Minions' }, { id: 'rival', label: 'Rivals' },
      { id: 'nemesis', label: 'Nemeses' }, { id: 'animal', label: 'Animals' }
    ];
    let opened = 0;
    groups.forEach((group) => {
      const inGroup = entries.filter((e) => e.kind === group.id);
      if (!inGroup.length) return;
      const body = el('div', {});
      inGroup.forEach((entry) => body.append(entryCard(entry)));
      const open = !!q || opened === 0;
      opened += 1;
      list.append(el('details', { class: 'accordion', open }, [
        el('summary', {}, [
          el('span', { class: 'accordion-title', text: group.label }),
          el('span', { class: 'accordion-summary', text: String(inGroup.length) })
        ]),
        body
      ]));
    });
  }

  function entryCard(entry) {
    {
      const stats = entry.abstract
        ? 'Abstract — no combat stats; resolved as an Oracle roll.'
        : `Soak ${entry.soak ?? '—'} · Def ${(entry.defense || {}).melee ?? 0}/${(entry.defense || {}).ranged ?? 0} · WT ${entry.woundThreshold ?? `${entry.woundThresholdPerMember} per member`}${entry.strainThreshold ? ` · ST ${entry.strainThreshold}` : ''}${entry.adversary ? ` · Adversary ${entry.adversary}` : ''}`;
      const card = el('div', { class: 'result' }, [
        el('div', { class: 'result-head' }, [
          el('span', { class: 'result-title', text: entry.name }),
          el('span', { class: 'cite', text: entry.kind })
        ]),
        el('div', { class: 'result-body', text: entry.hook }),
        el('div', { class: 'result-body', text: stats }),
        (entry.abilities || []).length
          ? el('div', { class: 'small muted', text: `Abilities: ${entry.abilities.map((a) => (adversaryAbility(a) || { name: a }).name).join(', ')}` })
          : null,
        (entry.kind === 'rival' && isVeryChallenging(entry)) || entry.heatHook
          ? el('div', { class: 'small muted', text: [
              entry.kind === 'rival' && isVeryChallenging(entry) ? 'Very challenging for one starting character.' : null,
              entry.heatHook ? 'Raises suspicion.' : null
            ].filter(Boolean).join(' ') })
          : null,
        entry.abstract ? null : el('button', {
          type: 'button', class: 'secondary', text: 'Drop into combat',
          onclick: () => { const r = addFromBestiary(entry.id); showToast(r.ok ? `${entry.name} added to the tracker` : r.reason); }
        })
      ]);
      return card;
    }
  }
  drawList();
}

function gmEncounters(mount, rerender) {
  // --- encounter blocks (B§6) ---
  const blocks = panel('Ready-made encounters', PANELS.gmEncounters, []);
  ENCOUNTER_BLOCKS.forEach((block) => {
    const dice = block.resolution.oppositionDice || block.resolution.oppositionDiceStart;
    const card = el('div', { class: 'result' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: block.name }),
        el('span', { class: 'cite', text: 'encounter' })
      ]),
      el('div', { class: 'result-body', text: block.hook }),
      el('div', { class: 'result-body', text: `${block.resolution.activeSkills.map(titleCase).join(' or ')} against ${titleCase(block.resolution.opposingSkill)}${dice ? `, ${Array.isArray(dice) ? dice.join('–') : dice} opposition dice` : ''}. ${block.consequence}` })
    ]);
    if (block.extended) {
      card.append(el('button', {
        type: 'button', class: 'secondary', text: 'Start the dragnet tracker',
        onclick: () => { createTask({ name: block.name, kind: 'dragnet', target: 4 }); showToast('Dragnet started on the progress tracker'); }
      }));
    } else {
      // The other three blocks print their skills and opposition, so they can be deployed
      // rather than read out (A-19).
      card.append(el('button', {
        type: 'button', class: 'secondary', id: `deploy-${block.id}`,
        text: 'Set this check up on the Roll screen',
        onclick: () => {
          const result = setUpEncounterBlock(block.id);
          if (!result.ok) { showToast(result.reason); return; }
          showToast(`${block.name}: ${titleCase(result.skill)} against ${titleCase(result.opposing)}`);
          location.hash = '#/roll';
        }
      }));
    }
    blocks.append(card);
  });
  mount.append(blocks);
}

function gmTables(mount, rerender) {
  // --- rollable reference tables (§3.21) ---
  const tables = panel('Roll on a table', PANELS.gmTables, []);
  tables.append(el('button', {
    type: 'button', class: 'secondary', text: 'Random encounter',
    onclick: () => {
      const roll = rollDie(10); // R-10
      const row = RANDOM_ENCOUNTERS.table.find((r) => r.roll === roll);
      const cellNow = getCell();
      const extra = roll === 10 && cellNow.cellHeat >= 4 ? ' Cell Heat is 4 or more — escalate toward a nemesis.' : '';
      modal({ title: `Random encounter — ${roll}`, body: `${row.entry}.${extra}`, actions: [{ label: 'Close', primary: true }] });
    }
  }));
  tables.append(el('button', {
    type: 'button', class: 'secondary', text: 'Critical Injury',
    onclick: () => {
      const roll = rollDie(100);
      const row = CRITICAL_INJURIES.find((r) => roll >= r.min && roll <= r.max);
      modal({ title: `Critical Injury — ${roll}`, body: `${row.name} (${row.severity}): ${row.effect}`, actions: [{ label: 'Close', primary: true }] });
    }
  }));
  tables.append(el('button', {
    type: 'button', class: 'secondary', text: 'NPC quick-gen',
    onclick: () => {
      const archetypeRoll = rollDie(10);
      const dispositionRoll = rollDie(10);
      const archetype = NPC_QUICKGEN.archetype.find((r) => archetypeRoll >= r.min && archetypeRoll <= r.max);
      const disposition = NPC_QUICKGEN.disposition.find((r) => dispositionRoll >= r.min && dispositionRoll <= r.max);
      modal({
        title: 'NPC quick-gen',
        body: `${archetype.name} (${archetypeRoll}), ${disposition.name} (${dispositionRoll}). Build as ${archetype.tier}. ${NPC_QUICKGEN.motivation}`,
        actions: [{ label: 'Close', primary: true }]
      });
    }
  }));
  mount.append(tables);

  // --- encounter sizing ---
  const sizing = panel('How big should this fight be?', {
    lede: 'A rough guide to how much opposition four players can handle.',
    detail: ENCOUNTER_SIZING.adventureSizing
  }, []);
  const sizingTable = el('table');
  sizingTable.append(el('tr', {}, [el('th', { text: 'Setup' }), el('th', { text: 'Difficulty' })]));
  ENCOUNTER_SIZING.table.forEach((row) => sizingTable.append(el('tr', {}, [el('td', { text: row.setup }), el('td', { text: row.difficulty })])));
  sizing.append(el('div', { class: 'table-wrap' }, [sizingTable]));
  mount.append(sizing);

  // --- quick reference ---
  const quick = panel('One-page reference', { lede: 'The book\'s own summary card.', detail: 'Difficulty ladder, symbols, suspicion thresholds, spend shorthand, injury bands, the Oracle and experience awards.' }, []);
  QUICK_REFERENCE.sections.forEach((section) => {
    quick.append(el('div', { class: 'result' }, [
      el('div', { class: 'result-head' }, [el('span', { class: 'result-title', text: section.title })]),
      el('div', { class: 'result-body', text: section.body })
    ]));
  });
  mount.append(quick);
}

function gmBuild(mount, rerender) {
  // --- NPC builder from the §12C recipes ---
  const builder = panel('Build an opponent', PANELS.gmBuild, []);
  const tierBody = el('div', {});
  ADVERSARY_TIERS.forEach((tier) => {
    tierBody.append(el('div', { class: 'result' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: tier.name }),
        el('span', { class: 'cite', text: 'tier' })
      ]),
      el('div', { class: 'result-body', text: tier.summary }),
      el('ul', { class: 'small muted' }, tier.rules.map((r) => el('li', { text: r }))),
      el('p', { class: 'small', text: tier.threatGuide || '' })
    ]));
  });
  builder.append(accordion('How the three tiers work', [tierBody], {
    key: 'gm-tiers', summary: ADVERSARY_TIERS.map((t) => t.name).join(', ')
  }));
  builder.append(el('p', { class: 'small', text: `${ADVERSARY_TALENT.name}: ${ADVERSARY_TALENT.summary}` }));
  // The 21 abilities are grouped by which book defines them and collapsed, the way the
  // Opponents tab groups its stat blocks (B-10).
  const abilityList = el('div', { id: 'ability-groups' });
  [['manual', 'From the core rules'], ['bestiary', 'From the bestiary']].forEach(([source, label], index) => {
    const inGroup = ADVERSARY_ABILITIES.filter((a) => a.source === source);
    if (!inGroup.length) return;
    const body = el('div', {});
    inGroup.forEach((ability) => {
      body.append(el('div', { class: 'result' }, [
        el('div', { class: 'result-head' }, [
          el('span', { class: 'result-title', text: ability.name }),
          el('span', { class: 'cite', text: ability.type || '' })
        ]),
        el('div', { class: 'result-body', text: ability.summary })
      ]));
    });
    abilityList.append(el('details', { class: 'accordion', open: index === 0 }, [
      el('summary', {}, [
        el('span', { class: 'accordion-title', text: label }),
        el('span', { class: 'accordion-summary', text: String(inGroup.length) })
      ]),
      body
    ]));
  });
  // Build and save a stat block from the recipes. Recipe-built NPCs derive their stats and
  // are stored as such, so they stay distinguishable from printed blocks (R-15).
  builder.append(el('h3', { text: 'Build one' }));
  const npcName = el('input', { type: 'text', id: 'npc-name', placeholder: 'Name', 'aria-label': 'NPC name' });
  const npcTier = el('select', { id: 'npc-tier', 'aria-label': 'NPC tier' });
  ADVERSARY_TIERS.forEach((t) => npcTier.append(el('option', { value: t.id, text: t.name })));
  const npcChar = {};
  const charGrid = el('div', { class: 'stat-grid' });
  CHARACTERISTICS.forEach((c) => {
    npcChar[c.id] = 2;
    const input = el('input', {
      type: 'number', min: '1', max: '6', value: '2', id: `npc-${c.id}`, 'aria-label': c.name,
      onchange: (e) => { npcChar[c.id] = Number(e.target.value); }
    });
    charGrid.append(el('div', { class: 'stat' }, [el('span', { class: 'stat-label', text: c.abbr }), input]));
  });
  const npcCount = el('input', { type: 'number', id: 'npc-count', min: '1', value: '3', 'aria-label': 'Minion group size' });
  builder.append(npcName, npcTier, charGrid, el('label', { class: 'small', for: 'npc-count', text: 'Minion group size' }), npcCount);
  builder.append(el('button', {
    type: 'button', class: 'secondary', id: 'npc-save', text: 'Save to the combat tracker',
    onclick: () => {
      const result = addRecipeNpc({
        name: npcName.value || 'Unnamed NPC', tier: npcTier.value,
        characteristics: { ...npcChar }, minionCount: Number(npcCount.value)
      });
      showToast(result.ok ? `${result.combatant.name} built from the §12C recipe and added` : result.reason);
    }
  }));
  builder.append(el('h3', { text: `Special abilities (${ADVERSARY_ABILITIES.length})` }), abilityList);
  mount.append(builder);

  // --- Papers-Check Reflex (B§2), driven from the GM screen ---
  const reflexCard = el('div', { class: 'card' }, [
    el('h3', { text: 'Papers-Check Reflex' }),
    el('p', { class: 'small muted', text: 'A PC who fails a Deception or Cool check against a group with this ability takes a Personal Heat check automatically.' }),
    el('button', {
      type: 'button', class: 'secondary', id: 'papers-check-failed', text: 'The check failed',
      onclick: () => {
        const character = activeCharacter();
        if (!character) { showToast('No active character.'); return; }
        const guards = MINION_GROUPS.find((m) => m.id === 'checkpointGuards');
        const applied = applyCellHeatless(character);
        showToast(applied.note);
        document.dispatchEvent(new CustomEvent('resource:refresh'));
      }
    })
  ]);
  mount.append(reflexCard);

}
