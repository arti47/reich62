// main.js — entry point.

import { $ } from './core.js';
import { applyTheme, cycleTheme } from './settings.js';
import { startRouter } from './router.js';
import { showToast } from './ui.js';

applyTheme();

const themeButton = $('#theme-toggle');
if (themeButton) {
  themeButton.addEventListener('click', () => {
    const next = cycleTheme();
    showToast(`Theme: ${next}`);
  });
}

startRouter();

// PWA registration. Failures are non-fatal — the app works uninstalled.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            showToast('Update available — reload to apply', { timeout: 8000 });
          }
        });
      });
    }).catch(() => { /* offline install is optional */ });
  });
}

document.documentElement.dataset.booted = 'true';
