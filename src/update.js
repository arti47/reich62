// update.js — the "new version is ready" prompt.
// The service worker parks a new build instead of swapping it in, so this is what tells the
// player and hands the swap over on their tap. A timed toast is not enough: an update that
// arrives while the phone is in a pocket has to still be there when it comes back out.

import { el, $ } from './core.js';

/** How often an installed app looks for new code. Half an hour is often enough for a build
 *  that lands mid-session and rare enough to cost nothing. */
export const UPDATE_CHECK_MS = 30 * 60 * 1000;

let shown = false;

/** A persistent bar with a Reload button. `worker` is the parked service worker. */
export function offerUpdate(worker) {
  if (shown || !worker) return null;
  shown = true;

  const bar = el('div', { class: 'update-bar', id: 'update-bar', role: 'status', 'aria-live': 'polite' }, [
    el('span', { class: 'update-text', text: 'A new version of the app is ready.' })
  ]);
  bar.append(el('button', {
    type: 'button', class: 'primary', id: 'update-reload', text: 'Reload now',
    onclick: () => {
      bar.querySelector('#update-reload').disabled = true;
      bar.querySelector('.update-text').textContent = 'Updating…';
      // The worker takes over, and main.js reloads on controllerchange.
      worker.postMessage({ type: 'skipWaiting' });
    }
  }));
  bar.append(el('button', {
    type: 'button', class: 'secondary', id: 'update-later', text: 'Later',
    'aria-label': 'Dismiss the update notice',
    onclick: () => { bar.remove(); shown = false; }
  }));

  const host = $('#toast-region') ? document.body : null;
  if (!host) { shown = false; return null; }
  host.append(bar);
  return bar;
}
