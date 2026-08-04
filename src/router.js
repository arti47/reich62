// router.js — hash routing, bottom navigation, and conditional tab gating.

import { $, el, clear } from './core.js';
import { Settings } from './settings.js';
import { renderHome, renderRules, renderSettings } from './screens.js';

const ROUTES = [
  { id: 'home',     path: '#/',         label: 'Home',     glyph: '▣', render: renderHome },
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
  return ROUTES.filter((r) => !r.gate || r.gate());
}

export function currentRoute() {
  const hash = location.hash || '#/';
  return visibleRoutes().find((r) => r.path === hash) || ROUTES[0];
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
  renderNav();
  mount.focus({ preventScroll: true });
  document.title = route.id === 'home' ? "REICH '62 Player" : `${route.label} — REICH '62 Player`;
}

export function startRouter() {
  window.addEventListener('hashchange', renderScreen);
  document.addEventListener('nav:refresh', () => { renderNav(); });
  if (!location.hash) location.hash = '#/';
  renderScreen();
}
