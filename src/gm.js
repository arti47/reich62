// gm.js — the GM dashboard: bestiary browser, one-tap encounter blocks, the NPC builder,
// and every rollable reference table (§3.21, B§6–B§7). Gated behind the gmScreen flag.

import { el, clear, titleCase, rollDie } from './core.js';
import { showToast, modal } from './ui.js';
import {
  CRITICAL_INJURIES, ENCOUNTER_SIZING, DIFFICULTIES, SPEND_TABLES, HEAT, DREAD_CHECKS,
  RARITY, ITEM_DAMAGE, FALLING, SILHOUETTES, QUICK_REFERENCE, CHARACTERISTICS
} from '../data.js';
import { ADVERSARY_TIERS, ADVERSARY_ABILITIES, NPC_QUICKGEN, ADVERSARY_TALENT } from '../data-npcs.js';
import { BESTIARY, ENCOUNTER_BLOCKS, RANDOM_ENCOUNTERS, MINION_GROUPS } from '../data-monsters.js';
import { isVeryChallenging, minionGroupWoundThreshold, adversaryAbility } from './rules.js';
import { addFromBestiary, createTask, addRecipeNpc, papersCheckReflex } from './combat.js';
import { activeCharacter } from './store.js';
import { getCell, saveCell } from './store.js';
import { applyCellHeat, applyPersonalHeat } from './heat.js';

const filters = { tier: 'all', heatOnly: false, challengingOnly: false, query: '' };

/** Papers-Check Reflex outside a running encounter: the ability's Heat effect applies even
 *  when the guards are not on the combat tracker (B§2). */
function applyCellHeatless(character) {
  const applied = applyPersonalHeat(character, 1);
  return { applied, note: `Papers-Check Reflex: Personal Heat ${applied.before} → ${applied.after} (B§2, §17.1).` };
}

export function renderGm(mount) {
  clear(mount);
  const rerender = () => renderGm(mount);

  // --- the Cell ---
  const cell = getCell();
  const cellCard = el('div', { class: 'card' }, [
    el('h2', { text: 'Cell' }),
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

  // --- bestiary browser ---
  const browser = el('div', { class: 'card' }, [
    el('h2', { text: 'Bestiary' }),
    el('p', { class: 'small muted', text: 'Printed stats load exactly as published and are never recomputed from the PC formulas (R-15).' })
  ]);
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
  browser.append(el('div', { class: 'toggle-row' }, [challengeToggle, el('label', { for: 'bestiary-challenging' }, [el('span', { text: 'Very challenging only (§12C)' })])]));

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
    entries.forEach((entry) => {
      const stats = entry.abstract
        ? 'Abstract — no combat stats; resolved as an Oracle roll (B§2).'
        : `Soak ${entry.soak ?? '—'} · Def ${(entry.defense || {}).melee ?? 0}/${(entry.defense || {}).ranged ?? 0} · WT ${entry.woundThreshold ?? `${entry.woundThresholdPerMember} per member`}${entry.strainThreshold ? ` · ST ${entry.strainThreshold}` : ''}${entry.adversary ? ` · Adversary ${entry.adversary}` : ''}`;
      const card = el('div', { class: 'result' }, [
        el('div', { class: 'result-head' }, [
          el('span', { class: 'result-title', text: entry.name }),
          el('span', { class: 'cite', text: `${entry.kind} · ${entry.cite}` })
        ]),
        el('div', { class: 'result-body', text: entry.hook }),
        el('div', { class: 'result-body', text: stats }),
        (entry.abilities || []).length
          ? el('div', { class: 'small muted', text: `Abilities: ${entry.abilities.map((a) => (adversaryAbility(a) || { name: a }).name).join(', ')}` })
          : null,
        entry.kind === 'rival' && isVeryChallenging(entry) ? el('span', { class: 'badge badge-inferred', text: 'very challenging' }) : null,
        entry.heatHook ? el('span', { class: 'badge', text: 'Heat hook' }) : null,
        entry.abstract ? null : el('button', {
          type: 'button', class: 'secondary', text: 'Drop into combat',
          onclick: () => { const r = addFromBestiary(entry.id); showToast(r.ok ? `${entry.name} added to the tracker` : r.reason); }
        })
      ]);
      list.append(card);
    });
  }
  drawList();

  // --- encounter blocks (B§6) ---
  const blocks = el('div', { class: 'card' }, [
    el('h2', { text: 'Encounter blocks' }),
    el('p', { class: 'small muted', text: 'Resolution templates rather than creatures: each names the opposed skills, the opposition pool and the Heat consequence (B§6).' })
  ]);
  ENCOUNTER_BLOCKS.forEach((block) => {
    const dice = block.resolution.oppositionDice || block.resolution.oppositionDiceStart;
    const card = el('div', { class: 'result' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: block.name }),
        el('span', { class: 'cite', text: block.cite })
      ]),
      el('div', { class: 'result-body', text: block.hook }),
      el('div', { class: 'result-body', text: `${block.resolution.activeSkills.map(titleCase).join(' or ')} against ${titleCase(block.resolution.opposingSkill)}${dice ? `, ${Array.isArray(dice) ? dice.join('–') : dice} opposition dice` : ''}. ${block.consequence}` })
    ]);
    if (block.extended) {
      card.append(el('button', {
        type: 'button', class: 'secondary', text: 'Start the dragnet tracker',
        onclick: () => { createTask({ name: block.name, kind: 'dragnet', target: 4 }); showToast('Dragnet started on the progress tracker (B§6)'); }
      }));
    }
    blocks.append(card);
  });
  mount.append(blocks);

  // --- rollable reference tables (§3.21) ---
  const tables = el('div', { class: 'card' }, [el('h2', { text: 'Rollable tables' })]);
  tables.append(el('button', {
    type: 'button', class: 'secondary', text: 'Random encounter (B§7)',
    onclick: () => {
      const roll = rollDie(10); // R-10
      const row = RANDOM_ENCOUNTERS.table.find((r) => r.roll === roll);
      const cellNow = getCell();
      const extra = roll === 10 && cellNow.cellHeat >= 4 ? ' Cell Heat is 4 or more — escalate toward a nemesis (B§7).' : '';
      modal({ title: `Random encounter — ${roll}`, body: `${row.entry}.${extra}`, actions: [{ label: 'Close', primary: true }] });
    }
  }));
  tables.append(el('button', {
    type: 'button', class: 'secondary', text: 'Critical Injury (§9)',
    onclick: () => {
      const roll = rollDie(100);
      const row = CRITICAL_INJURIES.find((r) => roll >= r.min && roll <= r.max);
      modal({ title: `Critical Injury — ${roll}`, body: `${row.name} (${row.severity}): ${row.effect}`, actions: [{ label: 'Close', primary: true }] });
    }
  }));
  tables.append(el('button', {
    type: 'button', class: 'secondary', text: 'NPC quick-gen (§20)',
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

  // --- NPC builder from the §12C recipes ---
  const builder = el('div', { class: 'card' }, [
    el('h2', { text: 'NPC builder' }),
    el('p', { class: 'small muted', text: 'NPCs built from the §12C recipes do derive their stats, and are stored as recipe-built so they stay distinguishable from printed blocks (R-15).' })
  ]);
  ADVERSARY_TIERS.forEach((tier) => {
    builder.append(el('div', { class: 'result' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: tier.name }),
        el('span', { class: 'cite', text: tier.cite })
      ]),
      el('div', { class: 'result-body', text: tier.summary }),
      el('ul', { class: 'small muted' }, tier.rules.map((r) => el('li', { text: r }))),
      el('p', { class: 'small', text: tier.threatGuide || '' })
    ]));
  });
  builder.append(el('p', { class: 'small', text: `${ADVERSARY_TALENT.name}: ${ADVERSARY_TALENT.summary}` }));
  const abilityList = el('div');
  ADVERSARY_ABILITIES.forEach((ability) => {
    abilityList.append(el('div', { class: 'result' }, [
      el('div', { class: 'result-head' }, [
        el('span', { class: 'result-title', text: ability.name }),
        el('span', { class: 'cite', text: ability.cite })
      ]),
      el('div', { class: 'result-body', text: ability.summary })
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
    el('p', { class: 'small muted', text: 'A PC who fails a Deception or Cool check against a group with this ability takes a Personal Heat check automatically (B§2, §17.1).' }),
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

  // --- encounter sizing ---
  const sizing = el('div', { class: 'card' }, [el('h2', { text: 'Encounter sizing (§20B)' })]);
  const sizingTable = el('table');
  sizingTable.append(el('tr', {}, [el('th', { text: 'Setup' }), el('th', { text: 'Difficulty' })]));
  ENCOUNTER_SIZING.table.forEach((row) => sizingTable.append(el('tr', {}, [el('td', { text: row.setup }), el('td', { text: row.difficulty })])));
  sizing.append(el('div', { class: 'table-wrap' }, [sizingTable]));
  sizing.append(el('p', { class: 'small muted', text: ENCOUNTER_SIZING.adventureSizing }));
  mount.append(sizing);

  // --- quick reference ---
  const quick = el('div', { class: 'card' }, [el('h2', { text: 'Quick reference (§30)' })]);
  QUICK_REFERENCE.sections.forEach((section) => {
    quick.append(el('div', { class: 'result' }, [
      el('div', { class: 'result-head' }, [el('span', { class: 'result-title', text: section.title })]),
      el('div', { class: 'result-body', text: section.body })
    ]));
  });
  mount.append(quick);
}
