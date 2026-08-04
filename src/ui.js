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

export { clear };
