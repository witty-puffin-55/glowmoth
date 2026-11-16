// Every tuning number and colour of GLOWMOTH in one place. The garden is a fixed 1280x800
// logical field; the renderer scales it to the window, so no rule below depends on screen size.

export const FIELD = { width: 1280, height: 800, groundY: 726 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const MOTH = {
  radius: 15,
  maxSpeed: 430,
  /** How fast the moth's velocity leans toward the steered velocity, per second. */
  responsiveness: 11,
  invulnerable: 1.6,
  wingFlapRate: 26,
};

export const WINGS = 3;
export const NIGHT_COUNT = 3;
/** Seconds of bat-dodging per night, and the breather between nights. */
export const NIGHT_SECONDS = 45;
export const CLEAR_SECONDS = 3;
/** Bonus for surviving a night, times the night's number. */
export const CLEAR_BONUS = 100;

export const ORB = {
  radius: 10,
  points: 10,
  spawnInterval: 0.85,
  life: 7,
  maxAlive: 16,
};

/** Consecutive gathers per combo tier; the multiplier is 1 + one tier per step, capped. */
export const COMBO = { gathersPerTier: 6, maxMultiplier: 8 };

/** Per night: how often a bat crosses, and how fast (a range the world rolls in). */
export const BATS = [
  { interval: 2.4, speedMin: 165, speedMax: 225 },
  { interval: 1.8, speedMin: 215, speedMax: 285 },
  { interval: 1.35, speedMin: 270, speedMax: 350 },
];
export const BAT_RADIUS = 21;

export const POOL = { orbs: 24, bats: 24, particles: 260 };

export const ORB_COLORS = ['#ffd94d', '#ff8ad8', '#7de8ff', '#b6ff7d'];
export const FLOWER_COLORS = ['#ff8ad8', '#ffd94d', '#b18cff', '#7de8ff', '#ff9d6b'];

export const PALETTE = {
  backdrop: '#04050d',
  skyTop: '#05081a',
  skyMid: '#0a1130',
  skyLow: '#0c1a2e',
  hillFar: '#0a1428',
  hillNear: '#060d1a',
  ground: '#03130b',
  grass: '#14532d',
  grassTip: '#22c55e',
  moon: '#f7f0cf',
  mothBody: '#ffedb5',
  mothWing: '#fff3c4',
  bat: '#171029',
  batWing: '#241843',
  batRim: '#9d7bff',
  batEye: '#ff5a5a',
  pollen: '#ffd94d',
  text: '#f4f7ff',
  muted: '#9aa7c7',
  gold: '#ffd94d',
  danger: '#ff6b6b',
  panel: 'rgba(8, 12, 30, 0.84)',
  panelEdge: 'rgba(157, 123, 255, 0.55)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'glowmoth.best';
