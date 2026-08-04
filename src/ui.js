// ui.js — themed modals, toasts, confirm and prompt. No native alert/confirm/prompt.

import { $, el, clear } from './core.js';

let lastFocus = null;

export function showToast(message, { timeout = 3200 } = {}) {
  const region = $('#toast-region');
  if (!region) return;
  const node = el('div', { class: 'toast', text: message });
  region.append(node);
  setTimeout(() => node.remove(), timeout);
  return node;
}

export function modal({ title, body, actions = [], dismissable = true }) {
  const root = $('#modal-root');
  lastFocus = document.activeElement;

  const dialog = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog' });
  if (title) dialog.append(el('h2', { text: title }));
  const bodyNode = el('div', { class: 'modal-body' });
  if (typeof body === 'string') bodyNode.append(el('p', { text: body }));
  else if (body) bodyNode.append(body);
  dialog.append(bodyNode);

  const close = (result) => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    if (typeof onClose === 'function') onClose(result);
  };
  let onClose = null;

  const actionRow = el('div', { class: 'modal-actions' });
  actions.forEach((action) => {
    actionRow.append(el('button', {
      type: 'button',
      class: action.primary ? 'primary' : 'secondary',
      text: action.label,
      onclick: () => { const r = action.onSelect ? action.onSelect(dialog) : action.value; close(r); }
    }));
  });
  if (actions.length) dialog.append(actionRow);

  const backdrop = el('div', { class: 'modal-backdrop' }, [dialog]);
  if (dismissable) {
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(undefined); });
  }

  function onKey(e) {
    if (e.key === 'Escape' && dismissable) { e.preventDefault(); close(undefined); return; }
    if (e.key !== 'Tab') return;
    const focusables = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  root.append(backdrop);
  document.addEventListener('keydown', onKey);
  const focusTarget = dialog.querySelector('input, textarea, select, button');
  if (focusTarget) focusTarget.focus(); else dialog.focus();

  return { close, dialog, onClose: (fn) => { onClose = fn; } };
}

export function confirmModal(message, { title = 'Confirm', confirmLabel = 'Confirm', cancelLabel = 'Cancel' } = {}) {
  return new Promise((resolve) => {
    const m = modal({
      title,
      body: message,
      actions: [
        { label: cancelLabel, value: false },
        { label: confirmLabel, value: true, primary: true }
      ]
    });
    m.onClose((result) => resolve(result === true));
  });
}

export function promptModal(message, { title = 'Enter a value', value = '', confirmLabel = 'OK' } = {}) {
  return new Promise((resolve) => {
    const input = el('input', { type: 'text', value, 'aria-label': message });
    const body = el('div', {}, [el('p', { text: message }), input]);
    const m = modal({
      title,
      body,
      actions: [
        { label: 'Cancel', value: null },
        { label: confirmLabel, primary: true, onSelect: () => input.value }
      ]
    });
    m.onClose((result) => resolve(result === undefined ? null : result));
  });
}

/** Dice symbol glyph, colour- and shape-coded (never colour alone — a11y, CLAUDE.md §1.2). */
export function symbolGlyph(symbol, count = 1) {
  const map = {
    success: '🌟', advantage: '🔺', triumph: '☀️',
    failure: '💥', threat: '🔻', despair: '⚡'
  };
  return el('span', {
    class: 'dice-glyph',
    'aria-label': `${count} ${symbol}`,
    text: `${count > 1 ? count : ''}${map[symbol] || '?'}`
  });
}

export function renderTally(tally) {
  const wrap = el('span', {});
  for (const key of ['success', 'advantage', 'triumph', 'failure', 'threat', 'despair']) {
    if (tally[key]) wrap.append(symbolGlyph(key, tally[key]), ' ');
  }
  if (!wrap.childNodes.length) wrap.append(document.createTextNode('—'));
  return wrap;
}

/** A panel that says what it is for, with an expandable "how this works".
 *  `key` looks the copy up in help.js; `title` is the heading. */
export function panel(title, helpEntry, children = [], { open = true, id = null } = {}) {
  const card = el('section', { class: 'card', id });
  const heading = el('h2', { text: title });
  card.append(heading);
  if (helpEntry) {
    card.append(el('p', { class: 'lede', text: helpEntry.lede }));
    if (helpEntry.detail) {
      const details = el('details', { class: 'howto' });
      details.append(el('summary', { text: 'How this works' }));
      details.append(el('p', { class: 'small', text: helpEntry.detail }));
      card.append(details);
    }
  }
  [].concat(children).forEach((child) => { if (child) card.append(child); });
  return card;
}

/** A collapsible section. Open state is remembered per key. */
export function accordion(title, children = [], { key = null, summary = '', defaultOpen = false } = {}) {
  const storageKey = key ? `reich62:open:${key}` : null;
  const stored = storageKey ? localStorage.getItem(storageKey) : null;
  const isOpen = stored === null ? defaultOpen : stored === '1';
  const details = el('details', { class: 'accordion', open: isOpen });
  const label = el('summary', {}, [
    el('span', { class: 'accordion-title', text: title }),
    summary ? el('span', { class: 'accordion-summary', text: summary }) : null
  ]);
  details.append(label);
  [].concat(children).forEach((child) => { if (child) details.append(child); });
  if (storageKey) {
    details.addEventListener('toggle', () => localStorage.setItem(storageKey, details.open ? '1' : '0'));
  }
  return details;
}

/** Sub-navigation inside one screen. Returns the bar; the caller renders the active pane. */
export function subTabs(tabs, activeId, onSelect) {
  const bar = el('div', { class: 'subtabs', role: 'tablist' });
  tabs.forEach((tab) => {
    bar.append(el('button', {
      type: 'button',
      class: `subtab${tab.id === activeId ? ' is-active' : ''}`,
      role: 'tab',
      'aria-selected': tab.id === activeId ? 'true' : 'false',
      text: tab.label,
      onclick: () => onSelect(tab.id)
    }));
  });
  return bar;
}

/** An empty state that always offers the next step rather than dead-ending. */
export function emptyState(message, action = null) {
  const node = el('div', { class: 'empty-state' }, [el('p', { class: 'muted', text: message })]);
  if (action) {
    node.append(el('a', { class: 'empty-action', href: action.href, text: action.label }));
  }
  return node;
}

/** Persistent outcome panel: results stay on screen instead of vanishing with a toast. */
export function outcomeBox(lines, { tone = 'neutral', title = 'What happened' } = {}) {
  return el('div', { class: `outcome outcome-${tone}`, 'aria-live': 'polite' }, [
    el('h3', { text: title }),
    el('ul', { class: 'small' }, [].concat(lines).filter(Boolean).map((line) => el('li', { text: line })))
  ]);
}

/** A number field with direct entry plus coarse and fine steppers. */
export function numberStepper({ id, label: text, ariaName = null, value, min = 0, max = 99, steps = [1], suffix = '', onChange }) {
  const name = ariaName || text;
  const input = el('input', {
    type: 'number', id, value: String(value), min: String(min), max: String(max),
    'aria-label': name, inputmode: 'numeric',
    onchange: (e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))
  });
  const controls = el('div', { class: 'stepper-controls' });
  [...steps].reverse().forEach((step) => {
    controls.append(el('button', {
      type: 'button', class: 'secondary', text: `−${step}`, 'aria-label': `Lower ${name} by ${step}`,
      onclick: () => onChange(Math.max(min, value - step))
    }));
  });
  steps.forEach((step) => {
    controls.append(el('button', {
      type: 'button', class: 'secondary', text: `+${step}`, 'aria-label': `Raise ${name} by ${step}`,
      onclick: () => onChange(Math.min(max, value + step))
    }));
  });
  return el('div', { class: 'stepper' }, [
    el('label', { class: 'stepper-label', for: id, text: suffix ? `${text} ${suffix}` : text }),
    el('div', { class: 'stepper-row' }, [input, controls])
  ]);
}

export { clear };
