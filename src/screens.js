// screens.js — top-level screen renderers: home, the rules library, settings and about.

import { el, clear, $ } from './core.js';
import { Settings, FLAGS, theme, cycleTheme } from './settings.js';
import { modal, showToast, confirmModal } from './ui.js';
import { listCharacters, activeCharacter, getCell, exportAll, importAll } from './store.js';
import { buildIndex, search } from './rules-index.js';
import { BASE_WOUND_THRESHOLD, BASE_STRAIN_THRESHOLD, CREATION_RULES, DIE_FACES } from '../data.js';

export function renderHome(mount) {
  clear(mount);
  const character = activeCharacter();
  const cell = getCell();
  const characters = listCharacters();

  mount.append(el('div', { class: 'card' }, [
    el('h2', { text: 'Dossier' }),
    el('p', { class: 'muted small', text: 'A player-character companion for REICH \'62: creation, in-play tracking, the narrative dice engine, and the Heat system.' }),
    el('p', { class: 'small' }, [
      el('span', { class: 'badge badge-inferred', text: 'R-B1' }),
      ' ',
      DIE_FACES === null
        ? 'The manual never prints die face distributions, so the roller takes entered symbols: roll physical dice, tap what came up, and the app resolves everything else.'
        : 'Face data supplied — the simulated roller can be enabled in Settings.'
    ])
  ]));

  mount.append(el('div', { class: 'card' }, [
    el('h2', { text: 'Characters' }),
    characters.length
      ? el('ul', {}, characters.map((c) => el('li', { text: `${c.identity.name || 'Unnamed'} — ${c.identity.career || 'no career'}` })))
      : el('p', { class: 'muted', text: 'No characters yet. The creation wizard arrives in Phase 1.' }),
    character ? el('p', { class: 'small muted', text: `Active: ${character.identity.name || 'Unnamed'}` }) : null
  ]));

  mount.append(el('div', { class: 'card' }, [
    el('h2', { text: 'Cell' }),
    el('div', { class: 'stat-grid' }, [
      stat('Cell Heat', `${cell.cellHeat} / 5`),
      stat('Safehouse', cell.safehouseStatus),
      stat('Story Points (players)', cell.pools.storyPointsPlayer),
      stat('Story Points (GM)', cell.pools.storyPointsGM)
    ]),
    el('p', { class: 'small muted', text: 'Cell Heat is shared across the whole network (§17.2). The GM pool starts empty and fills only from player spends (R-4).' })
  ]));

  mount.append(el('div', { class: 'card' }, [
    el('h2', { text: 'Derived-stat bases' }),
    el('p', { class: 'small' }, [
      el('span', { class: 'badge badge-inferred', text: 'inferred' }), ' ',
      `Wound Threshold ${BASE_WOUND_THRESHOLD} + Brawn, Strain Threshold ${BASE_STRAIN_THRESHOLD} + Willpower. `,
      'The manual never prints the human archetype base (§6); these are ruling R-1, taken from the pregens that agree.'
    ])
  ]));
}

function stat(label, value) {
  return el('div', { class: 'stat' }, [
    el('span', { class: 'stat-label', text: label }),
    el('span', { class: 'stat-value', text: String(value) })
  ]);
}

let index = null;

export function renderRules(mount) {
  clear(mount);
  if (!index) index = buildIndex();

  const results = el('div', { class: 'card', id: 'rules-results' });
  const input = el('input', {
    type: 'search',
    id: 'rules-search',
    placeholder: 'Search rules, tables, talents, gear, adversaries, §17.3, B§6…',
    'aria-label': 'Search the rules library'
  });

  const draw = (query) => {
    clear(results);
    const hits = search(index, query);
    results.append(el('p', { class: 'small muted', text: `${hits.length} of ${index.length} entries` }));
    hits.slice(0, 80).forEach((entry) => {
      results.append(el('div', { class: 'result' }, [
        el('div', { class: 'result-head' }, [
          el('span', { class: 'result-title', text: entry.title }),
          el('span', { class: 'cite', text: entry.cite || '' })
        ]),
        el('div', { class: 'result-body', text: entry.body }),
        entry.badge ? el('span', { class: `badge ${entry.badgeClass || ''}`, text: entry.badge }) : null
      ]));
    });
    if (hits.length > 80) results.append(el('p', { class: 'small muted', text: 'Refine the search to see more.' }));
  };

  input.addEventListener('input', () => draw(input.value));

  mount.append(el('div', { class: 'card search-row' }, [
    el('h2', { text: 'Rules library' }),
    input,
    el('p', { class: 'small muted', text: 'Every entry is cited: §x is the manual, B§x the bestiary. Search by section number, name or effect.' })
  ]));
  mount.append(results);
  draw('');
}

export function renderSettings(mount) {
  clear(mount);

  const flagCard = el('div', { class: 'card' }, [el('h2', { text: 'Toggles' })]);
  FLAGS.forEach((flag) => {
    const blocked = Settings.isBlocked(flag.id);
    const input = el('input', {
      type: 'checkbox',
      id: `flag-${flag.id}`,
      checked: !!Settings.get(flag.id) && !blocked,
      disabled: blocked,
      onchange: (e) => {
        Settings.set(flag.id, e.target.checked);
        showToast(`${flag.label}: ${e.target.checked ? 'on' : 'off'}`);
        document.dispatchEvent(new CustomEvent('nav:refresh'));
      }
    });
    flagCard.append(el('div', { class: 'toggle-row' }, [
      input,
      el('label', { for: `flag-${flag.id}` }, [
        el('span', { text: flag.label }),
        blocked ? el('span', { class: 'badge badge-inferred', text: 'blocked' }) : null,
        el('span', { class: 'toggle-desc', text: flag.desc })
      ])
    ]));
  });
  mount.append(flagCard);

  const budget = el('input', {
    type: 'number', min: '0', value: String(Settings.startingBudget()), id: 'starting-budget',
    onchange: (e) => { Settings.set('startingBudget', Number(e.target.value)); showToast('Starting budget saved'); }
  });
  const currency = el('input', {
    type: 'text', value: Settings.currencyLabel(), id: 'currency-label',
    onchange: (e) => { Settings.set('currencyLabel', e.target.value.trim() || 'credits'); showToast('Currency label saved'); }
  });
  mount.append(el('div', { class: 'card' }, [
    el('h2', {}, ['House aids ', el('span', { class: 'badge badge-house', text: 'not a printed rule' })]),
    el('p', { class: 'small muted', text: `The manual states neither a currency name nor a starting budget (${CREATION_RULES.houseAid.ruling}). Both are yours to set.` }),
    el('label', { for: 'currency-label', class: 'small', text: 'Currency label' }), currency,
    el('label', { for: 'starting-budget', class: 'small', text: 'Starting gear budget' }), budget
  ]));

  mount.append(el('div', { class: 'card' }, [
    el('h2', { text: 'Theme' }),
    el('p', { class: 'small muted', text: `Currently: ${theme()}. The default follows the system setting.` }),
    el('button', { type: 'button', class: 'secondary', text: 'Cycle theme', onclick: () => { cycleTheme(); renderSettings(mount); } })
  ]));

  mount.append(el('div', { class: 'card' }, [
    el('h2', { text: 'Backup' }),
    el('p', { class: 'small muted', text: 'Everything is stored on this device. Export before clearing browser data.' }),
    el('button', {
      type: 'button', class: 'secondary', text: 'Export JSON',
      onclick: () => {
        const blob = new Blob([exportAll()], { type: 'application/json' });
        const a = el('a', { href: URL.createObjectURL(blob), download: 'reich62-backup.json' });
        document.body.append(a); a.click(); a.remove();
        showToast('Backup exported');
      }
    }),
    ' ',
    el('button', {
      type: 'button', class: 'secondary', text: 'Import JSON',
      onclick: async () => {
        const input = el('input', { type: 'file', accept: 'application/json' });
        input.addEventListener('change', async () => {
          const file = input.files && input.files[0];
          if (!file) return;
          if (!(await confirmModal('Importing replaces every character and the Cell on this device. Continue?', { title: 'Import backup' }))) return;
          try {
            const result = importAll(await file.text());
            showToast(`Imported ${result.characters} character(s)`);
          } catch (err) {
            modal({ title: 'Import failed', body: String(err.message || err), actions: [{ label: 'Close', primary: true }] });
          }
        });
        input.click();
      }
    })
  ]));

  mount.append(el('div', { class: 'card' }, [
    el('h2', { text: 'About' }),
    el('p', { class: 'small', text: 'A personal play aid built from the owner\'s own books. Mechanics and numbers are extracted; all effect text is paraphrased. No setting prose, art or insignia.' }),
    el('p', { class: 'small muted', text: 'Sources: the REICH \'62 manual (§) and the Bestiary & Adversary Compendium (B§).' })
  ]));
}
