// Web Audio sound. All synthesized — no audio files to ship. Lazily creates the
// AudioContext on first user gesture (mobile autoplay policy). Global mute.

export function createSound() {
  let ctx = null;
  let master = null;
  let muted = false;
  let spinOsc = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.6;
    master.connect(ctx.destination);
    return ctx;
  }

  // resume context after a user gesture
  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
  }

  function blip({ freq = 440, type = 'sine', dur = 0.12, gain = 0.4, slideTo = null, delay = 0 }) {
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noiseBurst({ dur = 0.18, gain = 0.25, hp = 800 }) {
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime;
    const frames = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, frames, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = hp;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
  }

  return {
    unlock,
    setMuted(m) {
      muted = !!m;
      if (master) master.gain.value = muted ? 0 : 0.6;
      if (muted) this.stopSpinLoop();
    },
    isMuted() {
      return muted;
    },

    // No continuous spin tone — the per-column reel-stop ticks (reelStop) carry
    // the spin feedback. Kept as a no-op so call sites stay simple and a spin
    // sound can be reintroduced here later if desired.
    startSpinLoop() {},
    stopSpinLoop() {
      if (spinOsc) {
        try {
          spinOsc.stop();
        } catch {
          /* already stopped */
        }
        spinOsc.disconnect();
        spinOsc = null;
      }
    },

    reelStop() {
      blip({ freq: 220, type: 'square', dur: 0.06, gain: 0.2, slideTo: 140 });
    },
    coinLand() {
      blip({ freq: 880, type: 'triangle', dur: 0.1, gain: 0.3, slideTo: 1320 });
      blip({ freq: 1320, type: 'sine', dur: 0.12, gain: 0.18, delay: 0.04 });
    },
    lock() {
      blip({ freq: 300, type: 'square', dur: 0.08, gain: 0.25, slideTo: 500 });
    },
    collectWhoosh() {
      noiseBurst({ dur: 0.22, gain: 0.18, hp: 600 });
      blip({ freq: 200, type: 'sine', dur: 0.25, gain: 0.2, slideTo: 700 });
    },
    respinReset() {
      blip({ freq: 660, type: 'triangle', dur: 0.1, gain: 0.3, slideTo: 990 });
      blip({ freq: 990, type: 'triangle', dur: 0.1, gain: 0.25, delay: 0.08, slideTo: 1320 });
    },
    jackpot() {
      [523, 659, 784, 1046].forEach((f, i) =>
        blip({ freq: f, type: 'triangle', dur: 0.18, gain: 0.3, delay: i * 0.09 })
      );
    },
    bigWin() {
      [392, 523, 659, 784, 1046].forEach((f, i) =>
        blip({ freq: f, type: 'sine', dur: 0.22, gain: 0.28, delay: i * 0.07 })
      );
    },
    win() {
      blip({ freq: 523, type: 'triangle', dur: 0.12, gain: 0.25, slideTo: 784 });
    },
  };
}
