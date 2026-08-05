// router.js — hash routing, bottom navigation, and conditional tab gating.

import { $, el, clear } from './core.js';
import { Settings } from './settings.js';
import { MODES, SCREEN_BLURBS } from './help.js';
import { modal } from './ui.js';
import { activeCharacterId } from './store.js';
import { renderHome, renderRules, renderSettings, renderSafety } from './screens.js';
import { renderWizard } from './wizard.js';
import { renderSheet, renderResourceHeader, resetSheetTab } from './sheet.js';
import { renderRoller } from './roller.js';
import { renderCombat } from './combat.js';
import { renderGm, resetGmTab } from './gm.js';
import { renderSolo } from './solo.js';

const ROUTES = [
  { id: 'home',     path: '#/',         label: 'Home',     glyph: '▣', render: renderHome },
  { id: 'sheet',    path: '#/sheet',    label: 'Sheet',    glyph: '☰', render: renderSheet },
  { id: 'roll',     path: '#/roll',     label: 'Roll',     glyph: '⚄', render: renderRoller },
  { id: 'create',   path: '#/create',   label: 'Create',   glyph: '✎', render: renderWizard, hideInNav: () => !!activeCharacterId() },
  { id: 'combat',   path: '#/combat',   label: 'Combat',   glyph: '⚔', render: renderCombat },
  { id: 'rules',    path: '#/rules',    label: 'Rules',    glyph: '§', render: renderRules },
  { id: 'solo',     path: '#/solo',     label: 'Solo',     glyph: '◇', render: renderSolo, gate: () => Settings.soloMode() || Settings.mode() === 'solo' },
  { id: 'gm',       path: '#/gm',       label: 'GM',       glyph: '◈', render: renderGm, gate: () => Settings.gmScreen() || Settings.mode() === 'gm' },
  { id: 'settings', path: '#/settings', label: 'Settings', glyph: '⚙', render: renderSettings },
  { id: 'safety',   path: '#/safety',   label: 'Safety',   glyph: '⚑', render: renderSafety, hideInNav: () => true }
];

function placeholder(title, body) {
  return (mount) => {
    clear(mount);
    mount.append(el('div', { class: 'card' }, [el('h2', { text: title }), el('p', { class: 'muted', text: body })]));
  };
}

/** Tabs shown for the current seat (help.js MODES), so the bar never fills with slivers. */
export function visibleRoutes() {
  const mode = MODES.find((m) => m.id === Settings.mode()) || MODES[0];
  return ROUTES.filter((r) => {
    if (r.hideInNav && r.hideInNav()) return false;
    if (r.gate && !r.gate()) return false;
    if (!mode.tabs) return true;
    return mode.tabs.includes(r.id);
  });
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

/** Everything reachable, whether or not it has a tab in this seat. */
export function openScreenMenu() {
  const body = el('div', {});
  routableRoutes().forEach((route) => {
    body.append(el('a', {
      class: 'menu-item', href: route.path,
      onclick: () => { setTimeout(() => document.querySelector('.modal-backdrop')?.remove(), 0); }
    }, [
      el('span', { class: 'menu-title', text: `${route.glyph} ${route.label}` }),
      el('span', { class: 'toggle-desc', text: SCREEN_BLURBS[route.id] || '' })
    ]));
  });
  modal({ title: 'All screens', body, actions: [{ label: 'Close', primary: true }] });
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
  // Arriving at a screen from elsewhere opens it at its first sub-tab rather than wherever
  // it happened to be left (B-6).
  window.addEventListener('hashchange', () => { resetSheetTab(); resetGmTab(); });
  window.addEventListener('hashchange', renderScreen);
  document.addEventListener('nav:refresh', () => { renderNav(); });
  document.addEventListener('resource:refresh', () => { renderResourceHeader(); });
  document.addEventListener('store:changed', () => { renderResourceHeader(); renderNav(); });
  if (!location.hash) location.hash = '#/';
  renderScreen();
}
