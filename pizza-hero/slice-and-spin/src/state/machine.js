// Finite state machine for the whole game flow. Transitions are explicit and
// logged in dev mode. The renderer REACTS to state — it never drives it.
//
//   IDLE → SPINNING → EVALUATE
//      → (no trigger) → SHOW_LINE_WINS → IDLE
//      → (trigger)    → BONUS_INTRO → HOLD_SPIN → RESPIN
//            → COLLECT → (new lock) reset → RESPIN
//            → (respins 0 OR full) → BONUS_OUTRO → AWARD → IDLE

export const States = {
  IDLE: 'IDLE',
  SPINNING: 'SPINNING',
  EVALUATE: 'EVALUATE',
  SHOW_LINE_WINS: 'SHOW_LINE_WINS',
  BONUS_INTRO: 'BONUS_INTRO',
  HOLD_SPIN: 'HOLD_SPIN',
  RESPIN: 'RESPIN',
  COLLECT: 'COLLECT',
  BONUS_OUTRO: 'BONUS_OUTRO',
  AWARD: 'AWARD',
};

// Allowed transitions. Keeps illegal jumps from sneaking in.
const TRANSITIONS = {
  IDLE: ['SPINNING'],
  SPINNING: ['EVALUATE'],
  EVALUATE: ['SHOW_LINE_WINS', 'BONUS_INTRO'],
  SHOW_LINE_WINS: ['IDLE', 'BONUS_INTRO'],
  BONUS_INTRO: ['HOLD_SPIN'],
  HOLD_SPIN: ['RESPIN'],
  RESPIN: ['COLLECT', 'BONUS_OUTRO'],
  COLLECT: ['RESPIN', 'BONUS_OUTRO'],
  BONUS_OUTRO: ['AWARD'],
  AWARD: ['IDLE'],
};

export function createMachine({ dev = false } = {}) {
  let state = States.IDLE;
  const listeners = new Set();

  function set(next) {
    const allowed = TRANSITIONS[state] || [];
    if (!allowed.includes(next)) {
      // not fatal — log loudly in dev so we catch flow bugs
      if (dev) console.warn(`[FSM] illegal transition ${state} → ${next}`);
    }
    const prev = state;
    state = next;
    if (dev) console.log(`[FSM] ${prev} → ${next}`);
    for (const fn of listeners) fn(next, prev);
  }

  return {
    get state() {
      return state;
    },
    is(s) {
      return state === s;
    },
    to(next) {
      set(next);
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
