// screens.js — top-level screen renderers: home, the rules library, settings and about.

import { el, clear, $ } from './core.js';
import { Settings, FLAGS, theme, cycleTheme } from './settings.js';
import { modal, showToast, confirmModal, panel, subTabs, emptyState } from './ui.js';
import { PANELS, MODES, TERMS, label as termLabel } from './help.js';
import {
  listCharacters, activeCharacter, getCell, exportAll, importAll, describeBackup,
  setActiveCharacter, deleteCharacter
} from './store.js';
import { buildIndex, search, SECTIONS } from './rules-index.js';
import { BASE_WOUND_THRESHOLD, BASE_STRAIN_THRESHOLD, CREATION_RULES, DIE_FACES } from '../data.js';

export function renderHome(mount) {
  clear(mount);
  const character = activeCharacter();
  const cell = getCell();
  const characters = listCharacters();

  // --- start here: numbered next steps, ticking off as they are done ---
  const steps = [
    { id: 'mode', label: 'Pick the seat you play in', done: Settings.modeChosen(), href: '#/settings', hint: `Currently: ${(MODES.find((m) => m.id === Settings.mode()) || MODES[0]).name}` },
    { id: 'character', label: 'Create a character, or load one of the three ready-made ones', done: characters.length > 0, href: '#/create', hint: 'Takes about five minutes; the app checks every rule as you go.' },
    { id: 'roll', label: 'Try a check on the Roll screen', done: readLogLength() > 0, href: '#/roll', hint: 'Roll your dice, tap what came up, and the app does the rest.' },
    { id: 'cell', label: 'Name your network', done: !!cell.name, href: '#/gm', hint: 'Optional. Shared suspicion and story points live here.' }
  ];
  const remaining = steps.filter((s2) => !s2.done).length;
  const list = el('ol', { class: 'checklist' });
  steps.forEach((step, index) => {
    list.append(el('li', {}, [
      el('span', { class: 'tick', 'aria-hidden': 'true', text: step.done ? '✓' : `${index + 1}.` }),
      el('span', { class: step.done ? 'done' : '' }, [
        el('a', { href: step.href, text: step.label }),
        el('span', { class: 'toggle-desc', text: step.hint })
      ])
    ]));
  });
  mount.append(panel(remaining ? 'Start here' : 'Set up', PANELS.homeChecklist, [
    list,
    remaining === 0 ? el('p', { class: 'small muted', text: 'All set. This list stays here if you want to change anything.' }) : null
  ]));

  // --- characters ---
  const charBody = [];
  if (characters.length) {
    characters.forEach((c) => {
      const isActive = character && character.id === c.id;
      charBody.push(el('div', { class: 'result' }, [
        el('div', { class: 'result-head' }, [
          el('span', { class: 'result-title', text: c.identity.name || 'Unnamed' }),
          el('span', { class: 'cite', text: isActive ? 'active' : '' })
        ]),
        el('div', { class: 'result-body', text: `${titleCaseCareer(c.identity.career)} · ${c.xp.available} experience unspent` }),
        // The controls share a row of their own so the link and the button cannot collide.
        el('div', { class: 'result-actions' }, [
        isActive
          ? el('a', { class: 'small', href: '#/sheet', text: 'Open the sheet' })
          : el('button', {
              type: 'button', class: 'secondary', text: 'Make active',
              onclick: () => { setActiveCharacter(c.id); renderHome(mount); }
            }),
        // Deleting a character cannot be undone, so it confirms by name first.
        el('button', {
          type: 'button', class: 'secondary danger', text: 'Delete',
          'aria-label': `Delete ${c.identity.name || 'Unnamed'}`,
          onclick: async () => {
            const name = c.identity.name || 'this character';
            const ok = await confirmModal(
              `Delete ${name}? Their sheet, gear, injuries and experience go with them. This cannot be undone — export a backup from Settings first if you want to keep them.`,
              { title: 'Delete character', confirmLabel: 'Delete' });
            if (!ok) return;
            deleteCharacter(c.id);
            showToast(`${name} deleted`);
            renderHome(mount);
          }
        })
        ])
      ]));
    });
  } else {
    charBody.push(emptyState('No characters yet.', { href: '#/create', label: 'Create one now' }));
  }
  mount.append(panel('Characters', PANELS.homeCharacters, charBody));

  // --- the cell ---
  mount.append(panel(termLabel('cell'), PANELS.homeCell, [
    el('div', { class: 'stat-grid' }, [
      stat(termLabel('cellHeat'), `${cell.cellHeat} / 5`),
      stat('Safehouse', cell.safehouseStatus),
      stat('Story points, players', cell.pools.storyPointsPlayer),
      stat('Story points, GM', cell.pools.storyPointsGM)
    ]),
    el('p', { class: 'small muted', text: cell.name ? `Network: ${cell.name}` : 'Unnamed network — name it on the GM screen.' })
  ]));
}

function titleCaseCareer(id) {
  if (!id) return 'no career';
  return String(id).replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

function readLogLength() {
  try { return JSON.parse(localStorage.getItem('reich62:rollLog') || '[]').length; } catch { return 0; }
}

function stat(label, value) {
  return el('div', { class: 'stat' }, [
    el('span', { class: 'stat-label', text: label }),
    el('span', { class: 'stat-value', text: String(value) })
  ]);
}

let index = null;

const RULE_GROUPS = [
  { id: 'all',      label: 'All',        match: () => true },
  { id: 'dice',     label: 'Dice',       match: (e) => /^§1|^§2|^§3/.test(e.cite || '') },
  { id: 'combat',   label: 'Combat',     match: (e) => /^§5/.test(e.cite || '') },
  { id: 'character', label: 'Character',  match: (e) => /^§4|^§6|^§7|^§12A|^§12B|^§13|^§14$/.test(e.cite || '') },
  { id: 'gear',     label: 'Gear',       match: (e) => /^§10|^§14|^§15/.test(e.cite || '') },
  { id: 'heat',     label: 'Suspicion',  match: (e) => /^§17/.test(e.cite || '') },
  { id: 'foes',     label: 'Opponents',  match: (e) => /^§12C|^§12D|^§20|^B§/.test(e.cite || '') }
];
let ruleGroup = 'all';

export function renderRules(mount, params = {}) {
  clear(mount);
  if (!index) index = buildIndex();
  const initialQuery = params.q || '';
  if (initialQuery) ruleGroup = 'all';

  const results = el('div', { class: 'card', id: 'rules-results' });
  const input = el('input', {
    type: 'search',
    id: 'rules-search',
    value: initialQuery,
    placeholder: 'Search rules, tables, talents, gear, adversaries, §17.3, B§6…',
    'aria-label': 'Search the rules library'
  });

  const PAGE = 40;
  let shown = PAGE;
  const draw = (query) => {
    clear(results);
    const group = RULE_GROUPS.find((g) => g.id === ruleGroup) || RULE_GROUPS[0];
    const hits = search(index, query).filter(group.match);
    results.append(el('p', { class: 'small muted', text: `${hits.length} of ${index.length} entries` }));

    if (!hits.length) {
      results.append(el('p', { class: 'muted', text: 'Nothing matches. Try a shorter word, or a section number such as §17.' }));
      return;
    }

    // Grouped by the part of the books they come from, so the list reads as a contents
    // page rather than 547 rows in a run.
    let rendered = 0;
    let opened = 0;
    SECTIONS.forEach((section) => {
      const inSection = hits.filter((e) => e.section === section.id);
      if (!inSection.length) return;
      if (rendered >= shown) return;
      const slice = inSection.slice(0, Math.max(0, shown - rendered));
      rendered += slice.length;

      const body = el('div', {});
      slice.forEach((item) => {
        body.append(el('article', { class: 'rule-entry' }, [
          el('h3', { text: item.title }),
          el('p', { text: item.body }),
          item.note ? el('p', { class: 'small muted', text: item.note }) : null
        ]));
      });

      // The first group is open so the screen never looks empty; the rest wait for a tap.
      const open = !!query || opened === 0;
      opened += 1;
      results.append(el('details', { class: 'accordion rule-section', open }, [
        el('summary', {}, [
          el('span', { class: 'accordion-title', text: section.label }),
          el('span', { class: 'accordion-summary', text: `${inSection.length}` })
        ]),
        body
      ]));
    });

    if (hits.length > shown) {
      results.append(el('button', {
        type: 'button', class: 'secondary', id: 'rules-more',
        text: `Show ${Math.min(PAGE, hits.length - shown)} more of ${hits.length - shown}`,
        onclick: () => { shown += PAGE; draw(input.value); }
      }));
    }
  };

  input.addEventListener('input', () => { shown = PAGE; draw(input.value); });

  mount.append(panel('Rules library', {
    lede: 'Look up any rule the app uses. Search by name, by what it does, or by section number.',
    detail: 'Entries are grouped by the part of the books they come from. Searching for a section number works too, if you know it.'
  }, [
    subTabs(RULE_GROUPS, ruleGroup, (id) => { ruleGroup = id; renderRules(mount, params); }),
    input
  ]));
  mount.append(results);
  draw(initialQuery);
}

/** Safety tools, paraphrased from §20A. One screen, linked from Settings. */
export function renderSafety(mount) {
  clear(mount);
  mount.append(el('div', { class: 'card' }, [
    el('h2', { text: 'Session zero and safety tools' }),
    el('p', { class: 'small muted', text: 'A summary of the rulebook\'s own guidance, not setting or adventure content.' }),
    el('h3', { text: 'Before the first session' }),
    el('ul', { class: 'small' }, [
      el('li', { text: 'Agree as a group on content boundaries. This setting has a real-world atrocity backdrop, so decide explicitly how far depictions of violence go.' }),
      el('li', { text: 'Give everyone a private way to flag a topic as off-limits or as "warn me first".' }),
      el('li', { text: 'Name the real-world-sensitive themes — genocide, persecution, collaboration — the group wants softened, spotlighted, or left out entirely.' }),
      el('li', { text: 'Settle table logistics: breaks, food, devices.' }),
      el('li', { text: 'Revisit the conversation whenever the campaign\'s tone shifts.' })
    ]),
    el('h3', { text: 'Rule zero' }),
    el('p', { class: 'small', text: 'The GM may override, skip or reinterpret any rule — including everything this app automates — when it serves the table better. Use it sparingly and say so out loud rather than reinterpreting silently, so trust in the system holds.' }),
    el('p', { class: 'small muted', text: 'Revisit this conversation whenever the campaign\'s tone shifts.' })
  ]));
}

export function renderSettings(mount) {
  clear(mount);

  // --- seat mode: the single biggest lever on how much interface you see ---
  const modeBody = [];
  MODES.forEach((mode) => {
    modeBody.push(el('div', { class: 'toggle-row' }, [
      el('input', {
        type: 'radio', name: 'mode', id: `mode-${mode.id}`, checked: Settings.mode() === mode.id,
        onchange: () => {
          Settings.setMode(mode.id);
          showToast(`${mode.name} mode — the tabs now match`);
          document.dispatchEvent(new CustomEvent('nav:refresh'));
          renderSettings(mount);
        }
      }),
      el('label', { for: `mode-${mode.id}` }, [
        el('span', { text: mode.name }),
        el('span', { class: 'toggle-desc', text: `${mode.desc}${mode.tabs ? ` Tabs: ${mode.tabs.join(', ')}.` : ''}` })
      ])
    ]));
  });
  mount.append(panel('Your seat', PANELS.settingsMode, modeBody));

  const flagCard = panel('Options', {
    lede: 'Extra screens and behaviour. Everything here is off until you turn it on.',
    detail: 'Turning a screen on adds its tab; turning it off only hides it, and nothing you have entered is lost.'
  }, []);
  FLAGS.forEach((flag) => {
    const blocked = Settings.isBlocked(flag.id);
    const input = el('input', {
      type: 'checkbox',
      id: `flag-${flag.id}`,
      // A flag that ships on stays on until it is explicitly turned off.
      checked: (Settings.get(flag.id) ?? !!flag.defaultOn) && !blocked,
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
        el('span', { class: 'toggle-desc', text: blocked ? `Unavailable. ${flag.desc}` : flag.desc }),
        flag.note ? el('span', { class: 'toggle-desc muted', text: flag.note() }) : null
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
    onchange: (e) => { Settings.set('currencyLabel', e.target.value.trim() || CREATION_RULES.houseAid.currencyLabel); showToast('Currency label saved'); }
  });
  mount.append(panel('House aids', PANELS.settingsHouse, [
    el('p', { class: 'small muted', text: 'Neither number is printed in the books, so both are yours to set.' }),
    el('label', { for: 'currency-label', class: 'small', text: 'What money is called' }), currency,
    el('label', { for: 'starting-budget', class: 'small', text: 'Money a new character starts with' }), budget
  ]));

  mount.append(panel('Appearance', {
    lede: 'Light or dark. By default the app follows your device.',
    detail: 'The dark theme is the one the app is designed around; the light theme is the same palette inverted for bright rooms.'
  }, [
    el('p', { class: 'small muted', text: `Currently: ${theme()}.` }),
    el('button', { type: 'button', class: 'secondary', text: 'Switch: system → dark → light', onclick: () => { cycleTheme(); renderSettings(mount); } })
  ]));

  mount.append(panel('Backup', {
    lede: 'Everything lives on this device only. Export a copy before clearing your browser data.',
    detail: 'The export is a single JSON file holding every character, your network, your settings, the roll log, any running encounter and any open progress tasks. Importing one tells you what is in the file and what it will displace before it writes anything, and offers to merge rather than replace.'
  }, [
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
      type: 'button', class: 'secondary', id: 'import-backup', text: 'Import JSON',
      onclick: async () => {
        const input = el('input', { type: 'file', accept: 'application/json' });
        input.addEventListener('change', async () => {
          const file = input.files && input.files[0];
          if (!file) return;
          let text;
          let summary;
          try {
            text = await file.text();
            summary = describeBackup(text);
          } catch (err) {
            modal({ title: 'Import failed', body: String(err.message || err), actions: [{ label: 'Close', primary: true }] });
            return;
          }
          // What is in the file and what it will displace, before anything is written.
          const { incoming, current } = summary;
          const body = el('div', { id: 'import-summary' }, [
            el('h3', { text: 'This file holds' }),
            el('ul', { class: 'small' }, [
              el('li', { text: incoming.characters.length ? `${incoming.characters.length} character(s): ${incoming.characters.join(', ')}` : 'no characters' }),
              incoming.cell ? el('li', { text: `the network "${incoming.cell}", suspicion ${incoming.cellHeat}` }) : null,
              el('li', { text: `${incoming.rollLog} logged check(s)` }),
              incoming.combatRound ? el('li', { text: `a running encounter, round ${incoming.combatRound}` }) : null,
              el('li', { text: `${incoming.tasks} progress task(s)` })
            ].filter(Boolean)),
            el('h3', { text: 'On this device now' }),
            el('ul', { class: 'small' }, [
              el('li', { text: current.characters.length ? `${current.characters.length} character(s): ${current.characters.join(', ')}` : 'no characters' }),
              el('li', { text: `${current.rollLog} logged check(s), ${current.tasks} progress task(s)` })
            ]),
            el('p', { class: 'small', text: 'Replacing discards everything above. Merging keeps your characters and adds the file\'s alongside them, leaving the log, the encounter and the network as they are.' })
          ]);
          const m = modal({
            title: 'Import a backup',
            body,
            actions: [
              { label: 'Cancel', value: null },
              { label: 'Merge', value: 'merge' },
              { label: 'Replace everything', value: 'replace', primary: true }
            ]
          });
          m.onClose((mode) => {
            if (!mode) return;
            try {
              const result = importAll(text, { mode });
              showToast(mode === 'merge' ? `Merged in ${result.characters} character(s)` : `Replaced everything with ${result.characters} character(s)`);
            } catch (err) {
              modal({ title: 'Import failed', body: String(err.message || err), actions: [{ label: 'Close', primary: true }] });
            }
          });
        });
        input.click();
      }
    })
  ]));

  mount.append(panel('Safety tools', {
    lede: 'The conversation worth having before the first session, and the GM\'s right to overrule anything.',
    detail: 'This setting has a real-world atrocity backdrop. The book asks groups to agree boundaries up front and gives everyone a private way to flag a topic.'
  }, [el('a', { href: '#/safety', class: 'small', text: 'Open the safety-tools note' })]));

  mount.append(el('div', { class: 'card' }, [
    el('h2', { text: 'About' }),
    el('p', { class: 'small', text: 'A personal play aid built from the owner\'s own books. Mechanics and numbers are extracted; all effect text is paraphrased. No setting prose, art or insignia.' }),
    el('p', { class: 'small muted', text: 'Sources: the REICH \'62 manual and the Bestiary & Adversary Compendium.' })
  ]));
}
