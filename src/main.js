// main.js — entry point.

import { $ } from './core.js';
import { applyTheme, cycleTheme } from './settings.js';
import { startRouter, openScreenMenu } from './router.js';
import { showToast } from './ui.js';
import { offerUpdate, UPDATE_CHECK_MS } from './update.js';

applyTheme();

const themeButton = $('#theme-toggle');
if (themeButton) {
  themeButton.addEventListener('click', () => {
    const next = cycleTheme();
    showToast(`Theme: ${next}`);
  });
}

const menuButton = $('#screen-menu');
if (menuButton) menuButton.addEventListener('click', () => openScreenMenu());

startRouter();

// PWA registration and the update prompt. Failures are non-fatal — the app works uninstalled.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').then((reg) => {
      // A worker already parked and waiting means the new code is downloaded and ready.
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          // With no controller this is the first install, not an update.
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            offerUpdate(installing);
          }
        });
      });

      // An installed app can sit open for days, so look for new code on a timer and
      // whenever it comes back to the foreground.
      const check = () => { reg.update().catch(() => {}); };
      setInterval(check, UPDATE_CHECK_MS);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    }).catch(() => { /* offline install is optional */ });

    // The swap itself reloads once, when the new worker takes control.
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  });
}

document.documentElement.dataset.booted = 'true';
