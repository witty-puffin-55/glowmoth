// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The
// game moves between five screens: title, play, paused, win and game over. World events drive
// the sound and the screen-reader announcements, so the world itself stays free of both.
//
// ?seed=N fixes the garden's pattern. ?shot=start|play|night3|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
import { BEST_KEY, MOTH, STEP, WINGS } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EVENT_COLLECT, EVENT_HIT, EVENT_NIGHT_CLEAR, EVENT_NIGHT_START, EVENT_OVER, EVENT_WIN,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createSound } from './sound.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const sound = createSound();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, { screen: scene.screen, best: scene.best, multiplier: world.multiplier(), muted: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, renderer.toField);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // A small live handle on the game's state, handy for automated smoke tests.
  window.__glowmoth = { state: world.state, screen: () => screen };

  // Screen readers (and anyone watching the page's text) hear the screen changes and each bite.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    sound.start();
    announce(`Playing. Survive 3 nights. ${WINGS} wings.`);
  }

  function finish(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) {
      sound.win();
      announce(`You win. The garden glows again. Score ${world.state.score}.`);
    } else {
      sound.over();
      announce(`Game over on night ${world.state.night}. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      announce(sound.toggleMute() ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_WIN || screen === SCREEN_OVER)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  /** The velocity the player is steering toward this step: keys first, then the pointer. */
  function steering(now) {
    const direction = input.direction();
    if (direction.x !== 0 || direction.y !== 0) {
      const length = Math.hypot(direction.x, direction.y);
      return { x: (direction.x / length) * MOTH.maxSpeed, y: (direction.y / length) * MOTH.maxSpeed };
    }
    const target = input.pointerTarget(now);
    if (target !== null) {
      let vx = (target.x - world.state.moth.x) * 6;
      let vy = (target.y - world.state.moth.y) * 6;
      const speed = Math.hypot(vx, vy);
      if (speed > MOTH.maxSpeed) {
        vx = (vx / speed) * MOTH.maxSpeed;
        vy = (vy / speed) * MOTH.maxSpeed;
      }
      if (speed < 6) return { x: 0, y: 0 };
      return { x: vx, y: vy };
    }
    return { x: 0, y: 0 };
  }

  function step(now) {
    if (screen === SCREEN_TITLE) {
      world.stepAmbient(STEP);
      return;
    }
    if (screen === SCREEN_WIN || screen === SCREEN_OVER) {
      world.step(STEP, 0, 0);
      return;
    }
    const steer = steering(now);
    const events = world.step(STEP, steer.x, steer.y);
    if (events & EVENT_COLLECT) sound.collect(world.state.combo);
    if (events & EVENT_HIT) {
      sound.hit();
      announce(world.state.wings === 1 ? 'Bitten. 1 wing left.' : `Bitten. ${world.state.wings} wings left.`);
    }
    if (events & EVENT_NIGHT_START) announce(`Night ${world.state.night}. The bats are faster now.`);
    if (events & EVENT_WIN) finish(true);
    else if (events & EVENT_OVER) finish(false);
    else if (events & EVENT_NIGHT_CLEAR) {
      sound.nightClear();
      announce(`Night ${world.state.night} clear. Bonus ${world.state.lastClearBonus}.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen !== SCREEN_PAUSED) {
      while (accumulator >= STEP) {
        step(now);
        accumulator -= STEP;
        if (screen === SCREEN_PAUSED) {
          accumulator = 0;
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, { screen, best, multiplier: world.multiplier(), muted: sound.isMuted() });
  }

  // Leaving the tab pauses a running game rather than letting the bats hunt unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('GLOWMOTH. Keep the last light alive. Click or press Space to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
