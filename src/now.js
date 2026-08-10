// now.js — the solo "Now" bar.
//
// The solo tab holds eight panels and twenty controls, and a player who has never run a
// solo game does not know which one to press. The printed loop (§23) says what happens in
// what order, but a loop is not a queue — you do not walk it top to bottom, you re-enter it
// wherever the last thing left you. This module answers one question, in one line, above
// everything else: **what do I do now?**
//
// It invents no rule. Every state it can be in is a rule the app already runs — a clock
// that has filled (§8A), a suspicion threshold that has come into force (§17.2), the raid
// the Oracle now decides (§23), a scene that is not open, an answer waiting to be acted on
// (§18). The bar only decides which of those is the one in front of you, and gives it its
// button. The panels below stay exactly where they are, and become the place to change a
// setting rather than the place to find out what to do.
//
// Alerts win. A clock that has run out or a threshold that has just bitten interrupts the
// loop, because the fiction has changed under you and the next question would be asked in a
// world you have not noticed yet.

import { el, STORAGE_PREFIX } from './core.js';
import { confirmModal } from './ui.js';
import { CLOCKS } from '../data.js';
import { SOLO_LOOP } from '../data-solo.js';
import { activeCharacter, getScene } from './store.js';
import { currentHeat, heatIsSplit, heatThresholds } from './heat.js';
import { listClocks, closeClock } from './clocks.js';
import { sceneLabel } from './combat.js';

// What the player has already been told about. A threshold announces itself once; a filled
// clock stops nagging once it has been resolved. Kept on the device, alongside the scene.
const ACK_KEY = STORAGE_PREFIX + 'soloAck';

export function readAck() {
  try { return JSON.parse(localStorage.getItem(ACK_KEY) || '{}'); } catch { return {}; }
}

export function writeAck(patch) {
  const next = { ...readAck(), ...patch };
  localStorage.setItem(ACK_KEY, JSON.stringify(next));
  return next;
}

export function clearAck() { localStorage.removeItem(ACK_KEY); }

/** The suspicion level the raid rule and the threshold alert both read. Under the §17.5
 *  variant either track can be the one that has just bitten, so it is the higher. */
export function suspicionLevel(character = activeCharacter()) {
  const heat = currentHeat(character);
  return heatIsSplit() ? Math.max(heat.personal || 0, heat.cell || 0) : (heat.shared || 0);
}

/** What a newly-crossed threshold now does, whichever model is in force. */
const thresholdEffect = (t) => t.effect || [t.personal, t.cell].filter(Boolean).join('; ');

/**
 * What to do now. First match wins, alerts before the loop.
 *
 * `route` is where the player is standing: on the Roll screen the same state is reported,
 * but anything needing the Oracle panel sends them back rather than pretending to act.
 * Pure — it reads state and returns a description, and changes nothing.
 */
export function soloNowState({
  route = 'solo',
  character = activeCharacter(),
  scene = getScene(),
  lastAnswer = null
} = {}) {
  const ack = readAck();
  const onRoll = route === 'roll';

  // 1 — a clock that has filled. §8A: what it counted down to happens now.
  const full = listClocks().find((c) => c.progress >= c.target && ack.clock !== c.id);
  if (full) {
    return {
      id: 'clockFull', tone: 'alert', clockId: full.id,
      text: `${full.name} is full. ${CLOCKS.full}`,
      action: { id: 'now-resolve-clock', label: 'Resolve it' }
    };
  }

  // 2 — a suspicion threshold that has come into force since you were last told (§17.2).
  const level = suspicionLevel(character);
  const seen = Math.min(ack.heat === undefined ? 0 : ack.heat, level);
  const crossed = heatThresholds().filter((t) => t.level > seen && t.level <= level);
  if (crossed.length) {
    const top = crossed[crossed.length - 1];
    return {
      id: 'heatCrossed', tone: 'alert', level,
      text: `Suspicion is ${level}: ${thresholdEffect(top).toLowerCase()}.`,
      action: { id: 'now-ack-heat', label: 'Acknowledge' }
    };
  }

  // 3 — from suspicion 4 the book stops letting you decide when the raid lands (§23).
  if (level >= SOLO_LOOP.heatRule.fromLevel && ack.raidAtScene !== (scene ? scene.number : 0)) {
    return {
      id: 'raid', tone: 'alert',
      text: SOLO_LOOP.heatRule.note,
      action: onRoll
        ? { id: 'now-to-oracle', label: 'Back to the Oracle', href: '#/solo' }
        : { id: 'now-raid', label: 'Ask about the raid' }
    };
  }

  // 4 — nothing is running.
  if (!scene) {
    return {
      id: 'noScene', tone: 'neutral',
      text: 'No scene is running. Start one, and the app will keep telling you what comes next.',
      action: onRoll
        ? { id: 'now-to-oracle', label: 'Back to the Oracle', href: '#/solo' }
        : { id: 'now-start-scene', label: 'Start a scene' }
    };
  }

  const where = sceneLabel(scene);

  // 5 — you are standing on the Roll screen mid-scene: resolve the attempt, then come back.
  if (onRoll) {
    return {
      id: 'onRoll', tone: 'neutral',
      text: `${where.charAt(0).toUpperCase()}${where.slice(1)} is open. Resolve what your character is attempting, then take the result back to the Oracle.`,
      action: { id: 'now-to-oracle', label: 'Back to the Oracle', href: '#/solo' }
    };
  }

  // 6 — a scene with nothing asked in it yet.
  if (!lastAnswer) {
    return {
      id: 'sceneOpen', tone: 'neutral',
      text: `${where.charAt(0).toUpperCase()}${where.slice(1)} is open. Frame it with a prompt if you need one, then put a question to the Oracle.`,
      action: { id: 'now-ask', label: 'Ask the Oracle' }
    };
  }

  // 7…9 — the answer decides. An event that fired is read first, then an answer with a
  // string attached goes to the dice, and a plain answer simply moves the scene on.
  if (lastAnswer.event && !lastAnswer.eventRead) {
    return {
      id: 'eventFired', tone: 'alert',
      text: `"${lastAnswer.answer}" — and a random event fired with it.`,
      action: { id: 'now-read-event', label: 'Read what happened' }
    };
  }

  if (['yesBut', 'noBut', 'yesAnd', 'noAnd'].includes(lastAnswer.id)) {
    return {
      id: 'answerActable', tone: 'neutral',
      text: `The Oracle said "${lastAnswer.answer}". Something came with it — act on it, and roll if your character does anything about it.`,
      action: { id: 'now-to-roll', label: 'Act on it', href: '#/roll' }
    };
  }

  return {
    id: 'answerPlain', tone: 'neutral',
    text: `The Oracle said "${lastAnswer.answer}". Narrate it, then ask the next thing you do not know.`,
    action: { id: 'now-ask', label: 'Ask the next question' }
  };
}

/**
 * The bar itself, pinned above every panel. `handlers` supplies the actions that need the
 * Oracle's machinery, which only the solo screen has; anything unhandled falls back to a
 * link, so the Roll screen can render the same bar without importing the roller into this
 * module and back again.
 */
export function renderSoloNow(mount, { route = 'solo', handlers = {}, lastAnswer = null, onChange = () => {} } = {}) {
  const now = soloNowState({ route, lastAnswer });
  const bar = el('div', { class: `now-bar now-${now.tone}`, id: 'solo-now', 'aria-live': 'polite' }, [
    el('p', { class: 'now-label', text: 'Do this next' }),
    el('p', { class: 'now-text', id: 'solo-now-text', text: now.text })
  ]);

  // The two alerts need nothing but this module's own state, so they act wherever the bar
  // is rendered — a threshold you have read is read on the Roll screen too.
  const builtIn = {
    'now-ack-heat': (s) => { writeAck({ heat: s.level }); onChange(); },
    'now-resolve-clock': async (s) => {
      const close = await confirmModal(
        `${CLOCKS.full} Close the clock now that it has run out? Leaving it open keeps it on the list; either way this stops asking.`,
        { title: 'Resolve the clock', confirmLabel: 'Close it', cancelLabel: 'Leave it open' }
      );
      if (close) closeClock(s.clockId); else writeAck({ clock: s.clockId });
      onChange();
    }
  };

  const { action } = now;
  const handler = handlers[action.id] || builtIn[action.id];
  if (handler) {
    bar.append(el('button', {
      type: 'button', class: 'primary', id: action.id, text: action.label,
      onclick: () => handler(now)
    }));
  } else if (action.href) {
    bar.append(el('a', { class: 'empty-action', id: action.id, href: action.href, text: action.label }));
  } else {
    // No handler and nowhere to go means the screen cannot act on it from here.
    bar.append(el('a', { class: 'empty-action', id: 'now-to-oracle', href: '#/solo', text: 'Back to the Oracle' }));
  }

  mount.append(bar);
  return bar;
}
