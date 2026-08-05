// core.js — constants, DOM helpers and raw dice primitives. Imports nothing (CLAUDE.md §7.1).

export const APP_NAME = "REICH '62 Player";
export const STORAGE_PREFIX = 'reich62:';

// --- DOM helpers ---
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, String(v));
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// --- misc ---
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const titleCase = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

// --- raw dice primitives ---
// A symbol tally is a plain object keyed by symbol id.
export const EMPTY_TALLY = Object.freeze({ success: 0, advantage: 0, triumph: 0, failure: 0, threat: 0, despair: 0 });

export const newTally = (over = {}) => ({ ...EMPTY_TALLY, ...over });

// Uniform integer in [1, sides]. Used for table lookups (d10, d100) and, since the face
// distributions were supplied (D§), for symbol dice too.
export function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

/** Roll one symbol die from its face table and return the face index and its symbols. */
export function rollFace(faces) {
  const index = Math.floor(Math.random() * faces.length);
  return { face: index + 1, symbols: faces[index] };
}

/** Cancel Success against Failure and Advantage against Threat, one for one (§1).
 *  Triumph and Despair are never cancelled. */
export function cancel(tally) {
  const t = newTally(tally);
  const successNet = t.success - t.failure;
  const advantageNet = t.advantage - t.threat;
  return {
    success: Math.max(0, successNet),
    failure: Math.max(0, -successNet),
    advantage: Math.max(0, advantageNet),
    threat: Math.max(0, -advantageNet),
    triumph: t.triumph,
    despair: t.despair
  };
}

/** Net outcome of a resolved tally (§1). Success needs at least one net Success. */
export function outcome(tally) {
  const net = cancel(tally);
  return {
    net,
    success: net.success >= 1,
    netSuccess: net.success,
    netFailure: net.failure,
    netAdvantage: net.advantage,
    netThreat: net.threat,
    triumph: net.triumph,
    despair: net.despair
  };
}

/** The data files cite their sources inline ("… matching §1"). Interface copy never shows a
 *  section marker, so any data string rendered on screen passes through here first. */
export function plain(value) {
  return String(value == null ? '' : value)
    .replace(/\s*\((?:per\s+|see\s+)?(?:B?§|D§)[0-9A-Za-z.'’′, §–-]*\)/g, '')
    .replace(/\s*(?:B?§|D§)[0-9][0-9A-Za-z.'’′]*/g, '')
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
