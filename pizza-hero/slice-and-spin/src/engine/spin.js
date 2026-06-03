// Produces a base-spin RESULT as pure data. No DOM, no canvas. Given an RNG and
// the bet, returns a 3x3 grid of cells plus derived trigger info.
//
// A cell is one of:
//   { type: 'regular',  symbol: <id> }
//   { type: 'coin',     symbol: 'COIN', mult, jackpot }   // mult = x of bet
//   { type: 'collector',symbol: 'COLLECTOR' }
//
// grid is indexed grid[col][row].

import { GRID, getBaseReelWeights, COIN_VALUES } from './config.js';

function rollCoin(rng) {
  const { mult, jackpot } = rng.weighted(COIN_VALUES).value;
  return { type: 'coin', symbol: 'COIN', mult, jackpot };
}

function rollCell(rng, col) {
  const pick = rng.weighted(getBaseReelWeights(col)).value;
  if (pick === 'COIN') return rollCoin(rng);
  if (pick === 'COLLECTOR') return { type: 'collector', symbol: 'COLLECTOR' };
  return { type: 'regular', symbol: pick };
}

export function spinBaseGame(rng) {
  const grid = [];
  for (let col = 0; col < GRID.cols; col++) {
    const column = [];
    for (let row = 0; row < GRID.rows; row++) {
      column.push(rollCell(rng, col));
    }
    grid.push(column);
  }

  return { grid, trigger: detectTrigger(grid) };
}

// The signature rule: COIN in left col AND COIN in right col AND COLLECTOR in
// middle col. Returns a structured object so the renderer can highlight lanes.
export function detectTrigger(grid) {
  const coinsLeft = cellsOfType(grid, 0, 'coin');
  const coinsRight = cellsOfType(grid, 2, 'coin');
  const collectorsMid = cellsOfType(grid, GRID.collectorCol, 'collector');

  const leftOk = coinsLeft.length >= 1;
  const rightOk = coinsRight.length >= 1;
  const midOk = collectorsMid.length >= 1;

  return {
    met: leftOk && rightOk && midOk,
    leftOk,
    rightOk,
    midOk,
    coinsLeft,
    coinsRight,
    collectorsMid,
    // count of conditions satisfied — used for near-miss anticipation
    conditionsMet: [leftOk, rightOk, midOk].filter(Boolean).length,
  };
}

// Returns array of {col,row} positions in a column matching a cell type.
function cellsOfType(grid, col, type) {
  const out = [];
  for (let row = 0; row < GRID.rows; row++) {
    if (grid[col][row].type === type) out.push({ col, row });
  }
  return out;
}
