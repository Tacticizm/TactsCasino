// Reel / symbol drawing + spin animation. Holds a display view of the 3x3 board
// and animates columns spinning to target symbols with staggered ease-out +
// overshoot settle. Pure presentation: the engine decides outcomes, this only
// shows them. Sequencing uses performance.now() so it's decoupled from the loop.

import { GRID, THEME, JACKPOTS } from '../engine/config.js';
import { drawSymbolArt } from './symbols.js';

// What can blur past during a spin, per reel + phase. Real slots show each
// reel's own varied strip — including money/bonus symbols — so the player gets
// teased that a coin or collector might land. Repeats here act as weights
// (more common symbols listed more often, specials sprinkled in).
const REEL_POOLS = {
  // base game — the outer (coin) reels
  baseOuter: [
    'SLICE', 'PEPPER', 'MUSHROOM', 'CHEESE', 'SODA', 'OLIVE',
    'SLICE', 'PEPPER', 'MUSHROOM', 'CHEESE', 'SODA', 'OLIVE',
    'COIN', 'COIN', // teasing coins go by on the coin lanes
  ],
  // base game — the middle (collector) reel
  baseMiddle: [
    'SLICE', 'PEPPER', 'MUSHROOM', 'CHEESE', 'SODA', 'OLIVE',
    'SLICE', 'PEPPER', 'MUSHROOM', 'CHEESE', 'SODA', 'OLIVE',
    'COLLECTOR', // a collector teases by in the middle lane
  ],
  // bonus respins — outer cells can only become coins or blanks
  bonusOuter: ['COIN', 'BLANK', 'BLANK', 'BLANK', 'COIN', 'BLANK'],
  // bonus respins — middle cell can only become a collector or blank
  bonusMiddle: ['COLLECTOR', 'BLANK', 'BLANK', 'BLANK', 'BLANK'],
};

// Stable per-(reel, position) pseudo-random so the strip doesn't flicker frame
// to frame — same index always yields the same symbol.
function hashRand(col, row, i) {
  let t = ((col * 73856093) ^ (row * 19349663) ^ (i * 83492791)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// A visual-only coin face for the blur (does not affect math).
function blurCoin(r) {
  if (r < 0.05) return { type: 'coin', symbol: 'COIN', mult: 0, jackpot: 'MINI' };
  if (r < 0.55) return { type: 'coin', symbol: 'COIN', mult: 1, jackpot: null };
  if (r < 0.82) return { type: 'coin', symbol: 'COIN', mult: 2, jackpot: null };
  if (r < 0.94) return { type: 'coin', symbol: 'COIN', mult: 3, jackpot: null };
  if (r < 0.99) return { type: 'coin', symbol: 'COIN', mult: 5, jackpot: null };
  return { type: 'coin', symbol: 'COIN', mult: 10, jackpot: null };
}

// The symbol shown at strip index i for a spinning cell. Indices at/after the
// landing point resolve to the real result so the reel decelerates straight
// into its outcome with no snap.
function stripSymbolAt(anim, i) {
  if (i >= anim.travelCells) return anim.finalSym;
  const pool =
    anim.reelPool === 'bonus'
      ? anim.col === GRID.collectorCol
        ? REEL_POOLS.bonusMiddle
        : REEL_POOLS.bonusOuter
      : anim.col === GRID.collectorCol
        ? REEL_POOLS.baseMiddle
        : REEL_POOLS.baseOuter;
  const id = pool[Math.floor(hashRand(anim.col, anim.row, i) * pool.length)];
  if (id === 'BLANK') return null;
  if (id === 'COIN') return blurCoin(hashRand(anim.col, anim.row, i + 7919));
  if (id === 'COLLECTOR') return { type: 'collector', symbol: 'COLLECTOR' };
  return { type: 'regular', symbol: id };
}

export function createReels() {
  const P = THEME.palette;

  // display cell: { sym, locked, anim, glow }
  // sym is a descriptor: { type, symbol, mult?, jackpot? } or null (blank)
  const cells = [];
  for (let c = 0; c < GRID.cols; c++) {
    cells.push([]);
    for (let r = 0; r < GRID.rows; r++) cells[c].push({ sym: null, locked: false, anim: null, pop: 0 });
  }

  let highlights = []; // [{col,row,color,until}]
  let laneHints = null; // {left,mid,right} booleans for near-miss anticipation
  let collectorTotal = null; // running bonus total shown on collectors (null = hidden)

  function setCellStatic(col, row, sym, locked = false) {
    cells[col][row].sym = sym;
    cells[col][row].locked = locked;
    cells[col][row].anim = null;
  }

  // Set the whole board instantly (no animation) from an engine grid.
  function setBoard(grid) {
    for (let c = 0; c < GRID.cols; c++)
      for (let r = 0; r < GRID.rows; r++) {
        const cell = grid[c][r];
        cells[c][r].sym = toSym(cell);
        cells[c][r].locked = false;
        cells[c][r].anim = null;
      }
  }

  function clearBoard() {
    for (let c = 0; c < GRID.cols; c++)
      for (let r = 0; r < GRID.rows; r++) setCellStatic(c, r, null, false);
  }

  // Animate a set of cells spinning to their final symbol.
  // list: [{col, row, sym}]  (sym null = lands blank)
  // opts: { spinMs, stagger, settleMs, onCellLand, onColumnStop }
  function animate(list, opts = {}) {
    const spinMs = opts.spinMs ?? 700;
    const stagger = opts.stagger ?? 140;
    const settleMs = opts.settleMs ?? 260;
    const start = performance.now();

    // group by column to stagger + fire column-stop callbacks
    const byCol = new Map();
    for (const item of list) {
      if (!byCol.has(item.col)) byCol.set(item.col, []);
      byCol.get(item.col).push(item);
    }

    const cols = [...byCol.keys()].sort((a, b) => a - b);
    const promises = [];

    cols.forEach((col, idx) => {
      const stopAt = start + spinMs + idx * stagger;
      const dur = stopAt - start;
      // later reels spin longer (more symbols pass) — builds suspense like a
      // real machine where reel 1 stops first.
      const travelCells = Math.max(7, Math.round(dur / 78));
      for (const item of byCol.get(col)) {
        cells[item.col][item.row].anim = {
          start,
          stopAt,
          settleMs,
          finalSym: item.sym,
          reelPool: opts.reelPool ?? 'base',
          travelCells,
          col: item.col,
          row: item.row,
          settled: false,
        };
      }
      promises.push(
        new Promise((resolve) => {
          const delay = stopAt - performance.now();
          setTimeout(
            () => {
              for (const item of byCol.get(col)) {
                const cc = cells[item.col][item.row];
                cc.sym = item.sym;
                cc.anim = null;
                cc.pop = 1; // pop on land
                if (item.sym) cc.locked = opts.lockOnLand ?? cc.locked;
                if (opts.onCellLand) opts.onCellLand(item.col, item.row, item.sym);
              }
              if (opts.onColumnStop) opts.onColumnStop(col);
              resolve();
            },
            Math.max(0, delay)
          );
        })
      );
    });

    return Promise.all(promises);
  }

  // Base spin: all 9 cells spin to the engine grid; nothing locked.
  function spinBase(grid, opts = {}) {
    const list = [];
    for (let c = 0; c < GRID.cols; c++)
      for (let r = 0; r < GRID.rows; r++) list.push({ col: c, row: r, sym: toSym(grid[c][r]) });
    // clear locks first
    for (let c = 0; c < GRID.cols; c++) for (let r = 0; r < GRID.rows; r++) cells[c][r].locked = false;
    return animate(list, { spinMs: 1150, stagger: 230, settleMs: 320, reelPool: 'base', ...opts });
  }

  // Lock a cell (used at trigger + on bonus landings).
  function lock(col, row) {
    cells[col][row].locked = true;
    cells[col][row].pop = 1;
  }

  function highlight(cellsList, color = THEME.palette.gold, ms = 1400) {
    const until = performance.now() + ms;
    for (const { col, row } of cellsList) highlights.push({ col, row, color, until });
  }
  function clearHighlights() {
    highlights = [];
  }
  function setLaneHints(hints) {
    laneHints = hints;
  }
  // Set the running total shown on collector boxes during the bonus (null hides it).
  function setCollectorTotal(v) {
    collectorTotal = v;
  }

  // ---- drawing ----
  function draw(ctx, layout, now) {
    if (!layout) return;
    const { cell } = layout;

    // lane hint glows (near-miss anticipation) behind cells
    if (laneHints) drawLaneHints(ctx, layout, now);

    highlights = highlights.filter((h) => h.until > now);

    for (let c = 0; c < GRID.cols; c++) {
      for (let r = 0; r < GRID.rows; r++) {
        const rect = layout.cellRect(c, r);
        const dc = cells[c][r];
        drawCellBg(ctx, rect, dc, now);

        // decay pop
        if (dc.pop > 0) dc.pop = Math.max(0, dc.pop - 0.06);

        if (dc.anim) {
          drawSpinning(ctx, rect, dc.anim, now, cell);
        } else if (dc.sym) {
          // squash-and-stretch on land (pop decays 1→0), plus a gentle idle bob
          // for live symbols so the board breathes. Locked symbols hold still.
          const pop = dc.pop;
          const sx = 1 + pop * 0.22;
          const sy = 1 - pop * 0.14;
          const phase = (c * 7 + r * 3) * 0.7;
          const bob = dc.locked || pop > 0.02 ? 0 : Math.sin(now / 620 + phase) * rect.h * 0.018;
          drawSymbol(ctx, { ...rect, cy: rect.cy + bob }, dc.sym, { now, sx, sy });
        }

        // highlight ring
        const hl = highlights.find((h) => h.col === c && h.row === r);
        if (hl) drawHighlightRing(ctx, rect, hl.color, now);
      }
    }
  }

  function drawCellBg(ctx, rect, dc, now) {
    const radius = Math.max(8, rect.w * 0.1);
    ctx.save();

    // recessed well
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
    const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    if (dc.locked) {
      grad.addColorStop(0, '#6a3a1a');
      grad.addColorStop(1, '#3d2010');
    } else {
      grad.addColorStop(0, '#3a2013');
      grad.addColorStop(1, '#23120a');
    }
    ctx.fillStyle = grad;
    ctx.fill();

    // top inner gloss
    ctx.save();
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
    ctx.clip();
    const gloss = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h * 0.5);
    gloss.addColorStop(0, 'rgba(255,255,255,0.12)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h * 0.5);
    ctx.restore();

    // frame: glowing gold when locked, dark bevel otherwise
    roundRect(ctx, rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2, radius - 1);
    ctx.lineWidth = Math.max(2, rect.w * (dc.locked ? 0.035 : 0.02));
    if (dc.locked) {
      ctx.strokeStyle = P.gold;
      ctx.shadowColor = P.glow;
      ctx.shadowBlur = 16 + Math.sin(now / 220) * 6;
    } else {
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawSpinning(ctx, rect, anim, now, cell) {
    const radius = Math.max(8, rect.w * 0.1);
    ctx.save();
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
    ctx.clip();

    const spinning = now < anim.stopAt;
    if (spinning) {
      // Ease-out deceleration: a fast blur early, slowing to readable as the
      // reel settles into its result. `travel` counts symbols scrolled; the
      // strip resolves to the real outcome at the landing index, so the reel
      // decelerates straight into its result with no snap.
      const p = Math.min((now - anim.start) / (anim.stopAt - anim.start), 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const travel = eased * anim.travelCells;
      const baseIndex = Math.floor(travel);
      const frac = travel - baseIndex;
      for (let k = 2; k >= -1; k--) {
        const sym = stripSymbolAt(anim, baseIndex + k);
        if (!sym) continue;
        const y = rect.y + (frac - k) * cell;
        drawSymbol(ctx, { ...rect, y, cy: y + rect.h / 2 }, sym, { scale: 1, now });
      }
    } else {
      // settle bounce on the final symbol
      const s = Math.min((now - anim.stopAt) / anim.settleMs, 1);
      const bounce = Math.cos(s * 10) * Math.exp(-6 * s) * (1 - s);
      const dy = bounce * rect.h * 0.18;
      drawSymbol(
        ctx,
        { ...rect, y: rect.y + dy, cy: rect.cy + dy },
        anim.finalSym,
        { scale: 1, now }
      );
    }
    ctx.restore();
  }

  function drawLaneHints(ctx, layout, now) {
    const pulse = 0.35 + Math.sin(now / 180) * 0.2;
    const lanes = [
      { on: laneHints.left, col: 0, color: P.masa },
      { on: laneHints.mid, col: 1, color: P.collector },
      { on: laneHints.right, col: 2, color: P.masa },
    ];
    for (const lane of lanes) {
      if (!lane.on) continue;
      const top = layout.cellRect(lane.col, 0);
      const bot = layout.cellRect(lane.col, GRID.rows - 1);
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = lane.color;
      ctx.shadowColor = lane.color;
      ctx.shadowBlur = 24;
      roundRect(ctx, top.x - 6, top.y - 6, top.w + 12, bot.y + bot.h - top.y + 12, 16);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawHighlightRing(ctx, rect, color, now) {
    const radius = Math.max(8, rect.w * 0.1);
    ctx.save();
    ctx.lineWidth = Math.max(3, rect.w * 0.04);
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16 + Math.sin(now / 120) * 6;
    roundRect(ctx, rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4, radius);
    ctx.stroke();
    ctx.restore();
  }

  // Draw a single symbol within a cell rect, delegating to the vector art
  // module. `blur` stacks cheap translucent silhouette ghosts so even a still
  // frame reads as a fast-moving reel. sx/sy apply squash about the center.
  function drawSymbol(ctx, rect, sym, { scale = 1, blur = false, now = 0, sx = 1, sy = 1 } = {}) {
    if (!sym) return;
    const cx = rect.cx ?? rect.x + rect.w / 2;
    const cy = rect.cy ?? rect.y + rect.h / 2;

    if (blur) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      drawSymbolArt(ctx, sym, cx, cy - rect.h * 0.34, rect.w, { simple: true });
      drawSymbolArt(ctx, sym, cx, cy + rect.h * 0.34, rect.w, { simple: true });
      ctx.globalAlpha = 0.9;
      drawSymbolArt(ctx, sym, cx, cy, rect.w, { simple: true });
      ctx.restore();
      return;
    }

    const squashed = sx !== 1 || sy !== 1;
    if (squashed) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(sx, sy);
      ctx.translate(-cx, -cy);
    }
    drawSymbolArt(ctx, sym, cx, cy, rect.w, { now, scale, collectorTotal });
    if (squashed) ctx.restore();
  }

  return {
    z: 10,
    draw,
    cells,
    setBoard,
    clearBoard,
    setCellStatic,
    spinBase,
    animate,
    lock,
    highlight,
    clearHighlights,
    setLaneHints,
    setCollectorTotal,
    toSym,
  };
}

// Convert an engine cell to a display sym descriptor.
function toSym(cell) {
  if (!cell) return null;
  if (cell.type === 'coin') return { type: 'coin', symbol: 'COIN', mult: cell.mult, jackpot: cell.jackpot };
  if (cell.type === 'collector') return { type: 'collector', symbol: 'COLLECTOR' };
  if (cell.type === 'regular') return { type: 'regular', symbol: cell.symbol };
  return null;
}

// shared rounded-rect path helper
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// expose jackpot map for any renderer that wants tier values
export { JACKPOTS };
