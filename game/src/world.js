// GLOWMOTH's rules and state, with no drawing and no browser in it: the moth, the pollen orbs,
// the bats, the flowers they grow from, the particles every event throws off, and the three
// nights the player has to last. step() advances one fixed step under a steered velocity and
// returns what happened as bit flags, so the caller can react (sound, announcements) without
// the world knowing about screens. Nothing here allocates after createWorld returns.
import {
  BAT_RADIUS, BATS, CLEAR_BONUS, CLEAR_SECONDS, COMBO, FIELD, FLOWER_COLORS, MOTH,
  NIGHT_COUNT, NIGHT_SECONDS, ORB, ORB_COLORS, POOL, WINGS,
} from './config.js';

export const EVENT_COLLECT = 1;
export const EVENT_HIT = 2;
export const EVENT_NIGHT_CLEAR = 4;
export const EVENT_NIGHT_START = 8;
export const EVENT_OVER = 16;
export const EVENT_WIN = 32;

export const PHASE_PLAY = 'play';
export const PHASE_CLEAR = 'clear';
export const PHASE_DONE = 'done';

function distanceSquared(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const moth = { x: 0, y: 0, vx: 0, vy: 0, radius: MOTH.radius, flap: 0, invulnerable: 0, face: 1 };
  const orbs = [];
  for (let index = 0; index < POOL.orbs; index += 1) {
    orbs.push({ active: false, x: 0, y: 0, baseY: 0, age: 0, life: ORB.life, phase: 0, color: ORB_COLORS[0] });
  }
  const bats = [];
  for (let index = 0; index < POOL.bats; index += 1) {
    bats.push({ active: false, x: 0, y: 0, baseY: 0, vx: 0, waveAmp: 0, waveFreq: 0, wavePhase: 0, flap: 0, radius: BAT_RADIUS });
  }
  const particles = [];
  for (let index = 0; index < POOL.particles; index += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, size: 2, color: '#ffffff', gravity: 0, drag: 1 });
  }
  const stars = [];
  for (let index = 0; index < 110; index += 1) {
    stars.push({ x: random() * FIELD.width, y: random() * FIELD.groundY * 0.72, size: 0.8 + random() * 1.7, phase: random() * Math.PI * 2 });
  }
  const fireflies = [];
  for (let index = 0; index < 26; index += 1) {
    fireflies.push({ x: random() * FIELD.width, y: 120 + random() * (FIELD.groundY - 200), phase: random() * Math.PI * 2, speed: 0.24 + random() * 0.5 });
  }
  const state = {
    moth, orbs, bats, particles, stars, fireflies,
    flowers: [],
    score: 0, combo: 0, wings: WINGS,
    night: 1, phase: PHASE_PLAY, nightTime: NIGHT_SECONDS, clearTime: 0, lastClearBonus: 0,
    time: 0, orbTimer: 0, batTimer: 0, trailTimer: 0, orbSpawnCount: 0,
  };

  /** The score multiplier the current combo earns: one tier per COMBO.gathersPerTier gathers. */
  function multiplier() {
    return Math.min(COMBO.maxMultiplier, 1 + Math.floor(state.combo / COMBO.gathersPerTier));
  }

  function burst(x, y, color, count, speed, life, size, gravity) {
    let made = 0;
    for (let index = 0; index < particles.length && made < count; index += 1) {
      const p = particles[index];
      if (p.active) continue;
      const angle = random() * Math.PI * 2;
      const reach = speed * (0.3 + random() * 0.7);
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * reach;
      p.vy = Math.sin(angle) * reach - speed * 0.25;
      p.age = 0;
      p.life = life * (0.6 + random() * 0.7);
      p.size = size * (0.6 + random() * 0.8);
      p.color = color;
      p.gravity = gravity;
      p.drag = 2.2;
      made += 1;
    }
  }

  /** Lay out this night's flowers: a fresh row of glowing stems along the garden floor. */
  function setupNight(night) {
    const count = 5 + night; // 6, 7, then 8 flowers: the garden fills in as the nights deepen.
    state.flowers = [];
    for (let index = 0; index < count; index += 1) {
      state.flowers.push({
        x: ((index + 0.5) / count) * FIELD.width + (random() - 0.5) * 100,
        stemHeight: 64 + random() * 118,
        color: FLOWER_COLORS[Math.floor(random() * FLOWER_COLORS.length)],
        phase: random() * Math.PI * 2,
        size: 13 + random() * 8,
      });
    }
    state.nightTime = NIGHT_SECONDS;
    state.orbTimer = 0.25;
    state.batTimer = 1.4;
    for (const orb of orbs) orb.active = false;
    for (const bat of bats) bat.active = false;
    // A welcoming drift of pollen is already in the air when the night begins.
    for (let index = 0; index < 5; index += 1) spawnOrb();
  }

  function placeOrb(orb, x, baseY) {
    orb.active = true;
    orb.x = Math.min(FIELD.width - 30, Math.max(30, x));
    orb.baseY = Math.min(FIELD.groundY - 110, Math.max(110, baseY));
    orb.y = orb.baseY;
    orb.age = 0;
    orb.life = ORB.life;
    orb.phase = random() * Math.PI * 2;
    orb.color = ORB_COLORS[Math.floor(random() * ORB_COLORS.length)];
  }

  function freeOrb() {
    let alive = 0;
    for (const orb of orbs) if (orb.active) alive += 1;
    if (alive >= ORB.maxAlive) return null;
    for (const orb of orbs) if (!orb.active) return orb;
    return null;
  }

  /** One orb drifting up from a random flower. */
  function spawnOrb() {
    const orb = freeOrb();
    if (orb === null) return;
    const flower = state.flowers[Math.floor(random() * state.flowers.length)];
    placeOrb(orb, flower.x + (random() - 0.5) * 190, FIELD.groundY - flower.stemHeight - 60 - random() * 240);
  }

  /** A short trail of three orbs arcing away from one flower: the path a hungry moth follows. */
  function spawnOrbTrail() {
    const flower = state.flowers[Math.floor(random() * state.flowers.length)];
    const direction = random() < 0.5 ? -1 : 1;
    const startX = flower.x + (random() - 0.5) * 60;
    const startY = FIELD.groundY - flower.stemHeight - 70 - random() * 150;
    const offsets = [[0, 0], [56, -34], [112, -16]];
    for (const [dx, dy] of offsets) {
      const orb = freeOrb();
      if (orb === null) return;
      placeOrb(orb, startX + dx * direction, startY + dy);
    }
  }

  function spawnBat() {
    for (const bat of bats) {
      if (bat.active) continue;
      const tuning = BATS[state.night - 1];
      const fromLeft = random() < 0.5;
      const speed = tuning.speedMin + random() * (tuning.speedMax - tuning.speedMin);
      bat.active = true;
      bat.x = fromLeft ? -50 : FIELD.width + 50;
      bat.baseY = 178 + random() * 372;
      bat.y = bat.baseY;
      bat.vx = fromLeft ? speed : -speed;
      bat.waveAmp = 24 + random() * 52;
      bat.waveFreq = 1.1 + random() * 1.3;
      bat.wavePhase = random() * Math.PI * 2;
      bat.flap = random() * Math.PI * 2;
      return;
    }
  }

  function reset() {
    state.score = 0;
    state.combo = 0;
    state.wings = WINGS;
    state.night = 1;
    state.phase = PHASE_PLAY;
    state.clearTime = 0;
    state.lastClearBonus = 0;
    moth.x = FIELD.width / 2;
    moth.y = 360;
    moth.vx = 0;
    moth.vy = 0;
    moth.invulnerable = 0;
    moth.face = 1;
    for (const particle of particles) particle.active = false;
    setupNight(1);
  }

  function moveMoth(dt, steerX, steerY) {
    const blend = Math.min(1, dt * MOTH.responsiveness);
    moth.vx += (steerX - moth.vx) * blend;
    moth.vy += (steerY - moth.vy) * blend;
    moth.x = Math.min(FIELD.width - moth.radius, Math.max(moth.radius, moth.x + moth.vx * dt));
    moth.y = Math.min(FIELD.groundY - moth.radius - 6, Math.max(64 + moth.radius, moth.y + moth.vy * dt));
    if (Math.abs(moth.vx) > 12) moth.face = moth.vx > 0 ? 1 : -1;
    moth.flap += dt * (MOTH.wingFlapRate + Math.hypot(moth.vx, moth.vy) * 0.03);
    if (moth.invulnerable > 0) moth.invulnerable = Math.max(0, moth.invulnerable - dt);
    // The moth sheds a slow trail of light dust as it flies.
    state.trailTimer -= dt;
    if (state.trailTimer <= 0 && (Math.abs(moth.vx) > 40 || Math.abs(moth.vy) > 40)) {
      state.trailTimer = 0.05;
      burst(moth.x, moth.y + 6, '#ffe9a8', 1, 14, 0.7, 2.4, -12);
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        continue;
      }
      const drag = Math.max(0, 1 - p.drag * dt);
      p.vx *= drag;
      p.vy = p.vy * drag + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function updateAmbient(dt) {
    for (const fly of fireflies) {
      fly.x += Math.cos(state.time * fly.speed + fly.phase) * 9 * dt;
      fly.y += Math.sin(state.time * fly.speed * 1.3 + fly.phase) * 7 * dt;
    }
    for (const orb of orbs) {
      if (!orb.active) continue;
      orb.age += dt;
      orb.y = orb.baseY + Math.sin(orb.age * 2 + orb.phase) * 9;
      if (orb.age >= orb.life) orb.active = false;
    }
    for (const bat of bats) {
      if (!bat.active) continue;
      bat.x += bat.vx * dt;
      bat.y = bat.baseY + Math.sin(state.time * bat.waveFreq + bat.wavePhase) * bat.waveAmp;
      bat.flap += dt * 13;
      if (bat.x < -90 || bat.x > FIELD.width + 90) bat.active = false;
    }
  }

  /**
   * One fixed step of a real game. `steerX`/`steerY` are the velocity the player is asking for,
   * in field pixels a second (already capped by the caller at MOTH.maxSpeed).
   */
  function step(dt, steerX, steerY) {
    let events = 0;
    state.time += dt;
    moveMoth(dt, steerX, steerY);
    updateParticles(dt);
    updateAmbient(dt);
    if (state.phase === PHASE_DONE) return events;

    if (state.phase === PHASE_CLEAR) {
      state.clearTime -= dt;
      events |= collectOrbs();
      if (state.clearTime <= 0) {
        state.night += 1;
        state.phase = PHASE_PLAY;
        setupNight(state.night);
        events |= EVENT_NIGHT_START;
      }
      return events;
    }

    // PHASE_PLAY: the night runs down while bats cross and pollen drifts.
    state.nightTime -= dt;
    state.orbTimer -= dt;
    if (state.orbTimer <= 0) {
      state.orbSpawnCount += 1;
      if (state.orbSpawnCount % 3 === 0) spawnOrbTrail();
      else spawnOrb();
      state.orbTimer += ORB.spawnInterval;
    }
    state.batTimer -= dt;
    if (state.batTimer <= 0) {
      spawnBat();
      state.batTimer += BATS[state.night - 1].interval * (0.75 + random() * 0.5);
    }
    events |= collectOrbs();
    events |= batHits();
    if (state.phase === PHASE_DONE) return events;
    if (state.nightTime <= 0) {
      state.lastClearBonus = CLEAR_BONUS * state.night;
      state.score += state.lastClearBonus;
      burst(moth.x, moth.y, '#b6ff7d', 26, 190, 0.9, 3, 60);
      for (const bat of bats) bat.active = false;
      events |= EVENT_NIGHT_CLEAR;
      if (state.night >= NIGHT_COUNT) {
        state.phase = PHASE_DONE;
        events |= EVENT_WIN;
      } else {
        state.phase = PHASE_CLEAR;
        state.clearTime = CLEAR_SECONDS;
      }
    }
    return events;
  }

  function collectOrbs() {
    let events = 0;
    for (const orb of orbs) {
      if (!orb.active) continue;
      const reach = moth.radius + ORB.radius + 5;
      if (distanceSquared(moth.x, moth.y, orb.x, orb.y) < reach * reach) {
        orb.active = false;
        state.combo += 1;
        state.score += ORB.points * multiplier();
        burst(orb.x, orb.y, orb.color, 9, 120, 0.55, 2.6, 30);
        events |= EVENT_COLLECT;
      }
    }
    return events;
  }

  function batHits() {
    let events = 0;
    if (moth.invulnerable > 0) return events;
    for (const bat of bats) {
      if (!bat.active) continue;
      const reach = moth.radius + bat.radius - 7;
      if (distanceSquared(moth.x, moth.y, bat.x, bat.y) < reach * reach) {
        bat.active = false;
        state.wings -= 1;
        state.combo = 0;
        moth.invulnerable = MOTH.invulnerable;
        burst(moth.x, moth.y, '#ff6b6b', 22, 230, 0.7, 3.2, 90);
        burst(moth.x, moth.y, '#ffd94d', 10, 150, 0.6, 2.4, 40);
        events |= EVENT_HIT;
        if (state.wings <= 0) {
          state.phase = PHASE_DONE;
          events |= EVENT_OVER;
        }
        break;
      }
    }
    return events;
  }

  /**
   * The title screen's backdrop: no timers, no danger, nothing scores. The moth hovers and
   * breathes at the garden's centre while pollen drifts and a bat or two crosses far above.
   */
  function stepAmbient(dt) {
    state.time += dt;
    moth.x = FIELD.width / 2 + Math.sin(state.time * 0.4) * 26;
    moth.y = 330 + Math.sin(state.time * 0.9) * 16;
    moth.flap += dt * MOTH.wingFlapRate;
    if (moth.invulnerable > 0) moth.invulnerable = 0;
    updateParticles(dt);
    updateAmbient(dt);
    let orbCount = 0;
    for (const orb of orbs) if (orb.active) orbCount += 1;
    if (orbCount < 7) spawnOrb();
    let batCount = 0;
    for (const bat of bats) if (bat.active) batCount += 1;
    if (batCount < 2 && random() < dt * 0.25) spawnBat();
  }

  reset();
  return { state, reset, step, stepAmbient, multiplier };
}
