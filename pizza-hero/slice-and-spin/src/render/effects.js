// Particle system + transient effects: sparkles, coin glints, collector beams,
// floating value chips, count-up text, and a full-screen celebration overlay.
// Pooled particles, time-based so it stays smooth at any frame rate.

import { THEME } from '../engine/config.js';

const POOL_SIZE = 400;

export function createEffects() {
  const P = THEME.palette;
  let lastNow = 0;

  // particle pool
  const particles = new Array(POOL_SIZE).fill(null).map(() => ({ alive: false }));
  function spawn() {
    for (const p of particles) if (!p.alive) return p;
    return particles[0]; // recycle oldest-ish if exhausted
  }

  const beams = []; // collector vacuum beams
  const floaters = []; // floating value chips / count-up
  let overlay = null; // celebration overlay state

  function burst(x, y, { count = 14, color = P.gold, speed = 140, life = 0.7, size = 3 } = {}) {
    for (let i = 0; i < count; i++) {
      const p = spawn();
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const v = speed * (0.5 + Math.random());
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(ang) * v;
      p.vy = Math.sin(ang) * v - 30;
      p.life = life * (0.7 + Math.random() * 0.6);
      p.age = 0;
      p.size = size * (0.7 + Math.random() * 0.8);
      p.color = color;
      p.grav = 320;
    }
  }

  function beam(from, to, { color = P.collector, life = 0.45 } = {}) {
    beams.push({ from: { ...from }, to: { ...to }, age: 0, life, color });
  }

  function floatText(x, y, text, { color = P.cream, life = 0.9, dy = -50, size = 22, bold = true } = {}) {
    floaters.push({ x, y, text, color, life, age: 0, dy, size, bold });
  }

  // animated count-up number anchored at a point; calls onDone when finished
  function celebrate(amount, { title = 'BIG WIN', duration = 2.2, onDone = null } = {}) {
    overlay = { amount, shown: 0, title, duration, age: 0, onDone };
  }
  function clearOverlay() {
    overlay = null;
  }
  function isCelebrating() {
    return !!overlay;
  }

  function draw(ctx, layout, now) {
    const dt = lastNow ? Math.min((now - lastNow) / 1000, 0.05) : 0;
    lastNow = now;

    // particles
    for (const p of particles) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.alive = false;
        continue;
      }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const t = 1 - p.age / p.life;
      ctx.globalAlpha = t;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * t + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // beams
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i];
      b.age += dt;
      const t = b.age / b.life;
      if (t >= 1) {
        beams.splice(i, 1);
        continue;
      }
      const ease = 1 - Math.pow(1 - t, 2);
      const hx = b.from.x + (b.to.x - b.from.x) * ease;
      const hy = b.from.y + (b.to.y - b.from.y) * ease;
      ctx.save();
      ctx.globalAlpha = 0.7 * (1 - t);
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(b.from.x, b.from.y);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.globalAlpha = 0.9 * (1 - t);
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // floating chips
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.age += dt;
      const t = f.age / f.life;
      if (t >= 1) {
        floaters.splice(i, 1);
        continue;
      }
      const ease = 1 - Math.pow(1 - t, 2);
      const y = f.y + f.dy * ease;
      ctx.save();
      ctx.globalAlpha = t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2;
      ctx.font = `${f.bold ? '800 ' : ''}${f.size}px system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = P.shadow;
      ctx.strokeText(f.text, f.x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, y);
      ctx.restore();
    }

    // celebration overlay
    if (overlay) {
      overlay.age += dt;
      const t = overlay.age / overlay.duration;
      const countT = Math.min(overlay.age / (overlay.duration * 0.6), 1);
      overlay.shown = Math.floor(overlay.amount * easeOutCubic(countT));
      const w = layout.w;
      const h = layout.h;
      ctx.save();
      ctx.globalAlpha = Math.min(t * 3, 1) * (t > 0.9 ? (1 - t) / 0.1 : 1);
      ctx.fillStyle = 'rgba(10,4,2,0.78)';
      ctx.fillRect(0, 0, w, h);

      // title
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = P.masa;
      ctx.font = `800 ${Math.min(w * 0.11, 56)}px system-ui, sans-serif`;
      ctx.shadowColor = P.ember;
      ctx.shadowBlur = 24;
      ctx.fillText(overlay.title, w / 2, h * 0.4);

      // amount
      const pulse = 1 + Math.sin(overlay.age * 10) * 0.03;
      ctx.font = `800 ${Math.min(w * 0.16, 84) * pulse}px system-ui, sans-serif`;
      ctx.fillStyle = P.gold;
      ctx.shadowColor = P.gold;
      ctx.shadowBlur = 30;
      ctx.fillText(overlay.shown.toLocaleString(), w / 2, h * 0.54);
      ctx.restore();

      // sparkle rain during overlay
      if (Math.random() < 0.4)
        burst(Math.random() * w, h * 0.3 + Math.random() * h * 0.3, {
          count: 6,
          color: Math.random() < 0.5 ? P.gold : P.masa,
          speed: 90,
          life: 0.8,
        });

      if (overlay.age >= overlay.duration) {
        const done = overlay.onDone;
        overlay = null;
        if (done) done();
      }
    }
  }

  return {
    z: 100,
    draw,
    burst,
    beam,
    floatText,
    celebrate,
    clearOverlay,
    isCelebrating,
  };
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
