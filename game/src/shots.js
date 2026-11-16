// The screenshot scenes behind ?shot=start|play|night3|end. Each one plays the real rules
// forward from a fresh world at the fixed step, steered by an autopilot, so the frame is what
// a real game looks like and the same seed always gives the same frame. The play and night3
// pilots gather pollen and dodge bats; the end pilot does the opposite and flies at every bat,
// so the game-over screen it reaches is one the rules produced, not a state typed in by hand.
import { FIELD, MOTH, NIGHT_SECONDS, STEP } from './config.js';
import { PHASE_DONE, PHASE_PLAY } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 16;
const NIGHT3_INTO_SECONDS = 12;
const END_LIMIT_SECONDS = 300;
const DODGE_RADIUS = 195;

/** The steering velocity that flies the moth from where it is toward a point, capped. */
function velocityToward(moth, targetX, targetY) {
  let vx = (targetX - moth.x) * 6;
  let vy = (targetY - moth.y) * 6;
  const speed = Math.hypot(vx, vy);
  if (speed > MOTH.maxSpeed) {
    vx = (vx / speed) * MOTH.maxSpeed;
    vy = (vy / speed) * MOTH.maxSpeed;
  }
  return { x: vx, y: vy };
}

/** A fair player: chase the nearest pollen orb, shoved away from any bat that comes close. */
function gatherPilot(state) {
  const moth = state.moth;
  let targetX = FIELD.width / 2;
  let targetY = 330;
  let nearest = Infinity;
  for (const orb of state.orbs) {
    if (!orb.active) continue;
    const d = (orb.x - moth.x) ** 2 + (orb.y - moth.y) ** 2;
    if (d < nearest) {
      nearest = d;
      targetX = orb.x;
      targetY = orb.y;
    }
  }
  let shoveX = 0;
  let shoveY = 0;
  for (const bat of state.bats) {
    if (!bat.active) continue;
    const dx = moth.x - bat.x;
    const dy = moth.y - bat.y;
    const distance = Math.hypot(dx, dy);
    if (distance < DODGE_RADIUS && distance > 0.01) {
      const weight = ((DODGE_RADIUS - distance) / DODGE_RADIUS) * 2.6;
      shoveX += (dx / distance) * weight;
      shoveY += (dy / distance) * weight;
    }
  }
  return velocityToward(moth, targetX + shoveX * 130, targetY + shoveY * 130);
}

/** A doomed player: fly straight at the nearest bat, or wait where bats cross. */
function kamikazePilot(state) {
  const moth = state.moth;
  let targetX = FIELD.width / 2;
  let targetY = 300;
  let nearest = Infinity;
  for (const bat of state.bats) {
    if (!bat.active) continue;
    const d = (bat.x - moth.x) ** 2 + (bat.y - moth.y) ** 2;
    if (d < nearest) {
      nearest = d;
      targetX = bat.x;
      targetY = bat.y;
    }
  }
  return velocityToward(moth, targetX, targetY);
}

/**
 * Set `world` to the named scene (start, play, night3 or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name === 'play') {
    for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
      const steer = gatherPilot(state);
      world.step(STEP, steer.x, steer.y);
      if (state.phase === PHASE_DONE) break;
    }
    return { screen: SCREEN_PLAY, best: state.score };
  }
  if (name === 'night3') {
    const limit = (NIGHT_SECONDS * 2 + 30) / STEP;
    for (let index = 0; index < limit; index += 1) {
      const steer = gatherPilot(state);
      world.step(STEP, steer.x, steer.y);
      if (state.phase === PHASE_DONE) break;
      if (state.night === 3 && state.phase === PHASE_PLAY && state.nightTime <= NIGHT_SECONDS - NIGHT3_INTO_SECONDS) break;
    }
    return { screen: state.phase === PHASE_DONE && state.wings <= 0 ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }
  if (name === 'end') {
    // A real, short game: gather like a player for a few seconds, then tire and start
    // blundering into bats, so the game-over screen carries a score a player would have.
    for (let index = 0; index < 9 / STEP; index += 1) {
      const steer = gatherPilot(state);
      world.step(STEP, steer.x, steer.y);
      if (state.phase === PHASE_DONE) break;
    }
    for (let index = 0; index < END_LIMIT_SECONDS / STEP && state.phase !== PHASE_DONE; index += 1) {
      const steer = kamikazePilot(state);
      world.step(STEP, steer.x, steer.y);
    }
    return { screen: state.wings <= 0 ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }
  for (let index = 0; index < START_SECONDS / STEP; index += 1) world.stepAmbient(STEP);
  return { screen: SCREEN_TITLE, best: 0 };
}
