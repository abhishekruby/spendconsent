// Small interface sounds synthesized with Web Audio: no files, no dependency.
// Quiet by design; the buyer can mute them (remembered in this browser).
export type Cue = 'send' | 'tick' | 'found' | 'notice' | 'select' | 'stamp' | 'success' | 'error';

const KEY = 'spendconsent-sound';
let context: AudioContext | null = null;

export function soundOn(): boolean {
  try { return window.localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}
export function setSoundOn(on: boolean) {
  try { window.localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* Sound preference only lasts this page. */ }
}

function tone(ctx: AudioContext, at: number, frequency: number, length: number, volume = 0.06, type: OscillatorType = 'sine', glideTo?: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, at);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, at + length);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

function thud(ctx: AudioContext, at: number) {
  // A soft "stamp": short filtered noise over a low sine.
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.12), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  const noise = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  noise.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = 900; gain.gain.value = 0.22;
  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start(at);
  tone(ctx, at, 140, 0.18, 0.12, 'sine', 70);
}

export function play(cue: Cue) {
  if (!soundOn() || typeof window === 'undefined' || !('AudioContext' in window)) return;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    const ctx = context;
    const t = ctx.currentTime + 0.01;
    switch (cue) {
      case 'send': tone(ctx, t, 520, 0.12, 0.05, 'sine', 780); break;
      case 'tick': tone(ctx, t, 1320, 0.05, 0.025, 'triangle'); break;
      case 'select': tone(ctx, t, 660, 0.08, 0.04, 'triangle'); tone(ctx, t + 0.06, 880, 0.1, 0.035, 'triangle'); break;
      case 'found': [659, 880, 1047].forEach((f, i) => tone(ctx, t + i * 0.08, f, 0.22, 0.045)); break;
      case 'notice': tone(ctx, t, 587, 0.18, 0.045); tone(ctx, t + 0.12, 523, 0.24, 0.04); break;
      case 'stamp': thud(ctx, t); break;
      case 'success': [523, 659, 784, 1047].forEach((f, i) => tone(ctx, t + i * 0.09, f, 0.32, 0.05, 'triangle')); break;
      case 'error': tone(ctx, t, 330, 0.18, 0.05, 'square'); tone(ctx, t + 0.16, 247, 0.28, 0.045, 'square'); break;
    }
  } catch { /* Sound is decoration; never block the purchase flow. */ }
}
