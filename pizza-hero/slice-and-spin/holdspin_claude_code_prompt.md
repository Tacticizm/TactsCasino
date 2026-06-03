# Claude Code Prompt — 3×3 "Hold & Spin" Slot Game

> Paste everything below into Claude Code. It's written as direct instructions to you, Claude Code.

---

## Project overview

Build a **professional 3×3 "hold and spin" (hold-and-win) slot game** for the browser, in the polished style of providers like 3 Oaks Gaming / Pragmatic Play Hold & Win. Single studio: **Pizza Hero Gaming**.

The signature hook is the **bonus trigger**: on a base spin, the player must land **at least one COIN in the left column AND at least one COIN in the right column AND a COLLECTOR in the middle column** — all three at once — to launch the hold-and-spin bonus. The board geometry is the mechanic: the **middle column is the collector lane**, the **two outer columns are the coin lanes**.

Quality bar: satisfying reel spin with easing/overshoot, coins that thunk + glow + lock, a collector "vacuum" animation, a respin counter that flashes on reset, jackpot reveals, and a count-up win celebration. It should *feel* like a real slot, not a prototype.

---

## Tech stack & setup

- **Vite** project, **vanilla JavaScript** (no framework). TypeScript can come later.
- **ESLint + Prettier** configured.
- **Canvas 2D** for the reels, symbols, and effects. (Note PixiJS as a future upgrade path for WebGL/particles, but do NOT add it now — keep dependencies minimal.)
- A proper **README.md** with run/build instructions.
- Relative asset paths everywhere (this will be wrapped for mobile/store later via Capacitor).
- No browser-only APIs in the game core. Keep persistence (localStorage for balance/jackpot seeds) isolated behind a thin storage module so it can be swapped.

---

## Core architecture (do this part carefully — it's what makes it professional)

**Hard rule: separate game MATH from PRESENTATION.** The simulation must be able to run with zero rendering so we can tune payout by running thousands of spins headless.

Suggested module layout:

```
src/
  main.js                # bootstraps, owns the game loop + state machine
  engine/
    rng.js               # seedable RNG (mulberry32 or similar) — all randomness routes through here
    config.js            # ALL tunable numbers: symbol weights, coin value table, jackpot values, paylines, respin count
    paytable.js          # base-game line evaluation
    spin.js              # produces a spin RESULT (pure data) from weights — no DOM/canvas
    bonus.js             # pure logic for the hold-and-spin: respins, locks, collector math, end conditions
    simulate.js          # headless harness: run N base spins / N bonuses, report hit rate, avg return, RTP estimate
  render/
    canvas.js            # canvas setup, responsive scaling
    reels.js             # reel/symbol drawing + spin animation
    effects.js           # glow, lock pulse, collector beam, particles, count-up
    hud.js               # balance, bet, win, respins, jackpot tiers
  audio/
    sound.js             # Web Audio: spin loop, coin land, lock, collect whoosh, jackpot, big-win
  state/
    machine.js           # finite state machine (states below)
    profile.js           # balance, persisted via storage.js
    storage.js           # localStorage wrapper, isolated
  assets/                # symbol art slots (placeholders ok to start)
```

**Finite state machine** (`state/machine.js`) — the whole game flows through these:

```
IDLE → SPINNING → EVALUATE
   → (no trigger) → SHOW_LINE_WINS → IDLE
   → (trigger met) → BONUS_INTRO → HOLD_SPIN → RESPIN
         → COLLECT (when a collector is on board)
         → (new lock) → reset respins → RESPIN
         → (respins == 0 OR board full) → BONUS_OUTRO → AWARD → IDLE
```

Make state transitions explicit and logged in dev mode. Animations are driven by the renderer reacting to state, never the other way around.

---

## The grid & symbols

- **Grid:** 3 columns × 3 rows = 9 cells. Index as `[col][row]`, col 0 = left, col 1 = middle, col 2 = right.
- **Symbol types:**
  - **Regular symbols** (4–6 of them) for base-game line wins. Themed (see Theme section).
  - **COIN** — a money symbol carrying a credit value, and optionally a jackpot tag (MINI / MINOR / MAJOR).
  - **COLLECTOR** — appears primarily in the middle column; performs the collect action in the bonus.

Define everything as data in `config.js`: each symbol has an id, art key, weight (per reel / per phase), and (for coins) a value distribution.

---

## Base game

- Player sets a **bet** (a few configurable bet levels). Spin deducts bet from balance.
- Reels spin and stop column-by-column with staggered timing and a slight overshoot/bounce ease-out.
- **Line wins:** support configurable paylines. Default to **5 lines**: 3 horizontal rows + 2 diagonals. Make line count/shape data-driven in `config.js`. Evaluate in `paytable.js` (left-to-right matching from col 0).
- After evaluation, check the **bonus trigger** (next section). If triggered, line wins still pay, then transition into the bonus.

---

## Bonus trigger (the signature rule)

On a completed base spin, trigger the hold-and-spin bonus **if and only if all three are true**:

1. Left column (col 0) contains **≥ 1 COIN**
2. Right column (col 2) contains **≥ 1 COIN**
3. Middle column (col 1) contains **≥ 1 COLLECTOR**

When triggered: play a build-up/anticipation cue, dim the base-game background, lock the qualifying coins and the collector in place, and enter `BONUS_INTRO`.

Make the trigger frequency tunable via the COIN/COLLECTOR weights in `config.js`. (Aim for a satisfying-but-not-constant hit; expose a single difficulty knob if practical.)

---

## Hold & Spin bonus mechanic

This is the centerpiece. Implement in `bonus.js` as pure logic.

- The board functionally splits into lanes:
  - **Middle column = COLLECTOR lane.**
  - **Left + right columns = COIN lanes** (6 coin positions total).
- On entry, the triggering coins and collector are **locked**.
- **Respins counter starts at 3.**
- Each respin, every **empty unlocked** cell spins:
  - Side-column cells can land a **COIN** (with value / jackpot tag) or **blank**.
  - Middle-column cells can land a **COLLECTOR** or **blank**.
- **Any new COIN or COLLECTOR that lands locks in place and resets the respin counter to 3.** (Blanks do not reset.)
- **End conditions:** respins reach 0 **OR** all 9 cells are filled (locked). On a full board, award the **GRAND** jackpot on top of the total.

### The collect action (compounding — the fun part)

- **Default behavior:** each respin, for every COLLECTOR currently on the board, sum the face values of **all coins currently on the board** and add that sum to the running **BONUS TOTAL**. Multiple collectors = multiple collects in the same respin. So coins + collectors compound the payout fast.
- Animate it: a beam/vacuum from each collector sweeping each coin, coin values popping toward the total, total counting up.
- **Toggle in `config.js`:** `collectorMode: "compound"` (above) vs `"once"` (a collector collects only on the respin it lands). Default `"compound"`.

### Jackpots

Define jackpot values in `config.js` (as multiples of bet, or fixed credits):

- **MINI / MINOR / MAJOR** — carried as tags on individual coins; their tag value is added when collected.
- **GRAND** — awarded only on a fully filled board.

Jackpot seeds/persistence go through `storage.js`.

---

## Math / tuning

- All randomness routes through `engine/rng.js` (seedable for reproducible tests).
- `engine/simulate.js`: a script (runnable via `node` or a hidden dev button) that runs N base spins and N forced bonuses, then reports: base-game hit rate, bonus trigger rate, average bonus payout, and an estimated overall RTP. This is how we balance the game — make the output clear and quick to read.
- Keep every payout-affecting number in `config.js` so tuning never requires touching logic.

---

## Visual & animation polish (the "3 Oaks feel")

- Staggered column stops with ease-out + slight overshoot/settle.
- Coins: land **thunk**, brief scale-pop, persistent **glow** while locked, subtle idle shimmer.
- Locked-cell treatment distinct from spinning cells (frame/glow).
- Collector: beam/vacuum animation on collect; value chips fly to the total.
- **Respins counter** flashes and pulses when it resets to 3 (this beat is important — sell it).
- Anticipation: when 2 of the 3 trigger conditions are met mid-stop, add a near-miss highlight on the remaining lane.
- Big-win / jackpot: full-screen celebration overlay with a counting-up total and particles.
- Use a tasteful particle system in `effects.js` (sparkles, coin glints). Keep it 60fps; pool particles.

Placeholder art (simple drawn shapes / emoji) is fine to start, but build every symbol behind an `art key` so swapping in real sprites later is trivial.

---

## Audio (`audio/sound.js`, Web Audio)

Spin loop, reel-stop tick per column, coin land, lock, collector whoosh, respin-reset sting, jackpot fanfare, big-win loop. Provide a global mute toggle.

---

## HUD / UI

Balance, bet selector (with +/-), spin button, autoplay toggle, current win, **respins remaining** (prominent during bonus), **bonus total** (prominent during bonus), jackpot tier display (Mini/Minor/Major/Grand current values), mute. Clean, readable, layered above the canvas.

---

## Mobile / store-wrapping (build for this from the start)

- **Portrait-first** responsive layout; scale the canvas to fit the viewport while preserving aspect ratio (letterbox if needed).
- **Tap to spin**; large touch targets for all buttons; no hover-only affordances.
- Relative asset paths; no APIs that break inside a Capacitor WebView.
- Handle visibility changes (pause audio/loop when backgrounded).

---

## Theme (default = pizza/food, fully swappable)

Set a **pizza-delivery** placeholder theme as the default, on-brand for Pizza Hero Gaming, but keep it 100% config-driven so it's a one-file swap:

- **COIN** → a pizza coin / topping token (carries value).
- **COLLECTOR** → a pizza box or delivery scooter (the "collector").
- **Regular symbols** → slices, peppers, mushrooms, cheese, soda, etc.
- Warm palette (ember/red/masa-yellow works).

All theme strings, colors, and art keys live in `config.js` under a `theme` object so it can be reskinned without touching logic.

---

## Build in this order (phased)

1. Vite scaffold, ESLint/Prettier, README, responsive canvas, empty 3×3 render.
2. `config.js` + `rng.js` + `spin.js` producing a base-spin **result object** (no animation yet); log results.
3. Reel render + staggered spin animation reacting to results.
4. Paytable / line wins + HUD (balance, bet, win).
5. Bonus **trigger detection** + the FSM transition into a stubbed bonus.
6. `bonus.js` hold-and-spin logic: locks, respins, reset-on-lock, end conditions (logic first, minimal visuals).
7. Collector compounding math + bonus total + jackpots.
8. Full bonus visuals: locks/glow, collector beam, respin-reset flash, count-up, jackpot/celebration overlay.
9. Audio.
10. `simulate.js` headless harness; tune `config.js` to a payout that feels good.
11. Mobile pass: touch, portrait scaling, backgrounding.

Work in grouped commits per phase. After each phase, give me a short summary of what changed so I can audit before you continue.

---

## Open knobs I may want to change (call these out so they're easy to find)

- `collectorMode`: `"compound"` vs `"once"`
- Paylines: count/shape (default 5)
- Jackpot values (Mini/Minor/Major/Grand)
- Trigger difficulty (coin/collector weights)
- Theme (default pizza)
