/*
 * Small synthesized sound effects (Web Audio API — no audio files to host
 * or license). Muted by default is false; preference persists in
 * localStorage. All sounds are short and non-blocking.
 */

const SFX_MUTE_KEY = "silent-archive-sfx-muted";
let ctx = null;
let muted = false;
try { muted = localStorage.getItem(SFX_MUTE_KEY) === "1"; } catch { /* ignore */ }

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq, duration, { type = "sine", gain = 0.05, delay = 0, sweepTo = null } = {}) {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + delay);
  if (sweepTo) osc.frequency.linearRampToValueAtTime(sweepTo, c.currentTime + delay + duration);
  amp.gain.setValueAtTime(0, c.currentTime + delay);
  amp.gain.linearRampToValueAtTime(gain, c.currentTime + delay + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
  osc.connect(amp).connect(c.destination);
  osc.start(c.currentTime + delay);
  osc.stop(c.currentTime + delay + duration + 0.02);
}

const SFX = {
  isMuted: () => muted,
  setMuted(v) {
    muted = v;
    try { localStorage.setItem(SFX_MUTE_KEY, v ? "1" : "0"); } catch { /* ignore */ }
  },
  key() { tone(700 + Math.random() * 120, 0.02, { type: "square", gain: 0.012 }); },
  submit() { tone(420, 0.05, { type: "square", gain: 0.03 }); },
  open() { tone(300, 0.08, { type: "triangle", gain: 0.035, sweepTo: 500 }); },
  finding() {
    tone(520, 0.11, { type: "sine", gain: 0.06 });
    tone(780, 0.16, { type: "sine", gain: 0.05, delay: 0.1 });
  },
  rankUp() {
    tone(440, 0.1, { type: "triangle", gain: 0.06 });
    tone(660, 0.1, { type: "triangle", gain: 0.06, delay: 0.09 });
    tone(880, 0.22, { type: "triangle", gain: 0.06, delay: 0.18 });
  },
  warning() {
    tone(220, 0.22, { type: "sawtooth", gain: 0.045, sweepTo: 140 });
  },
  danger() {
    tone(180, 0.3, { type: "sawtooth", gain: 0.06, sweepTo: 90 });
    tone(180, 0.3, { type: "sawtooth", gain: 0.05, delay: 0.28, sweepTo: 90 });
  },
  ending() {
    tone(300, 0.3, { type: "sine", gain: 0.05, sweepTo: 120 });
  },
  // --- atmosphere ---
  sub() { tone(48, 1.6, { type: "sine", gain: 0.09 }); tone(51, 1.6, { type: "sine", gain: 0.07 }); },
  thump() { tone(70, 0.18, { type: "sine", gain: 0.1, sweepTo: 40 }); },
  heartbeat() {
    for (const d of [0, 0.28, 1.05, 1.33]) tone(62, 0.16, { type: "sine", gain: 0.11, delay: d, sweepTo: 38 });
  },
  staticBurst() {
    if (muted) return;
    const c = ensureCtx();
    if (!c) return;
    const len = Math.floor(c.sampleRate * 0.5);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    const amp = c.createGain();
    amp.gain.value = 0.05;
    src.buffer = buf;
    src.connect(amp).connect(c.destination);
    src.start();
  },
};

window.SFX = SFX;
