// Pizza Hero studio splash — vendored from PHG Shared/splash (the canonical
// Wallop/Athanor studio bumper). Repurposed for this game: the `tagline` reads
// "GAMBLING", and a short `warning` line (volatility notice) renders under it.
// Behaviour is otherwise identical to the shared version.

const TITLE = 'PIZZA HERO';

function buildLetters(text) {
  return text
    .split('')
    .map((ch, i) => {
      const delay = (1.05 + i * 0.05).toFixed(2);
      if (ch === ' ')
        return '<span class="phs-space" style="animation-delay:' + delay + 's">&nbsp;</span>';
      return '<span style="animation-delay:' + delay + 's">' + ch + '</span>';
    })
    .join('');
}

export function show(opts = {}) {
  const duration = opts.duration != null ? opts.duration : 3800;
  const skipOnInput = opts.skipOnInput !== false;
  const tagline = opts.tagline || 'GAMING';
  const warning = opts.warning || '';
  const onComplete = opts.onComplete || function () {};
  const onDismiss = opts.onDismiss || function () {};
  // mount target: default full-viewport (document.body). Pass a positioned
  // element (e.g. the game stage) to contain the splash to that element's size.
  const mount = opts.mount || document.body;
  const contained = mount !== document.body;

  document.querySelectorAll('.phs-splash').forEach((el) => el.remove());

  const splash = document.createElement('div');
  splash.className = 'phs-splash' + (contained ? ' phs-contained' : '');
  splash.setAttribute('role', 'dialog');
  splash.setAttribute('aria-label', 'Pizza Hero Gambling intro');
  splash.innerHTML =
    '<div class="phs-rays" aria-hidden="true"></div>' +
    '<div class="phs-mark">PHG · MMXXVI</div>' +
    '<div class="phs-shockwave" aria-hidden="true"></div>' +
    '<h1 class="phs-title" aria-label="Pizza Hero">' +
    buildLetters(TITLE) +
    '</h1>' +
    '<p class="phs-tagline">' +
    tagline.split('').join(' ') +
    '</p>' +
    (warning ? '<p class="phs-warn">' + warning + '</p>' : '') +
    '<div class="phs-loader" aria-hidden="true"><div class="phs-loader-fill"></div></div>' +
    '<div class="phs-prompt">' +
    (skipOnInput ? 'Click or Press Any Key' : 'Loading…') +
    '</div>';
  mount.appendChild(splash);

  setTimeout(() => splash.classList.add('phs-shake'), 1050);

  let dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    window.removeEventListener('keydown', onKey);
    splash.removeEventListener('click', onClick);
    // drop phs-shake before phs-out so the fade-out animation wins (see CSS note)
    splash.classList.remove('phs-shake');
    splash.classList.add('phs-out');
    try {
      onDismiss();
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => {
      splash.remove();
      try {
        onComplete();
      } catch (e) {
        console.error(e);
      }
    }, 1100);
  }

  const onKey = () => skipOnInput && dismiss();
  const onClick = () => skipOnInput && dismiss();

  if (skipOnInput) {
    window.addEventListener('keydown', onKey);
    splash.addEventListener('click', onClick);
  }
  if (duration > 0) setTimeout(dismiss, duration);

  return { dismiss };
}
