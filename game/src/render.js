// Drawing only: the world's state and the current screen in, pixels out. The 1280x800 garden
// is scaled to fit the window and centred, the margin filled with the backdrop colour. All art
// is procedural: gradients and shadowBlur for the glow, petals and wings as drawn shapes. The
// scene is built to read in one glance — a huge score, a huge combo, the night and its clock,
// and the moth's remaining wings are always on screen while playing.
import { COMBO, FIELD, FONT, NIGHT_COUNT, NIGHT_SECONDS, ORB, PALETTE, WINGS } from './config.js';
import { PHASE_CLEAR } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

const PANEL = { width: 780, radius: 18 };

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  let skyGradient = null;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  /** Pointer position in field coordinates, clamped inside the garden. */
  function toField(clientX, clientY) {
    const ratio = window.devicePixelRatio || 1;
    const x = (clientX * ratio - view.x) / view.scale;
    const y = (clientY * ratio - view.y) / view.scale;
    return {
      x: Math.min(FIELD.width, Math.max(0, x)),
      y: Math.min(FIELD.height, Math.max(0, y)),
    };
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight = 400) {
    const key = `${weight}:${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function glowText(value, x, y, size, color, align, blur) {
    context.save();
    context.shadowColor = color;
    context.shadowBlur = blur;
    text(value, x, y, size, color, align, 800);
    context.restore();
  }

  function drawGarden(state) {
    if (skyGradient === null) {
      skyGradient = context.createLinearGradient(0, 0, 0, FIELD.height);
      skyGradient.addColorStop(0, PALETTE.skyTop);
      skyGradient.addColorStop(0.45, PALETTE.skyMid);
      skyGradient.addColorStop(0.78, PALETTE.skyLow);
      skyGradient.addColorStop(0.92, PALETTE.ground);
      skyGradient.addColorStop(1, PALETTE.ground);
    }
    context.fillStyle = skyGradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);

    // Stars, twinkling on their own phases.
    for (const star of state.stars) {
      const alpha = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(state.time * 1.7 + star.phase));
      context.globalAlpha = alpha;
      context.fillStyle = '#dfe8ff';
      context.fillRect(star.x, star.y, star.size, star.size);
    }
    context.globalAlpha = 1;

    // The moon: a halo, a disc, and a shadow disc that leaves a fat crescent. It hangs below
    // the HUD's right-hand block, so the night clock and the wing icons never cross it.
    const moonX = 1146;
    const moonY = 216;
    const halo = context.createRadialGradient(moonX, moonY, 8, moonX, moonY, 120);
    halo.addColorStop(0, 'rgba(247, 240, 207, 0.35)');
    halo.addColorStop(1, 'rgba(247, 240, 207, 0)');
    context.fillStyle = halo;
    context.fillRect(moonX - 120, moonY - 120, 240, 240);
    context.fillStyle = PALETTE.moon;
    context.beginPath();
    context.arc(moonX, moonY, 34, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.skyTop;
    context.beginPath();
    context.arc(moonX + 15, moonY - 7, 30, 0, Math.PI * 2);
    context.fill();

    // Two hill ridges, then the garden floor.
    ridge(PALETTE.hillFar, 596, 26, 0.011, 1.7);
    ridge(PALETTE.hillNear, 652, 20, 0.017, 4.2);
    context.fillStyle = PALETTE.ground;
    context.fillRect(0, FIELD.groundY, FIELD.width, FIELD.height - FIELD.groundY);

    drawGrass(state);
    for (const flower of state.flowers) drawFlower(state, flower);

    // Fireflies drifting over the garden.
    for (const fly of state.fireflies) {
      const alpha = 0.2 + 0.33 * (0.5 + 0.5 * Math.sin(state.time * 2.1 + fly.phase * 3));
      context.globalAlpha = alpha;
      context.fillStyle = PALETTE.pollen;
      context.beginPath();
      context.arc(fly.x, fly.y, 2.2, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function ridge(color, baseY, amp, freq, phase) {
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(0, FIELD.height);
    for (let x = 0; x <= FIELD.width; x += 32) {
      context.lineTo(x, baseY + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.7 + phase * 2) * amp * 0.4);
    }
    context.lineTo(FIELD.width, FIELD.height);
    context.closePath();
    context.fill();
  }

  function drawGrass(state) {
    context.lineWidth = 2.4;
    for (let index = 0; index < 110; index += 1) {
      const x = ((index * 83.7) % (FIELD.width - 8)) + 4;
      const tall = 13 + ((index * 37) % 17);
      const sway = Math.sin(state.time * 1.1 + index * 1.7) * 3.5;
      context.strokeStyle = index % 3 === 0 ? PALETTE.grassTip : PALETTE.grass;
      context.beginPath();
      context.moveTo(x, FIELD.height);
      context.quadraticCurveTo(x + sway * 0.4, FIELD.height - tall * 0.6, x + sway, FIELD.height - tall);
      context.stroke();
    }
  }

  function drawFlower(state, flower) {
    const topX = flower.x + Math.sin(state.time * 0.8 + flower.phase) * 6;
    const topY = FIELD.groundY - flower.stemHeight;
    context.strokeStyle = PALETTE.grass;
    context.lineWidth = 3.4;
    context.beginPath();
    context.moveTo(flower.x, FIELD.groundY + 4);
    context.quadraticCurveTo(flower.x + 4, FIELD.groundY - flower.stemHeight * 0.55, topX, topY);
    context.stroke();
    // One leaf halfway up the stem.
    context.fillStyle = PALETTE.grass;
    context.beginPath();
    context.ellipse(flower.x + 9, FIELD.groundY - flower.stemHeight * 0.45, 11, 4.6, -0.6, 0, Math.PI * 2);
    context.fill();
    // The blossom: a glowing heart ringed with petals.
    context.save();
    context.shadowColor = flower.color;
    context.shadowBlur = 16;
    context.fillStyle = flower.color;
    for (let petal = 0; petal < 6; petal += 1) {
      const angle = (petal / 6) * Math.PI * 2 + flower.phase;
      context.beginPath();
      context.ellipse(
        topX + Math.cos(angle) * flower.size * 0.72,
        topY + Math.sin(angle) * flower.size * 0.72,
        flower.size * 0.62, flower.size * 0.34, angle, 0, Math.PI * 2,
      );
      context.fill();
    }
    context.fillStyle = '#fff7d6';
    context.beginPath();
    context.arc(topX, topY, flower.size * 0.36, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawOrb(orb) {
    const pulse = 1 + 0.16 * Math.sin(orb.age * 4 + orb.phase);
    const fade = Math.min(1, orb.age / 0.3, Math.max(0, (orb.life - orb.age) / 0.9));
    const haloRadius = 30 * pulse;
    const halo = context.createRadialGradient(orb.x, orb.y, 2, orb.x, orb.y, haloRadius);
    halo.addColorStop(0, orb.color);
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.save();
    context.globalAlpha = 0.5 * fade;
    context.fillStyle = halo;
    context.fillRect(orb.x - haloRadius, orb.y - haloRadius, haloRadius * 2, haloRadius * 2);
    context.globalAlpha = fade;
    context.fillStyle = orb.color;
    context.beginPath();
    context.arc(orb.x, orb.y, ORB.radius * pulse, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(255, 255, 255, 0.9)';
    context.beginPath();
    context.arc(orb.x - 3, orb.y - 3, ORB.radius * 0.36 * pulse, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawBat(bat) {
    const direction = bat.vx >= 0 ? 1 : -1;
    const flap = Math.sin(bat.flap) * 0.6;
    context.save();
    context.translate(bat.x, bat.y);
    context.scale(direction, 1);
    context.shadowColor = PALETTE.batRim;
    context.shadowBlur = 7;
    // Wings: broad scalloped fans that rise and fall with the flap.
    context.fillStyle = PALETTE.batWing;
    context.strokeStyle = PALETTE.batRim;
    context.lineWidth = 1.6;
    for (const side of [-1, 1]) {
      const tipY = -14 - flap * 16;
      context.beginPath();
      context.moveTo(side * 4, -2);
      context.quadraticCurveTo(side * 22, tipY - 8, side * 40, tipY + 6);
      context.quadraticCurveTo(side * 30, tipY + 13, side * 24, 4);
      context.quadraticCurveTo(side * 14, tipY + 12, side * 8, 6);
      context.closePath();
      context.fill();
      context.stroke();
    }
    // Body and head, with two ears and two lit eyes.
    context.fillStyle = PALETTE.bat;
    context.beginPath();
    context.ellipse(0, 2, 15, 10.5, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.arc(13, -1, 7.6, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(8, -7);
    context.lineTo(10.5, -14);
    context.lineTo(13, -7.6);
    context.closePath();
    context.moveTo(15, -7.6);
    context.lineTo(18.5, -13.6);
    context.lineTo(19.6, -6.4);
    context.closePath();
    context.fill();
    context.shadowColor = PALETTE.batEye;
    context.shadowBlur = 8;
    context.fillStyle = PALETTE.batEye;
    context.beginPath();
    context.arc(15.5, -2.4, 1.9, 0, Math.PI * 2);
    context.arc(10.8, -2.8, 1.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawMoth(state) {
    const moth = state.moth;
    // Blink while invulnerable after a bite: hidden on every other tenth of a second.
    const blinking = moth.invulnerable > 0 && Math.floor(moth.invulnerable * 10) % 2 === 0;
    const flap = Math.sin(moth.flap) * 0.5;
    context.save();
    context.translate(moth.x, moth.y);
    // The halo the whole garden is lit by.
    const halo = context.createRadialGradient(0, 0, 4, 0, 0, 96);
    halo.addColorStop(0, 'rgba(255, 217, 77, 0.34)');
    halo.addColorStop(1, 'rgba(255, 217, 77, 0)');
    context.fillStyle = halo;
    context.fillRect(-96, -96, 192, 192);
    if (!blinking) {
      context.rotate(Math.max(-0.3, Math.min(0.3, moth.vy * 0.0006)));
      context.scale(moth.face, 1);
      context.shadowColor = PALETTE.pollen;
      context.shadowBlur = 16;
      context.fillStyle = 'rgba(255, 243, 196, 0.88)';
      for (const side of [-1, 1]) {
        // Hindwing, then the bigger forewing, both swept by the flap.
        context.save();
        context.rotate(side * (0.95 + flap * 0.35));
        context.beginPath();
        context.ellipse(side * 13, 7, 15, 7.6, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
        context.save();
        context.rotate(side * (0.55 + flap * 0.5));
        context.beginPath();
        context.ellipse(side * 17, -4, 21, 9.6, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
      // Body: a plump gradient abdomen, a head, and two curving antennae.
      const body = context.createLinearGradient(0, -8, 0, 9);
      body.addColorStop(0, '#fff6d8');
      body.addColorStop(1, '#e8b64c');
      context.shadowBlur = 10;
      context.fillStyle = body;
      context.beginPath();
      context.ellipse(-1, 1, 16, 8.2, 0, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.arc(14, -1, 6.4, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = '#e8b64c';
      context.lineWidth = 1.8;
      context.beginPath();
      context.moveTo(17, -5);
      context.quadraticCurveTo(25, -13, 31, -12);
      context.moveTo(16, -6.4);
      context.quadraticCurveTo(22, -15, 28, -16.6);
      context.stroke();
      context.fillStyle = '#241a05';
      context.beginPath();
      context.arc(16.4, -2.6, 2, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, 1 - p.age / p.life);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size * (1 - (p.age / p.life) * 0.5), 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawWingIcon(x, y, lit) {
    context.save();
    context.translate(x, y);
    context.rotate(-0.5);
    if (lit) {
      context.shadowColor = PALETTE.pollen;
      context.shadowBlur = 9;
      context.fillStyle = PALETTE.mothWing;
    } else {
      context.fillStyle = 'rgba(120, 128, 160, 0.25)';
    }
    context.beginPath();
    context.ellipse(0, 0, 15, 7.4, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawHud(state, multiplier) {
    context.textBaseline = 'top';
    text('SCORE', 26, 16, 19, PALETTE.muted, 'left', 700);
    text(String(state.score), 24, 38, 47, PALETTE.text, 'left', 800);

    // The combo, as big as the score: it is the number the player is chasing.
    if (multiplier > 1) {
      glowText(`COMBO ×${multiplier}`, FIELD.width / 2, 20, 52, PALETTE.gold, 'center', 22);
      if (multiplier < COMBO.maxMultiplier) {
        const into = state.combo % COMBO.gathersPerTier;
        context.fillStyle = 'rgba(255, 255, 255, 0.16)';
        context.fillRect(FIELD.width / 2 - 70, 84, 140, 6);
        context.fillStyle = PALETTE.gold;
        context.fillRect(FIELD.width / 2 - 70, 84, (140 * into) / COMBO.gathersPerTier, 6);
      }
    } else {
      text('COMBO ×1', FIELD.width / 2, 30, 27, PALETTE.muted, 'center', 700);
    }

    text(`NIGHT ${state.night} / ${NIGHT_COUNT}`, FIELD.width - 26, 16, 31, PALETTE.text, 'right', 800);
    const fraction = state.phase === PHASE_CLEAR ? 1 : Math.max(0, state.nightTime / NIGHT_SECONDS);
    context.fillStyle = 'rgba(255, 255, 255, 0.16)';
    context.fillRect(FIELD.width - 246, 58, 220, 11);
    context.fillStyle = state.phase === PHASE_CLEAR ? '#7ddb4f' : fraction < 0.22 ? PALETTE.danger : PALETTE.gold;
    context.fillRect(FIELD.width - 246, 58, 220 * fraction, 11);
    for (let wing = 0; wing < WINGS; wing += 1) {
      drawWingIcon(FIELD.width - 226 + wing * 72, 96, wing < state.wings);
    }
    text('WINGS', FIELD.width - 26, 114, 17, PALETTE.muted, 'right', 700);

    context.globalAlpha = 0.85;
    text('Gather pollen · Dodge the bats · Last all 3 nights', FIELD.width / 2, FIELD.height - 30, 19, PALETTE.muted, 'center', 400);
    context.globalAlpha = 1;
    context.textBaseline = 'alphabetic';
  }

  function drawClearBanner(state) {
    const centre = FIELD.width / 2;
    glowText(`NIGHT ${state.night} CLEAR!`, centre, 268, 56, '#b6ff7d', 'center', 24);
    text(`+${state.lastClearBonus} bonus`, centre, 322, 30, PALETTE.text, 'center', 700);
    text(`Night ${state.night + 1} is coming…`, centre, 366, 24, PALETTE.muted, 'center', 400);
  }

  function panel(height) {
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(3, 4, 12, 0.5)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(x, y, PANEL.width, height, PANEL.radius);
    context.fill();
    context.stroke();
    return y;
  }

  function drawTitle(state, best) {
    context.fillStyle = 'rgba(3, 4, 12, 0.42)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    const centre = FIELD.width / 2;
    glowText('GLOWMOTH', centre, 218, 118, PALETTE.gold, 'center', 42);
    text('Keep the last light alive.', centre, 262, 31, PALETTE.text, 'center', 400);
    text('Gather glowing pollen to feed the light — every streak grows your combo.', centre, 356, 24, PALETTE.text, 'center', 400);
    text('Dodge the bats: one bite costs a wing and ends the streak.', centre, 392, 24, PALETTE.text, 'center', 400);
    text('Last all 3 nights, each faster than the last, to win.', centre, 428, 24, PALETTE.text, 'center', 400);
    text('Steer: mouse, or ← ↑ → ↓ / WASD      Pause: P      Restart: R      Sound: M', centre, 486, 22, PALETTE.muted, 'center', 400);
    if (best > 0) text(`Best score ${best}`, centre, 528, 22, PALETTE.muted, 'center', 700);
    const blink = 0.55 + 0.45 * Math.sin(state.time * 3.2);
    context.globalAlpha = blink;
    text('Click or press Space to start', centre, 592, 27, PALETTE.gold, 'center', 800);
    context.globalAlpha = 1;
  }

  function drawEndPanel(title, titleColor, lines, score, best) {
    const y = panel(360);
    const centre = FIELD.width / 2;
    glowText(title, centre, y + 92, 52, titleColor, 'center', 24);
    lines.forEach((line, index) => {
      text(line, centre, y + 148 + index * 36, 24, PALETTE.text, 'center', 400);
    });
    text(`FINAL SCORE  ${score}`, centre, y + 148 + lines.length * 36 + 14, 34, PALETTE.gold, 'center', 800);
    if (best > 0 && best !== score) text(`Best ${best}`, centre, y + 148 + lines.length * 36 + 58, 21, PALETTE.muted, 'center', 400);
    text('Press R to fly again', centre, y + 322, 25, PALETTE.gold, 'center', 800);
  }

  /** Paint one frame: the garden, its creatures, then the HUD or the screen's panel. */
  function draw(state, view) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.beginPath();
    context.rect(0, 0, FIELD.width, FIELD.height);
    context.clip();
    drawGarden(state);
    for (const orb of state.orbs) if (orb.active) drawOrb(orb);
    for (const bat of state.bats) if (bat.active) drawBat(bat);
    drawParticles(state);
    drawMoth(state);
    if (view.screen === SCREEN_TITLE) {
      drawTitle(state, view.best);
      return;
    }
    if (view.screen === SCREEN_WIN) {
      drawEndPanel('The garden glows again', PALETTE.gold, ['You kept the last light alive through all 3 nights.'], state.score, view.best);
      return;
    }
    if (view.screen === SCREEN_OVER) {
      drawEndPanel('The light went out', PALETTE.danger, [`The bats claimed the garden on night ${state.night}.`], state.score, view.best);
      return;
    }
    drawHud(state, view.multiplier);
    if (state.phase === PHASE_CLEAR && view.screen === SCREEN_PLAY) drawClearBanner(state);
    if (view.screen === SCREEN_PAUSED) {
      const y = panel(220);
      glowText('PAUSED', FIELD.width / 2, y + 96, 48, PALETTE.text, 'center', 18);
      text('The garden holds its breath.', FIELD.width / 2, y + 142, 23, PALETTE.muted, 'center', 400);
      text('Press P to resume', FIELD.width / 2, y + 186, 24, PALETTE.gold, 'center', 800);
    }
    if (view.muted) {
      context.globalAlpha = 0.8;
      text('SOUND OFF (M)', FIELD.width - 26, FIELD.height - 30, 17, PALETTE.muted, 'right', 700);
      context.globalAlpha = 1;
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField };
}
