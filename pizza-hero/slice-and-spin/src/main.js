// Bootstraps the game: owns the game loop + state machine and drives the
// renderer/audio in reaction to engine results. The engine decides outcomes;
// this file sequences how they're shown. Animations react to state.

import { createRng } from './engine/rng.js';
import { GRID, KNOBS, THEME, JACKPOTS, COIN_VALUES } from './engine/config.js';
import { spinBaseGame, detectTrigger } from './engine/spin.js';
import { evaluateLines } from './engine/paytable.js';
import { createBonusState, respinStep, collectEntry, coinValue } from './engine/bonus.js';
import { runSimulation, formatReport } from './engine/simulate.js';

import { createMachine, States } from './state/machine.js';
import { createProfile } from './state/profile.js';

import { createRenderer } from './render/canvas.js';
import { createReels, roundRect } from './render/reels.js';
import { createEffects } from './render/effects.js';
import { createHud } from './render/hud.js';
import { createSound } from './audio/sound.js';
import { show as showSplash } from './lib/splash.js';
import './lib/splash.css';

const DEV = import.meta.env?.DEV ?? false;

const canvas = document.getElementById('game');
const hudRoot = document.getElementById('hud');

const rng = createRng();
const profile = createProfile();
const machine = createMachine({ dev: DEV });
const renderer = createRenderer(canvas);
const reels = createReels();
const effects = createEffects();
const hud = createHud(hudRoot);
const sound = createSound();

// ---- background drawable (z below the reels) ----
renderer.add({
  z: -100,
  draw(ctx, layout, now) {
    if (!layout) return;
    const { w, h } = layout;
    const Pp = THEME.palette;

    // warm radial wash
    const g = ctx.createRadialGradient(w / 2, h * 0.12, 40, w / 2, h * 0.55, h * 1.05);
    g.addColorStop(0, '#3a1d10');
    g.addColorStop(0.55, Pp.bg1);
    g.addColorStop(1, Pp.bg0);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // soft vignette for depth
    const vig = ctx.createRadialGradient(w / 2, h * 0.5, h * 0.3, w / 2, h * 0.5, h * 0.78);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    // title with a subtle breathing glow
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = Pp.masa;
    ctx.font = `800 ${Math.min(h * 0.05, 30)}px system-ui, sans-serif`;
    ctx.shadowColor = Pp.ember;
    ctx.shadowBlur = 14 + Math.sin(now / 600) * 6;
    // sit the title in the gap above the cabinet, clear of the jackpot ribbon
    const cabinetTop = layout.boardY - layout.gap * 1.4;
    const titleY = Math.max(layout.headerH * 0.6, cabinetTop - 18);
    ctx.fillText('🍕 SLICE & SPIN', w / 2, titleY);
    ctx.restore();

    // board cabinet: dark plate with a glowing gold bezel
    const bx = layout.boardX - layout.gap * 1.4;
    const by = layout.boardY - layout.gap * 1.4;
    const bw = layout.boardW + layout.gap * 2.8;
    const bh = layout.boardH + layout.gap * 2.8;
    ctx.save();
    roundRect(ctx, bx, by, bw, bh, 22);
    const plate = ctx.createLinearGradient(bx, by, bx, by + bh);
    plate.addColorStop(0, 'rgba(60,28,14,0.7)');
    plate.addColorStop(1, 'rgba(20,10,5,0.7)');
    ctx.fillStyle = plate;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,200,90,0.5)';
    ctx.shadowColor = 'rgba(255,140,40,0.5)';
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.restore();
  },
});

renderer.add(reels);
renderer.add(effects);
renderer.start();

// ---- helpers ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function countUp(from, to, ms, onUpdate) {
  return new Promise((resolve) => {
    const start = performance.now();
    function tick(now) {
      const t = Math.min((now - start) / ms, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      onUpdate(Math.round(from + (to - from) * eased));
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
}

function cellCenter(col, row) {
  const r = renderer.layout.cellRect(col, row);
  return { x: r.cx, y: r.cy };
}

// ---- HUD init ----
let autoplay = false;
const buyEnabled = KNOBS.bonusBuy?.enabled ?? false;
const buyTiers = buyEnabled ? KNOBS.bonusBuy.tiers : [];
const tierById = (id) => buyTiers.find((t) => t.id === id);
const tierCost = (tier) => Math.round(tier.costMult * profile.bet);

function refreshHud() {
  hud.setBalance(profile.balance);
  hud.setBet(profile.bet);
  hud.setJackpots(profile.bet);
  for (const t of buyTiers) hud.setBuyCost(t.id, tierCost(t));
}

// Enable/disable the action controls together; buy buttons also need funds.
function setControlsEnabled(enabled) {
  hud.setSpinEnabled(enabled);
  for (const t of buyTiers) {
    hud.setBuyEnabled(t.id, enabled && profile.balance >= tierCost(t));
  }
}

hud.showBuys(buyEnabled);
refreshHud();
hud.setMuted(profile.muted);
sound.setMuted(profile.muted);

// buy button → confirmation prompt; the actual purchase fires on confirm
hud.on('buy', (tierId) => {
  sound.unlock();
  if (!machine.is(States.IDLE) || effects.isCelebrating()) return;
  const tier = tierById(tierId);
  if (tier) hud.showBuyConfirm(tier, tierCost(tier));
});
hud.on('buyConfirm', (tierId) => {
  if (machine.is(States.IDLE) && !effects.isCelebrating()) startBuyBonus(tierById(tierId));
});

hud.on('bet', (dir) => {
  if (!machine.is(States.IDLE)) return;
  profile.cycleBet(dir);
  refreshHud();
  setControlsEnabled(true); // buy affordability depends on bet
});
hud.on('mute', () => {
  profile.setMuted(!profile.muted);
  hud.setMuted(profile.muted);
  sound.setMuted(profile.muted);
});
hud.on('auto', () => {
  autoplay = !autoplay;
  hud.setAuto(autoplay);
  if (autoplay && machine.is(States.IDLE)) startSpin();
});
hud.on('spin', () => {
  sound.unlock();
  if (machine.is(States.IDLE)) startSpin();
});

// ---- studio splash / entry gate (Pizza Hero bumper, "GAMBLING" tagline) ----
let splashUp = true;
showSplash({
  tagline: 'GAMBLING',
  warning:
    '<b>⚠ High volatility.</b> Wins can be rare but large (max 10,000× bet). ' +
    'Play-money only — for entertainment, no real-money wagering. 18+. Please play responsibly.',
  mount: document.getElementById('stage'), // contain the bumper to the game board
  onDismiss: () => {
    splashUp = false;
    sound.unlock(); // first user gesture — unlock audio
  },
});

// tap anywhere on canvas to spin (mobile-friendly)
canvas.addEventListener('pointerdown', () => {
  sound.unlock();
  if (machine.is(States.IDLE) && !effects.isCelebrating()) startSpin();
});

// keyboard to spin (desktop): Space / Enter to spin, +/- to change bet
document.addEventListener('keydown', (e) => {
  if (splashUp) return; // the splash owns input until dismissed (it self-dismisses)
  if (hud.isModalOpen()) return; // the confirm modal owns the keyboard while open
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    sound.unlock();
    if (machine.is(States.IDLE) && !effects.isCelebrating()) startSpin();
  } else if ((e.key === '+' || e.key === '=') && machine.is(States.IDLE)) {
    profile.cycleBet(+1);
    refreshHud();
    setControlsEnabled(true);
  } else if (e.key === '-' && machine.is(States.IDLE)) {
    profile.cycleBet(-1);
    refreshHud();
    setControlsEnabled(true);
  }
});

// pause audio loop when backgrounded
document.addEventListener('visibilitychange', () => {
  if (document.hidden) sound.stopSpinLoop();
});

// ---- main spin sequence ----
async function startSpin() {
  if (!profile.canBet()) {
    hud.banner('RAISE BET / NO FUNDS');
    return;
  }

  machine.to(States.SPINNING);
  setControlsEnabled(false);
  hud.setWin(0);
  reels.clearHighlights();
  reels.setLaneHints(null);
  profile.placeBet();
  refreshHud();

  const bet = profile.bet;
  const result = spinBaseGame(rng);

  sound.startSpinLoop();
  await reels.spinBase(result.grid, {
    onColumnStop: (col) => {
      sound.reelStop();
      // near-miss anticipation: after the first two columns land, if 2 of 3
      // trigger conditions are already met, glow the missing lane.
      maybeAnticipate(result, col);
    },
  });
  sound.stopSpinLoop();
  reels.setLaneHints(null);

  machine.to(States.EVALUATE);
  await evaluate(result, bet);
}

// Build a grid that's guaranteed to satisfy the bonus trigger: a coin in each
// outer lane (real rolled values) and a collector in the middle lane. Used by
// the bonus-buy and the dev force-bonus helper.
function freshCoin() {
  const { mult, jackpot } = rng.weighted(COIN_VALUES).value;
  return { type: 'coin', symbol: 'COIN', mult, jackpot };
}
function forcedTriggerGrid(collectors = 1) {
  const g = spinBaseGame(rng).grid;
  g[0][rng.int(GRID.rows)] = freshCoin();
  g[2][rng.int(GRID.rows)] = freshCoin();
  // start the middle (collector) lane with `collectors` collectors locked
  for (let r = 0; r < Math.min(collectors, GRID.rows); r++) {
    g[1][r] = { type: 'collector', symbol: 'COLLECTOR' };
  }
  return g;
}

// Bonus buy: pay a premium to drop straight into the Hot Box Bonus with a tier's
// guaranteed collectors. No line wins are paid — you're buying the feature.
async function startBuyBonus(tier) {
  if (!tier) return;
  const cost = tierCost(tier);
  if (profile.balance < cost) {
    hud.banner('NOT ENOUGH BALANCE');
    return;
  }

  machine.to(States.SPINNING);
  setControlsEnabled(false);
  hud.setWin(0);
  reels.clearHighlights();
  reels.setLaneHints(null);
  profile.award(-cost); // charge the buy price
  refreshHud();
  hud.banner(tier.id === 'super' ? 'SUPER BUY!' : 'BONUS BUY!', { ms: 1200 });

  const bet = profile.bet;
  const grid = forcedTriggerGrid(tier.collectors);

  sound.startSpinLoop();
  await reels.spinBase(grid);
  sound.stopSpinLoop();

  machine.to(States.EVALUATE);
  await runBonus({ grid, trigger: detectTrigger(grid) }, bet, 0);
}

// During the staggered stop, highlight the still-spinning lane if it's the last
// one needed to complete the trigger.
function maybeAnticipate(result, stoppedCol) {
  if (stoppedCol < 1) return;
  const t = result.trigger;
  const met = [t.leftOk, t.midOk, t.rightOk].filter(Boolean).length;
  if (met === 2) {
    reels.setLaneHints({ left: !t.leftOk, mid: !t.midOk, right: !t.rightOk });
  }
}

async function evaluate(result, bet) {
  const lines = evaluateLines(result.grid, bet);

  machine.to(States.SHOW_LINE_WINS);
  if (lines.total > 0) {
    // highlight + pay line wins
    for (const win of lines.wins) {
      reels.highlight(win.cells, THEME.palette.masa, 1600);
      for (const c of win.cells) effects.burst(...Object.values(cellCenter(c.col, c.row)), { count: 8 });
    }
    sound.win();
    profile.award(lines.total);
    await countUp(0, lines.total, 700, (v) => hud.setWin(v));
    refreshHud();
    await sleep(500);
  }

  if (result.trigger.met) {
    await runBonus(result, bet, lines.total);
  } else {
    endTurn();
  }
}

// ---- bonus sequence ----
// New mechanic: the middle collector(s) are HELD; the outer lanes respin fresh
// every spin and the collectors bank whatever coins show. A 3-life miss counter
// ends the bonus after three coinless spins in a row.
async function runBonus(result, bet, lineWin) {
  machine.to(States.BONUS_INTRO);
  hud.banner(THEME.labels.bonusName + '!', { ms: 1800 });
  sound.jackpot();

  const state = createBonusState(result.grid, bet);

  // sync the board to the bonus state: hold (lock) the collectors, keep the
  // triggering coins on the outer lanes, clear everything else.
  for (let c = 0; c < GRID.cols; c++)
    for (let r = 0; r < GRID.rows; r++) {
      const cell = state.board[c][r];
      const isCollector = !!cell && cell.type === 'collector';
      reels.setCellStatic(c, r, reels.toSym(cell), isCollector);
      if (isCollector) effects.burst(...Object.values(cellCenter(c, r)), { count: 12, color: THEME.palette.collector });
    }
  sound.lock();

  hud.showBonusPanel(true);
  hud.setRespins(state.lives);
  hud.setBonusTotal(0);
  reels.setCollectorTotal(0); // running total on the center collector(s)
  await sleep(800);

  machine.to(States.HOLD_SPIN);
  machine.to(States.RESPIN);

  let displayedTotal = 0;

  // shared collect animation: beam from every collector to every coin, count up
  async function doCollect(coins) {
    if (!coins.length || !state.collectors.length) return;
    machine.to(States.COLLECT);
    for (const col of state.collectors) {
      const from = cellCenter(col.col, col.row);
      for (const coin of coins) effects.beam(from, cellCenter(coin.col, coin.row));
    }
    sound.collectWhoosh();
    await sleep(240);
    const target = state.bonusTotal;
    const delta = target - displayedTotal;
    if (delta > 0) {
      effects.floatText(renderer.layout.w / 2, renderer.layout.boardY - 8, '+' + Math.round(delta), {
        color: THEME.palette.gold,
      });
    }
    await countUp(displayedTotal, target, 450, (v) => {
      hud.setBonusTotal(v);
      reels.setCollectorTotal(v);
    });
    displayedTotal = target;
    machine.to(States.RESPIN);
  }

  // bank the triggering coins first
  const entry = collectEntry(state);
  await doCollect(entry.coins);
  await sleep(250);

  // spin until three misses in a row
  let guard = 0;
  while (!state.finished && guard++ < 400) {
    const step = respinStep(state, rng);

    // respin both outer lanes fresh to their new coins / blanks
    const list = [];
    for (const c of GRID.coinCols)
      for (let r = 0; r < GRID.rows; r++) list.push({ col: c, row: r, sym: reels.toSym(state.board[c][r]) });

    await reels.animate(list, {
      spinMs: 700,
      stagger: 130,
      settleMs: 300,
      reelPool: 'bonus',
      onCellLand: (col, row, sym) => {
        if (sym) {
          sound.coinLand();
          effects.burst(...Object.values(cellCenter(col, row)), { count: 10, color: THEME.palette.glow });
        }
      },
    });

    if (step.full) hud.banner('FULL HOUSE!', { ms: 1200 });

    if (step.hit) {
      await doCollect(step.coins);
      hud.setRespins(state.lives, { reset: true }); // life counter springs back to 3
      sound.respinReset();
    } else {
      // a miss — a life ticks down
      hud.setRespins(state.lives);
      sound.reelStop();
    }

    await sleep(280);
  }

  // outro / award
  machine.to(States.BONUS_OUTRO);
  const total = state.bonusTotal;
  if (state.capped) {
    hud.banner('MAX WIN!', { ms: 2200 });
    sound.jackpot();
    await sleep(800);
  } else if (state.grandAwarded) {
    hud.banner('GRAND JACKPOT!', { ms: 2000 });
    sound.jackpot();
    await sleep(700);
  }

  const big = total >= bet * 20;
  sound.bigWin();
  await new Promise((resolve) =>
    effects.celebrate(total, {
      title: state.capped ? 'MAX WIN!' : state.grandAwarded ? 'GRAND!' : big ? 'BIG WIN' : THEME.labels.bonusName,
      duration: state.capped || big ? 2.6 : 2.0,
      onDone: resolve,
    })
  );

  machine.to(States.AWARD);
  profile.award(total);
  hud.setWin(lineWin + total);
  refreshHud();
  hud.showBonusPanel(false);
  reels.clearHighlights();
  reels.setCollectorTotal(null); // hide the collector total back in the base game
  endTurn();
}

function endTurn() {
  if (!machine.is(States.IDLE)) machine.to(States.IDLE);
  setControlsEnabled(true);
  if (autoplay) setTimeout(() => machine.is(States.IDLE) && startSpin(), 700);
}

// kick off an initial idle board so the screen isn't empty (already in IDLE)
reels.setBoard(spinBaseGame(rng).grid);
setControlsEnabled(true);

// ---- dev helpers ----
if (DEV) {
  window.__sim = (spins = 100000) => {
    const r = runSimulation({ spins });
    console.log(formatReport(r));
    return r;
  };
  window.__coinValue = coinValue;
  window.__jackpots = JACKPOTS;
  window.__knobs = KNOBS;
  window.__reels = reels; // inspect / drive the reels for visual checks
  // very slow spin of all cells so a mid-spin frame can be inspected
  window.__slowSpin = () => {
    const g = spinBaseGame(rng).grid;
    const list = [];
    for (let c = 0; c < GRID.cols; c++)
      for (let r = 0; r < GRID.rows; r++) list.push({ col: c, row: r, sym: reels.toSym(g[c][r]) });
    return reels.animate(list, { spinMs: 5000, stagger: 600, reelPool: 'base' });
  };
  // Force the bonus (free) — handy for tuning the bonus feel.
  window.__forceBonus = async () => {
    if (!machine.is(States.IDLE)) return 'not idle';
    sound.unlock();
    const g = forcedTriggerGrid();
    machine.to(States.SPINNING);
    setControlsEnabled(false);
    hud.setWin(0);
    refreshHud();
    await reels.spinBase(g);
    machine.to(States.EVALUATE);
    await runBonus({ grid: g, trigger: detectTrigger(g) }, profile.bet, 0);
    return 'bonus done';
  };
  console.log('[dev] __sim(50000) for an RTP report · __forceBonus() to test the bonus.');
}
