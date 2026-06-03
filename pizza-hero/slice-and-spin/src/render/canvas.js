// Canvas setup, responsive scaling, and the master render loop. Owns the RAF
// loop and a layout object every other renderer reads. Portrait-first: the
// board scales to fit the viewport, preserving aspect (letterbox via CSS bg).

import { GRID } from '../engine/config.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  let width = 0;
  let height = 0;
  let layout = null;
  const drawables = []; // { z, draw(ctx, layout, now) }
  let running = false;
  let lastNow = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout = computeLayout(width, height);
  }

  function computeLayout(w, h) {
    // Reserve vertical bands the DOM HUD occupies: jackpot ribbon up top, the
    // control bar at the bottom. The board lives in the band between them so it
    // never slides under the controls (matters on short, wide desktop windows).
    const headerH = Math.min(h * 0.15, 96);
    const footerH = Math.min(h * 0.24, 156);
    const pad = Math.max(12, w * 0.03);
    const availW = w - pad * 2;
    const bandH = h - headerH - footerH;
    const availH = bandH - pad * 2;
    const gap = Math.max(6, Math.min(availW, availH) * 0.03);

    // largest cell that fits both width and height for a 3x3 board
    const cellByW = (availW - gap * (GRID.cols - 1)) / GRID.cols;
    const cellByH = (availH - gap * (GRID.rows - 1)) / GRID.rows;
    const cell = Math.floor(Math.min(cellByW, cellByH));

    const boardW = cell * GRID.cols + gap * (GRID.cols - 1);
    const boardH = cell * GRID.rows + gap * (GRID.rows - 1);
    const boardX = Math.floor((w - boardW) / 2);
    const boardY = Math.floor(headerH + (bandH - boardH) / 2);

    return {
      w,
      h,
      headerH,
      footerH,
      pad,
      gap,
      cell,
      boardX,
      boardY,
      boardW,
      boardH,
      // pixel rect for a given cell
      cellRect(col, row) {
        return {
          x: boardX + col * (cell + gap),
          y: boardY + row * (cell + gap),
          w: cell,
          h: cell,
          cx: boardX + col * (cell + gap) + cell / 2,
          cy: boardY + row * (cell + gap) + cell / 2,
        };
      },
    };
  }

  function add(drawable) {
    drawables.push(drawable);
    drawables.sort((a, b) => (a.z || 0) - (b.z || 0));
  }

  function frame(now) {
    if (!running) return;
    lastNow = now;
    ctx.clearRect(0, 0, width, height);
    for (const d of drawables) d.draw(ctx, layout, now);
    requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
  }

  window.addEventListener('resize', resize);

  resize();

  return {
    ctx,
    add,
    start,
    stop,
    resize,
    get layout() {
      return layout;
    },
    get now() {
      return lastNow;
    },
  };
}
