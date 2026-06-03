# 🍕 Slice & Spin

A professional-feel **3×3 "Hold & Win" slot game** for the browser, built by
**Pizza Hero Gaming**. Vanilla JavaScript + Canvas 2D, no framework, minimal
dependencies. Game math is fully separated from presentation so payouts can be
tuned and simulated headlessly.

## The signature hook

On a base spin you trigger the **Hot Box Bonus** if and only if **all three** happen
at once:

1. **≥ 1 Pizza Coin in the LEFT column**, and
2. **≥ 1 Pizza Coin in the RIGHT column**, and
3. **≥ 1 Delivery Box (collector) in the MIDDLE column**.

The board geometry _is_ the mechanic: the middle column is the **collector lane**,
the two outer columns are the **coin lanes**.

### Hot Box Bonus

- The **collector(s) in the middle column are held** for the whole bonus.
- The **two outer (coin) lanes don't hold** — they respin fresh every spin.
- Each spin, the held collectors **bank the value of every coin on the outer
  lanes** into the running bonus total. The coins then clear; the total keeps
  growing. More collectors = bigger multiplier each spin.
- A **3-life "spins left" counter**: a spin with at least one coin (a hit) resets
  it to 3; a coinless spin (a miss) drops it by one. **Three misses in a row ends
  the bonus.**
- Coins can carry **MINI / MINOR / MAJOR / GRAND** jackpot tags, banked with the
  coin (all four tiers are reachable).

### Bonus buy

Two tiers let you pay a premium to drop straight into the bonus (prices are
multiples of your bet, derived from the simulator at ~96% return):

- **BUY BONUS** (65× bet) — starts with **1 guaranteed collector**.
- **SUPER BUY** (190× bet) — starts with **3 guaranteed collectors**, so every
  spin banks 3× the coins.

Tiers, costs, and on/off live in `KNOBS.bonusBuy` in `config.js`.

## Run / build

```bash
npm install
npm run dev        # local dev server (Vite)
npm run build      # production build → dist/
npm run preview    # preview the production build
```

### Balancing simulator (headless math)

Run thousands of spins with zero rendering to read the RTP:

```bash
npm run simulate            # 100k base spins + 20k forced bonuses
node src/engine/simulate.js 250000
```

Reports base-game hit rate, bonus trigger rate, line RTP, bonus RTP, estimated
total RTP, average bonus payout, and full-board (GRAND) rate. In the dev build you
can also run `__sim(50000)` in the browser console.

## Controls

- **Spin:** SPIN button, tap the board, or **Space / Enter** (desktop).
- **Bet:** − / + selector, or **+ / −** keys (only while idle).
- **BUY BONUS / SUPER BUY:** pay to enter the bonus directly (see above).
- **AUTO:** autoplay toggle. **🔊 / 🔇:** mute toggle.
- Desktop landscape layout; also works touch-first; large targets; no hover-only affordances.

## Tuning (where the knobs live)

Every payout-affecting number is in [`src/engine/config.js`](src/engine/config.js).
The most-changed knobs are grouped at the top under `KNOBS`:

- `respinsOnReset` — the "spins left" miss counter / reset value (default 3)
- `triggerDifficulty` — higher = rarer bonus (scales coin/collector weights)
- `betLevels`, `startingBalance`
- Paylines (`PAYLINES`, default 5: 3 rows + 2 diagonals)
- Jackpot values (`JACKPOTS`: Mini/Minor/Major/Grand)
- Reel weights, coin value distribution, bonus land-rates

## Theme

The default **pizza-delivery** theme is 100% config-driven (`THEME` in
`config.js`) — coins are pizza coins, the collector is a delivery box, regular
symbols are slices/peppers/mushrooms/cheese/soda/olives. Reskin without touching
logic. Placeholder art is drawn with Canvas + emoji; every symbol sits behind an
`artKey` so real sprites drop in later.

## Architecture

```
src/
  main.js              # bootstraps the game loop + state machine; sequences presentation
  engine/              # PURE math — no DOM/canvas
    rng.js             # seedable mulberry32; all randomness routes here
    config.js          # ALL tunable numbers + theme
    spin.js            # base-spin result object + trigger detection
    paytable.js        # line evaluation
    bonus.js           # hold & spin logic: locks, respins, collector math, end conditions
    simulate.js        # headless RTP harness
  render/              # presentation only — reacts to state
    canvas.js          # responsive scaling + master render loop
    reels.js           # reel/symbol drawing + spin/settle animation
    effects.js         # particles, beams, count-up, celebration overlay
    hud.js             # DOM HUD: balance, bet, win, respins, bonus total, jackpots
  audio/sound.js       # Web Audio (synthesized — no audio files)
  state/
    machine.js         # finite state machine (IDLE → SPINNING → … → bonus → AWARD)
    profile.js         # balance + bet, persisted
    storage.js         # localStorage wrapper, isolated for easy swap
```

**Hard rule:** the engine produces pure-data results; the renderer only shows
them. Animations react to the FSM, never the other way around.

## Mobile / store-wrapping

Built portrait-first with relative asset paths and no origin-bound APIs, with
Capacitor wrapping in mind. Canvas scales to the viewport; audio pauses when the
app is backgrounded. Persistence is isolated behind `storage.js` for swapping to
a native store later.

## Credits & license

- **Studio:** Pizza Hero Gaming (est. 2026) — solo dev: YourPizzaHero
- **License:** © 2026 Pizza Hero Gaming. All rights reserved. Not for redistribution
  or reuse without permission.

> This is a for-entertainment slot simulation. No real-money gambling, no purchases.
