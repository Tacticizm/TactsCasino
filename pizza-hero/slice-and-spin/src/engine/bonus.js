// Hot Box Bonus — PURE logic. No rendering. Produces step data the renderer
// animates, and runs to completion for the headless simulator.
//
// Mechanic (spin-collect with a miss counter):
//  - The COLLECTOR(s) in the middle column are HELD for the whole bonus.
//  - The two outer (coin) lanes do NOT hold — they respin fresh every spin.
//  - Each spin, the held collectors bank the value of every coin showing on the
//    outer lanes into the running BONUS TOTAL (compounding by collector count).
//    Coins clear afterwards; the total keeps growing.
//  - A "life" counter starts at 3. A spin with ≥1 coin (a hit) resets it to 3;
//    a coinless spin (a miss) drops it by one. Three misses in a row ends it.
//  - A single spin that fills all 6 outer cells with coins awards GRAND.
//
// Board model: board[col][row]. Middle column holds collectors ({type:'collector'})
// for the whole bonus; outer columns hold the current spin's coins ({type:'coin',
// mult, jackpot}) or null.

import { GRID, KNOBS, BONUS_REEL_WEIGHTS, COIN_VALUES, JACKPOTS } from './config.js';

const OUTER_CELLS = GRID.coinCols.length * GRID.rows; // 6

// Credit value of a single coin (face value + any jackpot tag), in credits.
export function coinValue(coin, bet) {
  let v = (coin.mult || 0) * bet;
  if (coin.jackpot && JACKPOTS[coin.jackpot] != null) v += JACKPOTS[coin.jackpot] * bet;
  return v;
}

// Build the initial bonus state: hold the middle collectors, keep the triggering
// coins on the outer lanes (collected once on entry), everything else empty.
export function createBonusState(baseGrid, bet) {
  const board = [];
  const collectors = [];
  for (let col = 0; col < GRID.cols; col++) {
    const column = [];
    for (let row = 0; row < GRID.rows; row++) {
      const cell = baseGrid[col][row];
      if (cell.type === 'collector' && col === GRID.collectorCol) {
        column.push({ type: 'collector', justLanded: true });
        collectors.push({ col, row });
      } else if (cell.type === 'coin' && GRID.coinCols.includes(col)) {
        column.push({ type: 'coin', mult: cell.mult, jackpot: cell.jackpot, justLanded: true });
      } else {
        column.push(null);
      }
    }
    board.push(column);
  }

  return {
    board,
    bet,
    collectors, // held for the whole bonus
    lives: KNOBS.respinsOnReset, // miss counter (resets to this on a hit)
    bonusTotal: 0,
    maxWin: KNOBS.maxWinMult ? KNOBS.maxWinMult * bet : Infinity,
    capped: false,
    jackpotsWon: [], // jackpot tags collected (incl. 'GRAND')
    grandAwarded: false,
    finished: false,
    stepCount: 0,
  };
}

function outerCoins(board) {
  const coins = [];
  for (const c of GRID.coinCols)
    for (let r = 0; r < GRID.rows; r++) {
      const cell = board[c][r];
      if (cell && cell.type === 'coin') coins.push({ col: c, row: r, coin: cell });
    }
  return coins;
}

function clearOuter(board) {
  for (const c of GRID.coinCols) for (let r = 0; r < GRID.rows; r++) board[c][r] = null;
}

function rollOuterCoin(rng) {
  const pick = rng.weighted(BONUS_REEL_WEIGHTS.outer).value;
  if (pick === 'COIN') {
    const { mult, jackpot } = rng.weighted(COIN_VALUES).value;
    return { type: 'coin', mult, jackpot };
  }
  return null; // BLANK
}

// Bank the coins currently on the outer lanes (× collector count). Used both for
// the entry/trigger coins and after each respin. Jackpot tags (incl. GRAND) ride
// on the coins, so they're banked here too.
function bank(state) {
  const coins = outerCoins(state.board);
  const coinSum = coins.reduce((s, x) => s + coinValue(x.coin, state.bet), 0);
  const collected = coinSum * state.collectors.length;
  state.bonusTotal += collected;
  for (const x of coins) {
    if (x.coin.jackpot) {
      state.jackpotsWon.push(x.coin.jackpot);
      if (x.coin.jackpot === 'GRAND') state.grandAwarded = true;
    }
  }
  return { coins, coinSum, collected };
}

// Collect the triggering coins already on the board (no spin). Call once on entry.
export function collectEntry(state) {
  const { coins, coinSum, collected } = bank(state);
  return {
    landed: coins.map((x) => ({ col: x.col, row: x.row, cell: x.coin })),
    coins,
    coinSum,
    collected,
    collectors: state.collectors,
    bonusTotal: state.bonusTotal,
    lives: state.lives,
    entry: true,
  };
}

// Advance the bonus by exactly one spin: respin both outer lanes, bank, update
// the miss counter. Mutates `state`. Call only while !state.finished.
export function respinStep(state, rng) {
  const { board } = state;
  state.stepCount++;

  // 1) outer lanes don't hold — clear and respin them fresh
  clearOuter(board);
  const landed = [];
  for (const c of GRID.coinCols) {
    for (let r = 0; r < GRID.rows; r++) {
      const coin = rollOuterCoin(rng);
      if (coin) {
        coin.justLanded = true;
        board[c][r] = coin;
        landed.push({ col: c, row: r, cell: coin });
      }
    }
  }

  // 2) the held collectors bank this spin's coins (jackpot tags banked too)
  const { coins, coinSum, collected } = bank(state);

  // a full screen of coins is a nice flourish (no extra award — GRAND rides on
  // coins as a tag, like the other jackpots)
  const full = coins.length === OUTER_CELLS;

  // 3) miss counter: hit (≥1 coin) resets to 3, otherwise lose a life
  const hit = landed.length > 0;
  if (hit) state.lives = KNOBS.respinsOnReset;
  else state.lives -= 1;
  if (state.lives <= 0) state.finished = true;

  // 4) hard max-win cap: clamp the total and end the bonus if reached
  if (state.bonusTotal >= state.maxWin) {
    state.bonusTotal = state.maxWin;
    state.capped = true;
    state.finished = true;
  }

  return {
    landed,
    coins,
    coinSum,
    collected,
    hit,
    lives: state.lives,
    bonusTotal: state.bonusTotal,
    full,
    capped: state.capped,
    finished: state.finished,
    collectors: state.collectors,
  };
}

// Run the whole bonus to completion (headless): bank the entry coins, then spin
// until three misses in a row. Returns the final state and the step list.
export function runBonus(state, rng) {
  const steps = [];
  collectEntry(state);
  let guard = 0;
  while (!state.finished && guard++ < 5000) {
    steps.push(respinStep(state, rng));
  }
  return { state, steps };
}
