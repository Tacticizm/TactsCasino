// Player profile: balance + selected bet, persisted via storage.js. Also holds
// the mute flag. Pure-ish state holder with explicit mutators.

import { storage } from './storage.js';
import { KNOBS } from '../engine/config.js';

export function createProfile() {
  const balance = storage.get('balance', KNOBS.startingBalance);
  const betIndex = clampBetIndex(storage.get('betIndex', KNOBS.defaultBetIndex));
  const muted = storage.get('muted', false);

  const profile = {
    balance,
    betIndex,
    muted,

    get bet() {
      return KNOBS.betLevels[this.betIndex];
    },

    canBet() {
      return this.balance >= this.bet;
    },

    placeBet() {
      this.balance -= this.bet;
      this._persist();
    },

    award(amount) {
      this.balance += amount;
      this._persist();
    },

    setBetIndex(i) {
      this.betIndex = clampBetIndex(i);
      storage.set('betIndex', this.betIndex);
    },

    cycleBet(dir) {
      this.setBetIndex(this.betIndex + dir);
    },

    setMuted(m) {
      this.muted = !!m;
      storage.set('muted', this.muted);
    },

    // Balance is owned by the parent casino — never auto-refill.
    topUpIfBroke() {
      return false;
    },

    _persist() {
      storage.set('balance', this.balance);
    },
  };

  return profile;
}

function clampBetIndex(i) {
  const max = KNOBS.betLevels.length - 1;
  if (i < 0) return 0;
  if (i > max) return max;
  return i;
}
