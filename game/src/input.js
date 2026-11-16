// Keyboard and pointer input. Held keys give a steering direction; the pointer gives a point
// in field coordinates for the moth to chase. One-shot presses (start, pause, restart, mute)
// are queued as bit flags and taken once by the loop, so a press between two frames is never
// lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;

const HELD = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'KeyA', 'KeyD', 'KeyW', 'KeyS',
]);

/**
 * `toField(clientX, clientY)` converts a pointer position into field coordinates (the renderer
 * owns that transform). The pointer counts as steering while it is down, and for a few seconds
 * after it last moved: a player who parks the mouse expects the moth to stay near it.
 */
export function createInput(target, toField) {
  const held = new Set();
  const pointer = { x: 0, y: 0, seen: false, down: false, lastMoveAt: -Infinity };
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (HELD.has(event.code)) {
      held.add(event.code);
    } else if (event.code === 'Space' || event.code === 'Enter') {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyR') {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
    pointer.down = false;
  });

  function trackPointer(event) {
    const point = toField(event.clientX, event.clientY);
    pointer.x = point.x;
    pointer.y = point.y;
    pointer.seen = true;
    pointer.lastMoveAt = performance.now();
  }
  target.addEventListener('pointermove', trackPointer);
  target.addEventListener('pointerdown', (event) => {
    trackPointer(event);
    pointer.down = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    pointer.down = false;
  });

  return {
    /** The held steering direction: each axis -1, 0 or 1. */
    direction() {
      const x = (held.has('ArrowRight') || held.has('KeyD') ? 1 : 0) - (held.has('ArrowLeft') || held.has('KeyA') ? 1 : 0);
      const y = (held.has('ArrowDown') || held.has('KeyS') ? 1 : 0) - (held.has('ArrowUp') || held.has('KeyW') ? 1 : 0);
      return { x, y };
    },
    keyboardActive() {
      return held.size > 0;
    },
    /** The pointer's field position while it steers, or null when it should be ignored. */
    pointerTarget(now) {
      if (!pointer.seen) return null;
      if (pointer.down || now - pointer.lastMoveAt < 3500) return { x: pointer.x, y: pointer.y };
      return null;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
