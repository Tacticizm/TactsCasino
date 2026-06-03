// Headless balancing harness. Runs with zero rendering. Use it to read the
// game's math: base-game hit rate, bonus trigger rate, average bonus payout,
// and an estimated overall RTP.
//
//   node src/engine/simulate.js            # default run
//   node src/engine/simulate.js 200000     # custom base-spin count
//
// Also exported as runSimulation() so a hidden dev button can call it in-browser.

import { createRng } from './rng.js';
import { spinBaseGame } from './spin.js';
import { evaluateLines } from './paytable.js';
import { createBonusState, runBonus } from './bonus.js';
import { KNOBS } from './config.js';

export function runSimulation({ spins = 100000, bonusSamples = 20000, seed = 12345 } = {}) {
  const bet = KNOBS.betLevels[KNOBS.defaultBetIndex];

  // --- base game pass ---
  const rng = createRng(seed);
  let lineWinTotal = 0;
  let lineHits = 0;
  let triggers = 0;
  let triggeredBonusReturn = 0; // bonus payout from real triggers (already bet-paid)

  for (let i = 0; i < spins; i++) {
    const { grid, trigger } = spinBaseGame(rng);
    const { total } = evaluateLines(grid, bet);
    if (total > 0) {
      lineHits++;
      lineWinTotal += total;
    }
    if (trigger.met) {
      triggers++;
      const state = createBonusState(grid, bet);
      runBonus(state, rng);
      triggeredBonusReturn += state.bonusTotal;
    }
  }

  const totalBet = spins * bet;
  const baseHitRate = lineHits / spins;
  const triggerRate = triggers / spins;
  const lineRtp = lineWinTotal / totalBet;
  const bonusRtp = triggeredBonusReturn / totalBet;
  const totalRtp = lineRtp + bonusRtp;

  // --- dedicated bonus passes (forced triggers) per starting-collector count.
  // This both gives a clean avg payout for the naturally-triggered bonus (1
  // collector) and prices the bonus-buy tiers (1 and 3 collectors). ---
  const buyTiers = [1, 3];
  const buyStats = {};
  for (const collectors of buyTiers) {
    const brng = createRng((seed ^ 0x9e3779b9) + collectors * 2654435761);
    let ret = 0;
    let steps = 0;
    let full = 0;
    for (let i = 0; i < bonusSamples; i++) {
      const grid = forcedTriggerGrid(brng, collectors);
      const state = createBonusState(grid, bet);
      const r = runBonus(state, brng);
      ret += state.bonusTotal;
      steps += r.steps.length;
      if (state.grandAwarded) full++;
    }
    buyStats[collectors] = {
      avgMult: ret / bonusSamples / bet, // avg return in × bet
      avgSteps: steps / bonusSamples,
      fullRate: full / bonusSamples,
    };
  }

  const avgBonusMult = buyStats[1].avgMult;
  const avgBonusPayout = avgBonusMult * bet;
  const avgBonusSteps = buyStats[1].avgSteps;
  const fullBoardRate = buyStats[1].fullRate;

  // suggested buy price = avg return / target RTP (≈ base-game RTP)
  const targetRtp = 0.96;
  const suggestBuy = (m) => Math.round(m / targetRtp / 5) * 5;

  return {
    config: { spins, bonusSamples, bet, triggerDifficulty: KNOBS.triggerDifficulty },
    baseHitRate,
    triggerRate,
    triggerOneIn: triggerRate > 0 ? 1 / triggerRate : Infinity,
    lineRtp,
    bonusRtp,
    totalRtp,
    avgBonusPayout,
    avgBonusMult,
    avgBonusSteps,
    fullBoardRate,
    buy: {
      regular: { collectors: 1, ...buyStats[1], suggestCostMult: suggestBuy(buyStats[1].avgMult) },
      super: { collectors: 3, ...buyStats[3], suggestCostMult: suggestBuy(buyStats[3].avgMult) },
    },
  };
}

// A board that satisfies the trigger but is otherwise empty of value bias —
// coins get fresh values rolled inside createBonusState path via spin? No: we
// build coins directly so the forced sample reflects the bonus engine only.
function forcedTriggerGrid(rng, collectors = 1) {
  const blank = { type: 'regular', symbol: 'OLIVE' };
  const grid = [
    [blank, blank, blank],
    [blank, blank, blank],
    [blank, blank, blank],
  ];
  // one coin in each outer col + `collectors` collectors in the middle col
  grid[0][rng.int(3)] = freshCoin(rng);
  grid[2][rng.int(3)] = freshCoin(rng);
  for (let r = 0; r < Math.min(collectors, 3); r++) grid[1][r] = { type: 'collector' };
  return grid;
}

function freshCoin(rng) {
  // mirror spin.js coin roll
  const COIN_VALUES = [
    { value: { mult: 1, jackpot: null }, weight: 30 },
    { value: { mult: 2, jackpot: null }, weight: 22 },
    { value: { mult: 3, jackpot: null }, weight: 16 },
    { value: { mult: 5, jackpot: null }, weight: 10 },
    { value: { mult: 8, jackpot: null }, weight: 6 },
    { value: { mult: 12, jackpot: null }, weight: 4 },
    { value: { mult: 20, jackpot: null }, weight: 2 },
    { value: { mult: 0, jackpot: 'MINI' }, weight: 6 },
    { value: { mult: 0, jackpot: 'MINOR' }, weight: 3 },
    { value: { mult: 0, jackpot: 'MAJOR' }, weight: 1 },
  ];
  const { mult, jackpot } = rng.weighted(COIN_VALUES).value;
  return { type: 'coin', mult, jackpot };
}

function fmtPct(x) {
  return (x * 100).toFixed(2) + '%';
}

export function formatReport(r) {
  const L = [];
  L.push('=== Slice & Spin — simulation report ===');
  L.push(`spins: ${r.config.spins.toLocaleString()}   bet: ${r.config.bet}   difficulty: ${r.config.triggerDifficulty}`);
  L.push('');
  L.push(`base-game line hit rate : ${fmtPct(r.baseHitRate)}`);
  L.push(`bonus trigger rate      : ${fmtPct(r.triggerRate)}  (~1 in ${r.triggerOneIn.toFixed(0)})`);
  L.push('');
  L.push(`line RTP                : ${fmtPct(r.lineRtp)}`);
  L.push(`bonus RTP               : ${fmtPct(r.bonusRtp)}`);
  L.push(`ESTIMATED TOTAL RTP     : ${fmtPct(r.totalRtp)}`);
  L.push('');
  L.push(`avg bonus payout        : ${r.avgBonusPayout.toFixed(1)} credits  (${r.avgBonusMult.toFixed(1)}x bet)`);
  L.push(`avg respins per bonus    : ${r.avgBonusSteps.toFixed(1)}`);
  L.push(`full-board (GRAND) rate : ${fmtPct(r.fullBoardRate)}`);
  L.push('');
  L.push('--- bonus buy pricing (avg return in × bet) ---');
  L.push(
    `regular (1 collector)   : ${r.buy.regular.avgMult.toFixed(1)}x  → suggest cost ${r.buy.regular.suggestCostMult}x  (full-board ${fmtPct(r.buy.regular.fullRate)})`
  );
  L.push(
    `super   (3 collectors)  : ${r.buy.super.avgMult.toFixed(1)}x  → suggest cost ${r.buy.super.suggestCostMult}x  (full-board ${fmtPct(r.buy.super.fullRate)})`
  );
  return L.join('\n');
}

// Run directly via `node src/engine/simulate.js [spins]`
const isMain =
  typeof process !== 'undefined' &&
  process.argv &&
  process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').endsWith('engine/simulate.js');

if (isMain) {
  const spins = Number(process.argv[2]) || 100000;
  const report = runSimulation({ spins });
  console.log(formatReport(report));
}
