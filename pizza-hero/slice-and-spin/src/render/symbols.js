// Procedural Canvas vector art for every symbol. Drawn (not emoji) so it looks
// like real slot art and renders identically on every platform — important for
// store-wrapping. Each symbol sits behind its id here, so swapping in sprite
// sheets later is a localized change. `simple` mode draws a cheap silhouette
// used for fast-moving blur ghosts.

import { THEME } from '../engine/config.js';

const P = THEME.palette;
const OUTLINE = '#5a2d12';

function outline(ctx, size, w = 0.03) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.5, size * w);
  ctx.strokeStyle = OUTLINE;
}

function groundShadow(ctx, cx, cy, R) {
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(cx, cy + R * 0.96, R * 0.86, R * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---- regular symbols -------------------------------------------------------

function drawSlice(ctx, cx, cy, size, R) {
  const topY = cy - R * 0.7;
  const botY = cy + R * 1.0;
  const lX = cx - R;
  const rX = cx + R;
  // cheese body
  ctx.beginPath();
  ctx.moveTo(lX, topY);
  ctx.quadraticCurveTo(cx, topY - R * 0.22, rX, topY);
  ctx.lineTo(cx, botY);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx, topY, cx, botY);
  g.addColorStop(0, '#ffe08a');
  g.addColorStop(1, '#f3a425');
  ctx.fillStyle = g;
  ctx.fill();
  outline(ctx, size);
  ctx.stroke();
  // crust
  ctx.beginPath();
  ctx.moveTo(lX, topY);
  ctx.quadraticCurveTo(cx, topY - R * 0.22, rX, topY);
  ctx.quadraticCurveTo(cx, topY + R * 0.06, lX, topY);
  ctx.closePath();
  ctx.fillStyle = '#cf8536';
  ctx.fill();
  ctx.stroke();
  // pepperoni
  ctx.fillStyle = '#c0392b';
  for (const [px, py] of [
    [cx - R * 0.34, cy - R * 0.05],
    [cx + R * 0.33, cy],
    [cx, cy + R * 0.4],
  ]) {
    ctx.beginPath();
    ctx.arc(px, py, R * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // shine
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(cx - R * 0.2, cy - R * 0.2, R * 0.12, R * 0.28, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawPepper(ctx, cx, cy, size, R) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(0.25);
  // body
  ctx.beginPath();
  ctx.moveTo(-R * 0.1, -R * 0.7);
  ctx.bezierCurveTo(R * 0.6, -R * 0.6, R * 0.7, R * 0.5, -R * 0.1, R * 0.85);
  ctx.bezierCurveTo(-R * 0.55, R * 0.5, -R * 0.5, -R * 0.2, -R * 0.1, -R * 0.7);
  ctx.closePath();
  const g = ctx.createLinearGradient(-R * 0.5, 0, R * 0.6, 0);
  g.addColorStop(0, '#e0392b');
  g.addColorStop(1, '#ff6f59');
  ctx.fillStyle = g;
  ctx.fill();
  outline(ctx, size);
  ctx.stroke();
  // highlight
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = '#ffd2c2';
  ctx.lineWidth = R * 0.1;
  ctx.beginPath();
  ctx.moveTo(-R * 0.05, -R * 0.45);
  ctx.quadraticCurveTo(R * 0.3, -R * 0.1, R * 0.05, R * 0.5);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // stem
  ctx.fillStyle = '#4ca64c';
  outline(ctx, size);
  ctx.beginPath();
  ctx.moveTo(-R * 0.12, -R * 0.66);
  ctx.quadraticCurveTo(R * 0.05, -R * 1.05, R * 0.3, -R * 0.85);
  ctx.lineTo(R * 0.18, -R * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawMushroom(ctx, cx, cy, size, R) {
  // stem
  ctx.beginPath();
  roundRectPath(ctx, cx - R * 0.34, cy - R * 0.05, R * 0.68, R * 0.85, R * 0.22);
  const sg = ctx.createLinearGradient(cx, cy, cx, cy + R);
  sg.addColorStop(0, '#fff2d8');
  sg.addColorStop(1, '#e6cba0');
  ctx.fillStyle = sg;
  ctx.fill();
  outline(ctx, size);
  ctx.stroke();
  // cap
  ctx.beginPath();
  ctx.moveTo(cx - R, cy - R * 0.02);
  ctx.quadraticCurveTo(cx - R, cy - R * 0.95, cx, cy - R * 0.95);
  ctx.quadraticCurveTo(cx + R, cy - R * 0.95, cx + R, cy - R * 0.02);
  ctx.quadraticCurveTo(cx, cy + R * 0.18, cx - R, cy - R * 0.02);
  ctx.closePath();
  const cg = ctx.createLinearGradient(cx, cy - R, cx, cy);
  cg.addColorStop(0, '#e2503f');
  cg.addColorStop(1, '#b5301f');
  ctx.fillStyle = cg;
  ctx.fill();
  ctx.stroke();
  // spots
  ctx.fillStyle = '#fff2d8';
  for (const [px, py, rr] of [
    [cx - R * 0.4, cy - R * 0.45, 0.16],
    [cx + R * 0.32, cy - R * 0.5, 0.13],
    [cx + R * 0.05, cy - R * 0.25, 0.11],
  ]) {
    ctx.beginPath();
    ctx.arc(px, py, R * rr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCheese(ctx, cx, cy, size, R) {
  ctx.beginPath();
  ctx.moveTo(cx - R, cy + R * 0.55);
  ctx.lineTo(cx + R, cy + R * 0.55);
  ctx.lineTo(cx + R * 0.7, cy - R * 0.55);
  ctx.lineTo(cx - R * 0.5, cy - R * 0.2);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx, cy - R, cx, cy + R);
  g.addColorStop(0, '#ffe14d');
  g.addColorStop(1, '#f4b400');
  ctx.fillStyle = g;
  ctx.fill();
  outline(ctx, size);
  ctx.stroke();
  // rind top edge
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.5, cy - R * 0.2);
  ctx.lineTo(cx + R * 0.7, cy - R * 0.55);
  ctx.lineTo(cx + R * 0.7, cy - R * 0.4);
  ctx.lineTo(cx - R * 0.5, cy - R * 0.05);
  ctx.closePath();
  ctx.fillStyle = '#e8920a';
  ctx.fill();
  // holes
  ctx.fillStyle = '#e09a00';
  for (const [px, py, rr] of [
    [cx - R * 0.3, cy + R * 0.2, 0.14],
    [cx + R * 0.25, cy + R * 0.05, 0.11],
    [cx + R * 0.05, cy + R * 0.38, 0.09],
  ]) {
    ctx.beginPath();
    ctx.arc(px, py, R * rr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSoda(ctx, cx, cy, size, R) {
  const topY = cy - R * 0.7;
  const botY = cy + R * 0.9;
  // cup (trapezoid)
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.7, topY);
  ctx.lineTo(cx + R * 0.7, topY);
  ctx.lineTo(cx + R * 0.5, botY);
  ctx.lineTo(cx - R * 0.5, botY);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx - R, cy, cx + R, cy);
  g.addColorStop(0, '#d9d9d9');
  g.addColorStop(0.5, '#ffffff');
  g.addColorStop(1, '#cfcfcf');
  ctx.fillStyle = g;
  ctx.fill();
  outline(ctx, size);
  ctx.stroke();
  // red band
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.66, topY + R * 0.45);
  ctx.lineTo(cx + R * 0.66, topY + R * 0.45);
  ctx.lineTo(cx + R * 0.6, topY + R * 0.95);
  ctx.lineTo(cx - R * 0.6, topY + R * 0.95);
  ctx.closePath();
  ctx.fillStyle = '#c0392b';
  ctx.fill();
  ctx.restore();
  // lid
  ctx.beginPath();
  roundRectPath(ctx, cx - R * 0.8, topY - R * 0.18, R * 1.6, R * 0.28, R * 0.1);
  ctx.fillStyle = '#e74c3c';
  ctx.fill();
  ctx.stroke();
  // straw
  ctx.beginPath();
  ctx.lineWidth = R * 0.16;
  ctx.strokeStyle = '#f4b73f';
  ctx.lineCap = 'round';
  ctx.moveTo(cx + R * 0.18, topY - R * 0.12);
  ctx.lineTo(cx + R * 0.42, topY - R * 0.75);
  ctx.stroke();
}

function drawOlive(ctx, cx, cy, size, R) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, R * 0.66, R * 0.92, 0, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.3, R * 0.1, cx, cy, R);
  g.addColorStop(0, '#9fd24a');
  g.addColorStop(1, '#5a9120');
  ctx.fillStyle = g;
  ctx.fill();
  outline(ctx, size);
  ctx.stroke();
  // pimento hole
  ctx.beginPath();
  ctx.ellipse(cx, cy - R * 0.5, R * 0.22, R * 0.16, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#d94c3a';
  ctx.fill();
  ctx.stroke();
  // highlight
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#eaffc4';
  ctx.beginPath();
  ctx.ellipse(cx - R * 0.25, cy + R * 0.05, R * 0.12, R * 0.3, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

const REGULAR = {
  SLICE: drawSlice,
  PEPPER: drawPepper,
  MUSHROOM: drawMushroom,
  CHEESE: drawCheese,
  SODA: drawSoda,
  OLIVE: drawOlive,
};

// ---- coin ------------------------------------------------------------------

function drawCoin(ctx, cx, cy, size, sym, now, scale) {
  const r = size * 0.36 * scale;
  const isJp = !!sym.jackpot;
  ctx.save();
  // outer glow
  ctx.shadowColor = isJp ? P.ember : P.glow;
  ctx.shadowBlur = 16 + Math.sin(now / 220) * 6;
  // rim
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  const rim = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  rim.addColorStop(0, '#fff0b0');
  rim.addColorStop(1, '#b07a18');
  ctx.fillStyle = rim;
  ctx.fill();
  ctx.shadowBlur = 0;
  // inner face
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
  const face = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r * 0.82);
  face.addColorStop(0, '#ffe9a8');
  face.addColorStop(0.6, P.gold);
  face.addColorStop(1, '#cf9a22');
  ctx.fillStyle = face;
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.strokeStyle = '#8a5e12';
  ctx.stroke();
  // notched rim ticks
  ctx.strokeStyle = '#a9791d';
  ctx.lineWidth = Math.max(1, r * 0.04);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86);
    ctx.lineTo(cx + Math.cos(a) * r * 0.96, cy + Math.sin(a) * r * 0.96);
    ctx.stroke();
  }
  // label
  ctx.fillStyle = '#5a3b08';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (sym.jackpot) {
    ctx.font = `800 ${Math.floor(r * 0.4)}px system-ui, sans-serif`;
    ctx.fillText(sym.jackpot, cx, cy - r * 0.16);
    ctx.font = `700 ${Math.floor(r * 0.24)}px system-ui, sans-serif`;
    ctx.fillText('JACKPOT', cx, cy + r * 0.28);
  } else {
    ctx.font = `900 ${Math.floor(r * 0.62)}px system-ui, sans-serif`;
    ctx.fillText('×' + sym.mult, cx, cy + r * 0.04);
  }
  // animated shine sweep
  const sweep = ((now / 1400) % 1) * 2 - 1; // -1..1
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#ffffff';
  ctx.translate(cx + sweep * r * 1.6, cy);
  ctx.rotate(-0.5);
  ctx.fillRect(-r * 0.18, -r * 1.4, r * 0.24, r * 2.8);
  ctx.restore();
  ctx.restore();
}

// ---- collector (pizza delivery box) ---------------------------------------

function drawCollector(ctx, cx, cy, size, now, scale, total) {
  const s = size * 0.4 * scale;
  ctx.save();
  ctx.shadowColor = P.collector;
  ctx.shadowBlur = 14 + Math.sin(now / 180) * 6;
  ctx.translate(cx, cy);
  // box base
  roundRectPath(ctx, -s, -s * 0.62, s * 2, s * 1.24, s * 0.16);
  const bg = ctx.createLinearGradient(0, -s * 0.62, 0, s * 0.62);
  bg.addColorStop(0, '#d68a3c');
  bg.addColorStop(1, '#9c5a1f');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.shadowBlur = 0;
  outline(ctx, size);
  ctx.stroke();
  // lid lip
  roundRectPath(ctx, -s, -s * 0.62, s * 2, s * 0.42, s * 0.14);
  ctx.fillStyle = '#e89a4a';
  ctx.fill();
  ctx.stroke();
  // pizza-hero stamp circle
  ctx.beginPath();
  ctx.arc(0, s * 0.16, s * 0.36, 0, Math.PI * 2);
  ctx.fillStyle = '#c0392b';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = P.cream;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.floor(s * 0.3)}px system-ui, sans-serif`;
  ctx.fillText('🍕', 0, s * 0.18);
  // running total badge (during bonus)
  if (total != null) {
    ctx.fillStyle = P.gold;
    ctx.shadowColor = P.glow;
    ctx.shadowBlur = 8;
    ctx.font = `900 ${Math.floor(s * 0.42)}px system-ui, sans-serif`;
    ctx.fillText(Math.round(total).toLocaleString(), 0, -s * 0.34);
  }
  ctx.restore();
}

// ---- simple silhouettes for fast blur ghosts ------------------------------

const SIMPLE_COLOR = {
  SLICE: '#f3a425',
  PEPPER: '#e0392b',
  MUSHROOM: '#d24433',
  CHEESE: '#f4b400',
  SODA: '#e74c3c',
  OLIVE: '#6ba12a',
  COIN: '#ffd24a',
  COLLECTOR: '#c97a2f',
};

function drawSimple(ctx, cx, cy, size, sym) {
  const r = size * 0.32;
  const id = sym.type === 'coin' ? 'COIN' : sym.type === 'collector' ? 'COLLECTOR' : sym.symbol;
  ctx.fillStyle = SIMPLE_COLOR[id] || '#ddd';
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 1.15, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---- dispatch --------------------------------------------------------------

export function drawSymbolArt(ctx, sym, cx, cy, size, opts = {}) {
  if (!sym) return;
  const { now = 0, scale = 1, simple = false, collectorTotal = null } = opts;
  if (simple) {
    drawSimple(ctx, cx, cy, size, sym);
    return;
  }
  const R = size * 0.36 * scale;
  if (sym.type === 'coin') {
    drawCoin(ctx, cx, cy, size, sym, now, scale);
    return;
  }
  if (sym.type === 'collector') {
    drawCollector(ctx, cx, cy, size, now, scale, collectorTotal);
    return;
  }
  const fn = REGULAR[sym.symbol];
  if (!fn) {
    drawSimple(ctx, cx, cy, size, sym);
    return;
  }
  groundShadow(ctx, cx, cy, R);
  ctx.save();
  fn(ctx, cx, cy, size, R);
  ctx.restore();
}

// shared rounded-rect path (no begin/close fuss for callers that fill+stroke)
function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
