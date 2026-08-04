// router.js — hash routing, bottom navigation, and conditional tab gating.

import { $, el, clear } from './core.js';
import { Settings } from './settings.js';
import { activeCharacterId } from './store.js';
import { renderHome, renderRules, renderSettings } from './screens.js';
import { renderWizard } from './wizard.js';
import { renderSheet, renderResourceHeader } from './sheet.js';
import { renderRoller } from './roller.js';

const ROUTES = [
  { id: 'home',     path: '#/',         label: 'Home',     glyph: '▣', render: renderHome },
  { id: 'sheet',    path: '#/sheet',    label: 'Sheet',    glyph: '☰', render: renderSheet },
  { id: 'roll',     path: '#/roll',     label: 'Roll',     glyph: '⚄', render: renderRoller },
  { id: 'create',   path: '#/create',   label: 'Create',   glyph: '✎', render: renderWizard, hideInNav: () => !!activeCharacterId() },
  { id: 'rules',    path: '#/rules',    label: 'Rules',    glyph: '§', render: renderRules },
  { id: 'solo',     path: '#/solo',     label: 'Solo',     glyph: '◇', render: placeholder('Solo mode', 'Oracle, random events and the meaning and element tables arrive in Phase 6 (§18–§20, §23).'), gate: () => Settings.soloMode() },
  { id: 'gm',       path: '#/gm',       label: 'GM',       glyph: '◈', render: placeholder('GM screen', 'Party panel, bestiary browser and the rollable reference tables arrive in Phase 6 (§3.21, B§6–B§7).'), gate: () => Settings.gmScreen() },
  { id: 'settings', path: '#/settings', label: 'Settings', glyph: '⚙', render: renderSettings }
];

function placeholder(title, body) {
  return (mount) => {
    clear(mount);
    mount.append(el('div', { class: 'card' }, [el('h2', { text: title }), el('p', { class: 'muted', text: body })]));
  };
}

export function visibleRoutes() {
  return ROUTES.filter((r) => (!r.gate || r.gate()) && !(r.hideInNav && r.hideInNav()));
}

/** Routes reachable by hash, including ones the nav hides (the wizard once a PC exists). */
export function routableRoutes() {
  return ROUTES.filter((r) => !r.gate || r.gate());
}

export function currentRoute() {
  const hash = location.hash || '#/';
  return routableRoutes().find((r) => r.path === hash) || ROUTES[0];
}

export function renderNav() {
  const nav = $('#bottom-nav');
  if (!nav) return;
  clear(nav);
  const active = currentRoute();
  visibleRoutes().forEach((route) => {
    nav.append(el('a', {
      href: route.path,
      'aria-current': route.id === active.id ? 'page' : null
    }, [
      el('span', { class: 'nav-glyph', 'aria-hidden': 'true', text: route.glyph }),
      el('span', { text: route.label })
    ]));
  });
}

export function renderScreen() {
  const mount = $('#screen');
  if (!mount) return;
  const route = currentRoute();
  route.render(mount);
  renderResourceHeader();
  renderNav();
  mount.focus({ preventScroll: true });
  document.title = route.id === 'home' ? "REICH '62 Player" : `${route.label} — REICH '62 Player`;
}

export function startRouter() {
  window.addEventListener('hashchange', renderScreen);
  document.addEventListener('nav:refresh', () => { renderNav(); });
  document.addEventListener('resource:refresh', () => { renderResourceHeader(); });
  document.addEventListener('store:changed', () => { renderResourceHeader(); renderNav(); });
  if (!location.hash) location.hash = '#/';
  renderScreen();
}
