// router.js — hash routing, bottom navigation, and conditional tab gating.

import { $, el, clear } from './core.js';
import { Settings } from './settings.js';
import { activeCharacterId } from './store.js';
import { renderHome, renderRules, renderSettings, renderSafety } from './screens.js';
import { renderWizard } from './wizard.js';
import { renderSheet, renderResourceHeader } from './sheet.js';
import { renderRoller } from './roller.js';
import { renderCombat } from './combat.js';
import { renderGm } from './gm.js';
import { renderSolo } from './solo.js';

const ROUTES = [
  { id: 'home',     path: '#/',         label: 'Home',     glyph: '▣', render: renderHome },
  { id: 'sheet',    path: '#/sheet',    label: 'Sheet',    glyph: '☰', render: renderSheet },
  { id: 'roll',     path: '#/roll',     label: 'Roll',     glyph: '⚄', render: renderRoller },
  { id: 'create',   path: '#/create',   label: 'Create',   glyph: '✎', render: renderWizard, hideInNav: () => !!activeCharacterId() },
  { id: 'combat',   path: '#/combat',   label: 'Combat',   glyph: '⚔', render: renderCombat },
  { id: 'rules',    path: '#/rules',    label: 'Rules',    glyph: '§', render: renderRules },
  { id: 'solo',     path: '#/solo',     label: 'Solo',     glyph: '◇', render: renderSolo, gate: () => Settings.soloMode() },
  { id: 'gm',       path: '#/gm',       label: 'GM',       glyph: '◈', render: renderGm, gate: () => Settings.gmScreen() },
  { id: 'settings', path: '#/settings', label: 'Settings', glyph: '⚙', render: renderSettings },
  { id: 'safety',   path: '#/safety',   label: 'Safety',   glyph: '⚑', render: renderSafety, hideInNav: () => true }
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
  const hash = (location.hash || '#/').split('?')[0];
  return routableRoutes().find((r) => r.path === hash) || ROUTES[0];
}

/** Query parameters carried on the hash, e.g. #/rules?q=§17.3 from a citation link. */
export function currentParams() {
  const query = (location.hash || '').split('?')[1];
  if (!query) return {};
  const params = {};
  new URLSearchParams(query).forEach((value, key) => { params[key] = value; });
  return params;
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
  route.render(mount, currentParams());
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
