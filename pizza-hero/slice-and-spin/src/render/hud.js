// DOM HUD layered above the canvas: balance, bet +/- selector, spin, autoplay,
// win, jackpot tiers, and the prominent bonus panel (respins + bonus total).
// Large touch targets, no hover-only affordances. Exposes update methods +
// event hooks; it never reads game state directly.

import { THEME, JACKPOT_TIERS, JACKPOTS, KNOBS, PAYTABLE, PAYLINES } from '../engine/config.js';
import { drawSymbolArt } from './symbols.js';

// Theoretical return to player (from the headless simulator). Update if you
// re-tune the math: `npm run simulate`.
const RTP_PCT = 95;

export function createHud(root) {
  root.innerHTML = `
    <div class="jackpots" id="jackpots"></div>

    <div class="bonus-panel" id="bonusPanel" hidden>
      <div class="bonus-name">${THEME.labels.bonusName}</div>
      <div class="bonus-stats">
        <div class="respins"><span class="lbl">SPINS LEFT</span><span class="val" id="respins">3</span></div>
        <div class="bonus-total"><span class="lbl">BONUS WIN</span><span class="val" id="bonusTotal">0</span></div>
      </div>
    </div>

    <div class="controls">
      <div class="readout">
        <div class="stat"><span class="lbl">BALANCE</span><span class="val" id="balance">0</span></div>
        <div class="stat"><span class="lbl">WIN</span><span class="val" id="win">0</span></div>
      </div>
      <div class="actions">
        <div class="buys" id="buys"></div>
        <div class="bet">
          <button class="bet-btn" id="betDown" aria-label="decrease bet">−</button>
          <div class="bet-val"><span class="lbl">BET</span><span class="val" id="bet">0</span></div>
          <button class="bet-btn" id="betUp" aria-label="increase bet">+</button>
        </div>
        <button class="spin-btn" id="spin">${THEME.labels.spin}</button>
        <div class="toggles">
          <button class="toggle" id="auto" aria-pressed="false">AUTO</button>
          <button class="toggle" id="mute" aria-pressed="false">🔊</button>
          <button class="toggle" id="info" aria-label="game info">ⓘ</button>
        </div>
      </div>
    </div>

    <div class="confirm" id="confirm" hidden>
      <div class="confirm-panel">
        <div class="confirm-title" id="confirmTitle">Buy bonus?</div>
        <div class="confirm-sub" id="confirmSub"></div>
        <div class="confirm-cost" id="confirmCost">0</div>
        <div class="confirm-actions">
          <button class="confirm-no" id="confirmNo">CANCEL</button>
          <button class="confirm-yes" id="confirmYes">BUY</button>
        </div>
      </div>
    </div>

    <div class="info" id="info-modal" hidden>
      <div class="info-panel">
        <button class="info-close" id="infoClose" aria-label="close">✕</button>
        <div class="info-body" id="infoBody"></div>
      </div>
    </div>

    <div class="banner" id="banner" hidden></div>
  `;

  const $ = (id) => root.querySelector('#' + id);
  const els = {
    jackpots: $('jackpots'),
    bonusPanel: $('bonusPanel'),
    respins: $('respins'),
    bonusTotal: $('bonusTotal'),
    balance: $('balance'),
    win: $('win'),
    bet: $('bet'),
    spin: $('spin'),
    betUp: $('betUp'),
    betDown: $('betDown'),
    auto: $('auto'),
    mute: $('mute'),
    info: $('info'),
    infoModal: $('info-modal'),
    infoBody: $('infoBody'),
    infoClose: $('infoClose'),
    buys: $('buys'),
    confirm: $('confirm'),
    confirmTitle: $('confirmTitle'),
    confirmSub: $('confirmSub'),
    confirmCost: $('confirmCost'),
    confirmNo: $('confirmNo'),
    confirmYes: $('confirmYes'),
    banner: $('banner'),
  };

  // bonus-buy tier buttons (built from config)
  const buyTiers = KNOBS.bonusBuy?.tiers ?? [];
  const buyEls = {}; // tierId -> { button, cost }
  els.buys.innerHTML = buyTiers
    .map(
      (t) =>
        `<button class="buy-btn buy-${t.id}" data-tier="${t.id}">
          <span class="buy-lbl">${t.label}</span>
          <span class="buy-cost" id="cost-${t.id}">0</span>
        </button>`
    )
    .join('');
  for (const t of buyTiers) {
    const btn = els.buys.querySelector(`[data-tier="${t.id}"]`);
    buyEls[t.id] = { button: btn, cost: root.querySelector('#cost-' + t.id) };
    btn.addEventListener('click', () => emit('buy', t.id));
  }

  // jackpot tiers
  els.jackpots.innerHTML = JACKPOT_TIERS.map(
    (t) => `<div class="jk jk-${t.toLowerCase()}"><span class="jk-name">${t}</span><span class="jk-val" id="jk-${t}">0</span></div>`
  ).join('');

  const handlers = { spin: [], bet: [], auto: [], mute: [], buy: [], buyConfirm: [] };
  function on(name, fn) {
    handlers[name].push(fn);
  }
  function emit(name, arg) {
    for (const fn of handlers[name]) fn(arg);
  }

  els.spin.addEventListener('click', () => emit('spin'));
  els.betUp.addEventListener('click', () => emit('bet', +1));
  els.betDown.addEventListener('click', () => emit('bet', -1));
  els.auto.addEventListener('click', () => emit('auto'));
  els.mute.addEventListener('click', () => emit('mute'));

  // ---- buy confirmation modal ----
  let pendingBuy = null;
  function hideConfirm() {
    els.confirm.hidden = true;
    pendingBuy = null;
  }
  els.confirmYes.addEventListener('click', () => {
    const tier = pendingBuy;
    hideConfirm();
    if (tier) emit('buyConfirm', tier);
  });
  els.confirmNo.addEventListener('click', hideConfirm);
  // click the dim backdrop (outside the panel) to cancel
  els.confirm.addEventListener('click', (e) => {
    if (e.target === els.confirm) hideConfirm();
  });
  // keyboard: Enter confirms, Escape cancels (only while the modal is open)
  document.addEventListener('keydown', (e) => {
    if (els.confirm.hidden) return;
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      els.confirmYes.click();
    } else if (e.code === 'Escape') {
      e.preventDefault();
      hideConfirm();
    }
  });

  // ---- info / paytable modal ----
  els.infoBody.innerHTML = buildInfo();
  drawInfoIcons(els.infoBody);
  function showInfo() {
    els.infoModal.hidden = false;
    els.infoBody.scrollTop = 0;
  }
  function hideInfo() {
    els.infoModal.hidden = true;
  }
  els.info.addEventListener('click', showInfo);
  els.infoClose.addEventListener('click', hideInfo);
  els.infoModal.addEventListener('click', (e) => {
    if (e.target === els.infoModal) hideInfo();
  });
  document.addEventListener('keydown', (e) => {
    if (els.infoModal.hidden) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      hideInfo();
    }
  });

  function num(el, v) {
    el.textContent = Math.round(v).toLocaleString();
  }

  return {
    on,
    setBalance: (v) => num(els.balance, v),
    setBet: (v) => num(els.bet, v),
    setWin: (v) => num(els.win, v),
    setSpinEnabled(enabled) {
      els.spin.disabled = !enabled;
      els.betUp.disabled = !enabled;
      els.betDown.disabled = !enabled;
    },
    setBuyCost(tierId, v) {
      if (buyEls[tierId]) num(buyEls[tierId].cost, v);
    },
    setBuyEnabled(tierId, enabled) {
      if (buyEls[tierId]) buyEls[tierId].button.disabled = !enabled;
    },
    showBuys(show) {
      els.buys.hidden = !show;
    },
    showBuyConfirm(tier, cost) {
      pendingBuy = tier.id;
      els.confirmTitle.textContent = tier.label + '?';
      const n = tier.collectors;
      els.confirmSub.textContent = `${n} guaranteed collector${n === 1 ? '' : 's'}`;
      els.confirmCost.textContent = '🍕 ' + Math.round(cost).toLocaleString();
      els.confirm.hidden = false;
    },
    isModalOpen() {
      return !els.confirm.hidden || !els.infoModal.hidden;
    },
    setAuto(active) {
      els.auto.setAttribute('aria-pressed', String(active));
      els.auto.classList.toggle('active', active);
    },
    setMuted(muted) {
      els.mute.setAttribute('aria-pressed', String(muted));
      els.mute.textContent = muted ? '🔇' : '🔊';
    },
    setJackpots(bet) {
      for (const t of JACKPOT_TIERS) {
        const el = root.querySelector('#jk-' + t);
        if (el) el.textContent = (JACKPOTS[t] * bet).toLocaleString();
      }
    },
    showBonusPanel(show) {
      els.bonusPanel.hidden = !show;
    },
    setRespins(v, { reset = false } = {}) {
      els.respins.textContent = String(v);
      if (reset) {
        els.respins.classList.remove('flash');
        // force reflow to restart the animation
        void els.respins.offsetWidth;
        els.respins.classList.add('flash');
      }
    },
    setBonusTotal: (v) => num(els.bonusTotal, v),
    banner(text, { ms = 1600 } = {}) {
      els.banner.textContent = text;
      els.banner.hidden = false;
      els.banner.classList.remove('show');
      void els.banner.offsetWidth;
      els.banner.classList.add('show');
      clearTimeout(els.banner._t);
      els.banner._t = setTimeout(() => {
        els.banner.hidden = true;
      }, ms);
    },
  };
}

// ---- info / paytable content (built from config so it stays accurate) ----

const SYMBOL_NAMES = {
  SLICE: 'Pizza Slice',
  PEPPER: 'Pepper',
  MUSHROOM: 'Mushroom',
  CHEESE: 'Cheese',
  SODA: 'Soda',
  OLIVE: 'Olive',
};

function buildInfo() {
  // paytable rows, highest-paying first
  const payRows = Object.keys(PAYTABLE)
    .filter((id) => PAYTABLE[id] && PAYTABLE[id][3] != null)
    .sort((a, b) => PAYTABLE[b][3] - PAYTABLE[a][3])
    .map(
      (id) => `
      <div class="pt-row">
        <canvas class="pt-icon" data-sym="${id}" width="56" height="56"></canvas>
        <span class="pt-name">${SYMBOL_NAMES[id] || id}</span>
        <span class="pt-pay">${formatMult(PAYTABLE[id][3])}× bet</span>
      </div>`
    )
    .join('');

  const lineGrids = PAYLINES.map((line) => miniGrid(line)).join('');

  const jackpotRows = JACKPOT_TIERS.map(
    (t) => `<div class="i-row"><span class="i-tag i-${t.toLowerCase()}">${t}</span><b>${JACKPOTS[t]}× bet</b></div>`
  ).join('');

  const buyRows = (KNOBS.bonusBuy?.tiers ?? [])
    .map(
      (t) =>
        `<div class="i-row"><span>${t.label} — ${t.collectors} collector${t.collectors > 1 ? 's' : ''}</span><b>${t.costMult}× bet</b></div>`
    )
    .join('');

  const maxWin = KNOBS.maxWinMult
    ? `<div class="info-maxwin"><span>MAX WIN</span><b>${KNOBS.maxWinMult.toLocaleString()}× bet</b></div>`
    : '';

  return `
    <h2 class="info-title">🍕 SLICE &amp; SPIN — How to play</h2>
    ${maxWin}

    <section class="info-sec">
      <h3>Paytable</h3>
      <p class="info-note">Match 3 of a kind left-to-right on a payline.</p>
      <div class="pt-list">${payRows}</div>
    </section>

    <section class="info-sec">
      <h3>Paylines — ${PAYLINES.length} ways</h3>
      <p class="info-note">3 rows + 2 diagonals. Wins pay left to right.</p>
      <div class="lines-list">${lineGrids}</div>
    </section>

    <section class="info-sec">
      <h3>Bonus trigger</h3>
      <p>Land all three on a base spin to start the <b>Hot Box Bonus</b>:</p>
      <ul>
        <li><b>Pizza Coin</b> in the <b>left</b> column</li>
        <li><b>Pizza Coin</b> in the <b>right</b> column</li>
        <li><b>Delivery Box</b> (collector) in the <b>middle</b> column</li>
      </ul>
    </section>

    <section class="info-sec">
      <h3>Hot Box Bonus</h3>
      <ul>
        <li>The <b>collector(s) in the middle are held</b> for the whole bonus.</li>
        <li>The <b>outer lanes respin fresh every spin</b> — coins don't stick.</li>
        <li>Each spin, the collectors <b>bank every coin that lands</b> into your
          total. More collectors = a bigger multiplier each spin.</li>
        <li><b>Spins Left starts at 3.</b> A spin with a coin resets it to 3; a
          coinless spin loses one. <b>3 misses in a row ends the bonus.</b></li>
      </ul>
    </section>

    <section class="info-sec">
      <h3>Jackpots</h3>
      <p class="info-note">Carried on coins and banked when collected.</p>
      <div class="i-rows">${jackpotRows}</div>
    </section>

    <section class="info-sec">
      <h3>Bonus buy</h3>
      <p class="info-note">Pay to start the bonus instantly.</p>
      <div class="i-rows">${buyRows}</div>
    </section>

    <section class="info-sec">
      <h3>RTP &amp; max win</h3>
      <p>Theoretical return to player ≈ <b>${RTP_PCT}%</b>.</p>
      ${
        KNOBS.maxWinMult
          ? `<p>Max win is capped at <b>${KNOBS.maxWinMult.toLocaleString()}× bet</b> — a bonus ends if it reaches the cap.</p>`
          : ''
      }
    </section>

    <section class="info-sec info-studio">
      <div class="info-wordmark">🍕 PIZZA HERO <span>GAMBLING</span></div>
      <p><b>Slice &amp; Spin</b> is a Pizza Hero Gambling game — a high-volatility,
        pizza-themed hold-and-win slot. Spin the 3×3 reels, land coins and a
        delivery box to trigger the <b>Hot Box Bonus</b>, and bank your wins.</p>
      <p class="info-note">
        Play-money only — for entertainment, with no real-money wagering or
        prizes. 18+. Please play responsibly.
      </p>
      <p class="info-note">© 2026 Pizza Hero Gaming · All rights reserved.</p>
    </section>
  `;
}

function formatMult(m) {
  return Number.isInteger(m) ? String(m) : m.toFixed(1);
}

// a small 3×3 grid illustrating one payline
function miniGrid(line) {
  const on = new Set(line.map(([c, r]) => c + '-' + r));
  let cells = '';
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) cells += `<i class="mc${on.has(c + '-' + r) ? ' on' : ''}"></i>`;
  return `<div class="mini">${cells}</div>`;
}

// draw the vector symbol art into each paytable icon canvas
function drawInfoIcons(container) {
  for (const cv of container.querySelectorAll('.pt-icon')) {
    const ctx = cv.getContext('2d');
    const id = cv.dataset.sym;
    drawSymbolArt(ctx, { type: 'regular', symbol: id }, cv.width / 2, cv.height / 2, cv.width);
  }
}

export { KNOBS };
