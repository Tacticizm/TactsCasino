// ============================================================================
//  CONFIG — every payout-affecting number lives here. Tune the game by editing
//  this file only; logic never hard-codes a payout. The "open knobs" the spec
//  calls out are all near the top.
// ============================================================================

// ---- OPEN KNOBS (the things you'll most likely want to change) -------------

export const KNOBS = {
  // The "spins left" miss counter: starts here, resets here on a hit, and the
  // bonus ends when it reaches 0 (this many coinless spins in a row).
  respinsOnReset: 3,

  // Hard max-win cap as a multiple of bet. If a bonus reaches it, the total is
  // capped and the bonus ends. Set to 0/null for no cap.
  maxWinMult: 10000,

  // Trigger difficulty. Higher = rarer bonus. This scales the COIN/COLLECTOR
  // weights on the base reels (see baseReelWeights below). 1.0 = as authored.
  triggerDifficulty: 1.0,

  // Bet levels (credits). Index into this for the bet selector.
  betLevels: [10, 25, 50, 100, 250],
  defaultBetIndex: 1,

  startingBalance: 1000,

  // Bonus buy: pay a multiple of the bet to trigger the Hot Box Bonus instantly.
  // Two tiers — `collectors` is how many collectors the board starts locked with.
  // Costs come straight from the simulator's buy-pricing pass (run `npm run
  // simulate`): avg return ≈ 85x (1 collector) and ≈ 173x (3 collectors), priced
  // at ~96% return. Tune costMult to taste, or set enabled:false to hide.
  bonusBuy: {
    enabled: true,
    tiers: [
      { id: 'regular', label: 'BUY BONUS', collectors: 1, costMult: 65 },
      { id: 'super', label: 'SUPER BUY', collectors: 3, costMult: 190 },
    ],
  },
};

// ---- GRID ------------------------------------------------------------------

export const GRID = {
  cols: 3,
  rows: 3,
  // Lane semantics: middle column is the collector lane, outer columns are
  // coin lanes. These indices are referenced by the trigger + bonus logic.
  collectorCol: 1,
  coinCols: [0, 2],
};

// ---- SYMBOLS ---------------------------------------------------------------
// Each symbol: id, artKey (for swapping sprites later), label (placeholder
// glyph/emoji), and a tier used only by regular line symbols.

export const SYMBOLS = {
  // regular line symbols (base game)
  SLICE: { id: 'SLICE', artKey: 'sym_slice', label: '🍕', kind: 'regular' },
  PEPPER: { id: 'PEPPER', artKey: 'sym_pepper', label: '🌶️', kind: 'regular' },
  MUSHROOM: { id: 'MUSHROOM', artKey: 'sym_mushroom', label: '🍄', kind: 'regular' },
  CHEESE: { id: 'CHEESE', artKey: 'sym_cheese', label: '🧀', kind: 'regular' },
  SODA: { id: 'SODA', artKey: 'sym_soda', label: '🥤', kind: 'regular' },
  OLIVE: { id: 'OLIVE', artKey: 'sym_olive', label: '🫒', kind: 'regular' },

  // special symbols
  COIN: { id: 'COIN', artKey: 'sym_coin', label: '🍕💰', kind: 'coin' },
  COLLECTOR: { id: 'COLLECTOR', artKey: 'sym_collector', label: '📦', kind: 'collector' },
  BLANK: { id: 'BLANK', artKey: 'sym_blank', label: '', kind: 'blank' },
};

// ---- PAYTABLE (base game line wins) ----------------------------------------
// Payout is a multiplier of the bet, keyed by symbol id and match-length
// (3-of-a-kind left-to-right on a payline; min length 3 on a 3-wide grid).

export const PAYTABLE = {
  SLICE: { 3: 5 },
  PEPPER: { 3: 4 },
  MUSHROOM: { 3: 3 },
  CHEESE: { 3: 2.5 },
  SODA: { 3: 2 },
  OLIVE: { 3: 1.5 },
  // COIN pays nothing on a line — it only matters for the bonus trigger.
};

// ---- PAYLINES --------------------------------------------------------------
// Data-driven. Each line is an array of [col, row] for col 0..2. Default 5:
// 3 horizontal rows + 2 diagonals. Left-to-right evaluation starts at col 0.

export const PAYLINES = [
  [[0, 0], [1, 0], [2, 0]], // top row
  [[0, 1], [1, 1], [2, 1]], // middle row
  [[0, 2], [1, 2], [2, 2]], // bottom row
  [[0, 0], [1, 1], [2, 2]], // diagonal ↘
  [[0, 2], [1, 1], [2, 0]], // diagonal ↗
];

// ---- BASE REEL WEIGHTS -----------------------------------------------------
// Per-column symbol weights for the base game. The middle column is the only
// place a COLLECTOR appears; the outer columns are where COINs appear. This is
// what makes the trigger geometry real. COIN/COLLECTOR weights are scaled by
// triggerDifficulty at read time (see getBaseReelWeights()).

const BASE_REEL_WEIGHTS = {
  // outer coin columns (0 and 2)
  outer: [
    { value: 'SLICE', weight: 8 },
    { value: 'PEPPER', weight: 10 },
    { value: 'MUSHROOM', weight: 12 },
    { value: 'CHEESE', weight: 14 },
    { value: 'SODA', weight: 16 },
    { value: 'OLIVE', weight: 18 },
    { value: 'COIN', weight: 7 }, // scaled by difficulty
  ],
  // middle collector column (1)
  middle: [
    { value: 'SLICE', weight: 10 },
    { value: 'PEPPER', weight: 12 },
    { value: 'MUSHROOM', weight: 14 },
    { value: 'CHEESE', weight: 16 },
    { value: 'SODA', weight: 18 },
    { value: 'OLIVE', weight: 20 },
    { value: 'COLLECTOR', weight: 6 }, // scaled by difficulty
  ],
};

// Returns the weight table for a given column index, with COIN/COLLECTOR
// weights divided by triggerDifficulty (higher difficulty -> rarer).
export function getBaseReelWeights(col) {
  const src = col === GRID.collectorCol ? BASE_REEL_WEIGHTS.middle : BASE_REEL_WEIGHTS.outer;
  const d = KNOBS.triggerDifficulty || 1;
  return src.map((e) =>
    e.value === 'COIN' || e.value === 'COLLECTOR'
      ? { value: e.value, weight: e.weight / d }
      : { value: e.value, weight: e.weight }
  );
}

// ---- COIN VALUE DISTRIBUTION ----------------------------------------------
// When a COIN lands (base trigger or bonus respin), roll its credit value
// and optional jackpot tag from here. Values are multipliers of the bet.

export const COIN_VALUES = [
  { value: { mult: 3, jackpot: null }, weight: 44 },
  { value: { mult: 5, jackpot: null }, weight: 24 },
  { value: { mult: 7, jackpot: null }, weight: 12 },
  { value: { mult: 12, jackpot: null }, weight: 6 },
  { value: { mult: 18, jackpot: null }, weight: 3 },
  { value: { mult: 30, jackpot: null }, weight: 1.5 },
  { value: { mult: 50, jackpot: null }, weight: 0.5 },
  { value: { mult: 0, jackpot: 'MINI' }, weight: 5 },
  { value: { mult: 0, jackpot: 'MINOR' }, weight: 1.5 },
  { value: { mult: 0, jackpot: 'MAJOR' }, weight: 0.4 },
  { value: { mult: 0, jackpot: 'GRAND' }, weight: 0.08 },
];

// ---- BONUS RESPIN WEIGHTS --------------------------------------------------
// During the bonus, each empty unlocked cell respins. Outer cells can land a
// COIN or BLANK; the middle cell can land a COLLECTOR or BLANK. Tune the
// land-rate (and therefore bonus length / value) here.

export const BONUS_REEL_WEIGHTS = {
  outer: [
    { value: 'COIN', weight: 10.3 },
    { value: 'BLANK', weight: 89.7 },
  ],
  // (middle is no longer respun in the bonus — collectors are held — but kept
  // here for completeness / future tuning.)
  middle: [
    { value: 'COLLECTOR', weight: 2.8 },
    { value: 'BLANK', weight: 97.2 },
  ],
};

// ---- JACKPOTS --------------------------------------------------------------
// MINI/MINOR/MAJOR are carried as tags on coins; their value (mult of bet) is
// added when that coin is collected. GRAND is awarded only on a full board.

export const JACKPOTS = {
  MINI: 8,
  MINOR: 20,
  MAJOR: 60,
  GRAND: 150,
};

// ---- THEME -----------------------------------------------------------------
// All player-facing strings/colors/art keys. Reskin here without touching logic.

export const THEME = {
  name: 'Pizza Delivery',
  palette: {
    bg0: '#1a0e08',
    bg1: '#2b160c',
    ember: '#ff5722',
    red: '#c0392b',
    masa: '#f4b73f',
    gold: '#ffd24a',
    cream: '#fff3da',
    cell: '#3a2114',
    cellLocked: '#4d2a16',
    glow: '#ffcf5c',
    collector: '#7ec8e3',
    text: '#fff3da',
    shadow: 'rgba(0,0,0,0.45)',
  },
  labels: {
    coin: 'Pizza Coin',
    collector: 'Delivery Box',
    bonusName: 'HOT BOX BONUS',
    spin: 'SPIN',
  },
  art: {
    // art keys map to the placeholder glyphs in SYMBOLS for now; swap to real
    // sprite paths later (relative paths for Capacitor).
  },
};

// Convenience: ordered list of jackpot tiers for HUD display.
export const JACKPOT_TIERS = ['MINI', 'MINOR', 'MAJOR', 'GRAND'];
