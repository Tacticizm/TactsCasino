// Base-game line evaluation. Pure: given a grid + bet, returns the list of
// winning lines and the total credit win. Left-to-right matching from col 0.

import { PAYLINES, PAYTABLE, GRID } from './config.js';

// A line wins if the first `n` cells from the left are the same regular symbol
// and that run length has a paytable entry. (No wilds; coins/collectors don't
// participate in line wins.)
export function evaluateLines(grid, bet) {
  const wins = [];
  let total = 0;

  PAYLINES.forEach((line, index) => {
    const first = cellAt(grid, line[0]);
    if (!first || first.type !== 'regular') return;

    const symbol = first.symbol;
    let runLength = 1;
    for (let i = 1; i < line.length; i++) {
      const c = cellAt(grid, line[i]);
      if (c && c.type === 'regular' && c.symbol === symbol) runLength++;
      else break;
    }

    const payRow = PAYTABLE[symbol];
    if (!payRow) return;

    // find the best (longest) qualifying run for this symbol
    let bestLen = 0;
    for (let len = runLength; len >= GRID.cols; len--) {
      if (payRow[len] != null) {
        bestLen = len;
        break;
      }
    }
    if (bestLen === 0) return;

    const amount = payRow[bestLen] * bet;
    total += amount;
    wins.push({
      lineIndex: index,
      symbol,
      length: bestLen,
      amount,
      cells: line.slice(0, bestLen).map(([col, row]) => ({ col, row })),
    });
  });

  return { wins, total };
}

function cellAt(grid, [col, row]) {
  return grid[col] && grid[col][row];
}
