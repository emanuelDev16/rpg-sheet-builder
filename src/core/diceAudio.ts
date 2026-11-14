export interface ClatterTap {
  delaySec: number;
  gain: number;
  resonanceHz: number;
  noiseHz: number;
  durationSec: number;
}

export interface DiceClatterOptions {
  diceCount?: number;
  isCritical?: boolean;
  isFumble?: boolean;
}

export type OutcomeAudioCue = 'critical' | 'fumble' | 'none';

export const DICE_AUDIO_MUTE_STORAGE_KEY = 'grid_sheet_audio_muted_v1';

let sharedAudioCtx: AudioContext | null = null;
let cachedNoiseBuffer: AudioBuffer | null = null;
let memoryMuted: boolean | null = null;

export function isDiceAudioMuted(): boolean {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(DICE_AUDIO_MUTE_STORAGE_KEY);
      if (raw === 'true') return true;
      if (raw === 'false') return false;
    } catch {
      // Ignore storage errors and fall back to memory state
    }
  }
  return memoryMuted ?? false;
}

export function setDiceAudioMuted(muted: boolean): boolean {
  memoryMuted = Boolean(muted);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(DICE_AUDIO_MUTE_STORAGE_KEY, String(memoryMuted));
    } catch {
      // Ignore storage errors
    }
  }
  return memoryMuted;
}

export function computeOutcomeAudioCue(
  options: Pick<DiceClatterOptions, 'isCritical' | 'isFumble'> = {},
): OutcomeAudioCue {
  if (options.isCritical) return 'critical';
  if (options.isFumble) return 'fumble';
  return 'none';
}

/**
 * Generates a subtle multi-tap rhythmic schedule resembling polyhedral dice
 * tumbling and settling on a tabletop.
 */
export function computeClatterImpulseSchedule(
  diceCount = 1,
  rng: () => number = Math.random,
): ClatterTap[] {
  const clampedDice = Math.max(1, Math.min(12, Math.round(diceCount)));
  // 1 die -> 3 subtle bounces; multiple dice -> up to 7 overlapping taps
  const tapCount = Math.min(7, 2 + Math.ceil(clampedDice * 0.75));
  const taps: ClatterTap[] = [];

  let cursorSec = 0;
  for (let i = 0; i < tapCount; i += 1) {
    const progress = tapCount === 1 ? 1 : i / (tapCount - 1);
    const decayEnvelope = 1 - progress * 0.62;
    const gain = Number((0.085 * decayEnvelope * (0.85 + rng() * 0.3)).toFixed(4));
    const resonanceHz = Math.round(460 + rng() * 520 - progress * 120);
    const noiseHz = Math.round(1600 + rng() * 1400);
    const durationSec = Number((0.022 + (1 - progress) * 0.014).toFixed(4));

    taps.push({
      delaySec: Number(cursorSec.toFixed(4)),
      gain,
      resonanceHz,
      noiseHz,
      durationSec,
    });

    // Initial rapid cluster then decelerating final settle bounce
    const baseGap = 0.024 + progress * 0.048;
    cursorSec += baseGap * (0.8 + rng() * 0.45);
  }

  return taps;
}

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const win = window as Window & { webkitAudioContext?: typeof AudioContext };
  const AudioCtx = window.AudioContext || win.webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioCtx();
    cachedNoiseBuffer = null;
  }
  return sharedAudioCtx;
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (cachedNoiseBuffer && cachedNoiseBuffer.sampleRate === ctx.sampleRate) {
    return cachedNoiseBuffer;
  }
  const length = Math.floor(ctx.sampleRate * 0.12);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  cachedNoiseBuffer = buffer;
  return buffer;
}

/**
 * Synthesizes a subtle tactile dice-clatter sound using the Web Audio API.
 * Safe no-op in headless/non-browser environments, when muted, or if audio is blocked.
 */
export function playDiceClatter(options: DiceClatterOptions = {}): boolean {
  if (isDiceAudioMuted()) return false;

  try {
    const ctx = getOrCreateAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.65, now);
    master.connect(ctx.destination);

    const noiseBuffer = getNoiseBuffer(ctx);
    const taps = computeClatterImpulseSchedule(options.diceCount ?? 1);

    for (const tap of taps) {
      const start = now + tap.delaySec;
      const stop = start + tap.durationSec;

      // 1. Crisp filtered noise burst (tabletop surface click)
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuffer;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(tap.noiseHz, start);
      bandpass.Q.setValueAtTime(2.6, start);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0001, start);
      noiseGain.gain.linearRampToValueAtTime(tap.gain, start + 0.002);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, stop);

      noiseSrc.connect(bandpass);
      bandpass.connect(noiseGain);
      noiseGain.connect(master);
      noiseSrc.start(start);
      noiseSrc.stop(stop + 0.005);

      // 2. Short resonant body transient (hard acrylic/resin die tap)
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(tap.resonanceHz, start);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(160, tap.resonanceHz * 0.58),
        stop,
      );

      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.0001, start);
      oscGain.gain.linearRampToValueAtTime(tap.gain * 0.55, start + 0.0015);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, stop);

      osc.connect(oscGain);
      oscGain.connect(master);
      osc.start(start);
      osc.stop(stop + 0.005);
    }

    const settleTime = now + (taps[taps.length - 1]?.delaySec ?? 0.1) + 0.03;
    const outcomeCue = computeOutcomeAudioCue(options);

    // Subtle harmonic settle ping on critical roll
    if (outcomeCue === 'critical') {
      const chime = ctx.createOscillator();
      const chimeGain = ctx.createGain();
      chime.type = 'sine';
      chime.frequency.setValueAtTime(880, settleTime);
      chime.frequency.exponentialRampToValueAtTime(1320, settleTime + 0.09);
      chimeGain.gain.setValueAtTime(0.0001, settleTime);
      chimeGain.gain.linearRampToValueAtTime(0.04, settleTime + 0.008);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, settleTime + 0.12);
      chime.connect(chimeGain);
      chimeGain.connect(master);
      chime.start(settleTime);
      chime.stop(settleTime + 0.13);
    } else if (outcomeCue === 'fumble') {
      // Distinct low descending discordant two-note thud on botch / critical fumble
      const lowFilter = ctx.createBiquadFilter();
      lowFilter.type = 'lowpass';
      lowFilter.frequency.setValueAtTime(620, settleTime);
      lowFilter.connect(master);

      const firstTone = ctx.createOscillator();
      const firstGain = ctx.createGain();
      firstTone.type = 'sawtooth';
      firstTone.frequency.setValueAtTime(185, settleTime);
      firstTone.frequency.exponentialRampToValueAtTime(92, settleTime + 0.12);
      firstGain.gain.setValueAtTime(0.0001, settleTime);
      firstGain.gain.linearRampToValueAtTime(0.045, settleTime + 0.01);
      firstGain.gain.exponentialRampToValueAtTime(0.0001, settleTime + 0.14);
      firstTone.connect(firstGain);
      firstGain.connect(lowFilter);
      firstTone.start(settleTime);
      firstTone.stop(settleTime + 0.15);

      const secondStart = settleTime + 0.085;
      const secondTone = ctx.createOscillator();
      const secondGain = ctx.createGain();
      secondTone.type = 'triangle';
      secondTone.frequency.setValueAtTime(128, secondStart);
      secondTone.frequency.exponentialRampToValueAtTime(58, secondStart + 0.18);
      secondGain.gain.setValueAtTime(0.0001, secondStart);
      secondGain.gain.linearRampToValueAtTime(0.06, secondStart + 0.012);
      secondGain.gain.exponentialRampToValueAtTime(0.0001, secondStart + 0.2);
      secondTone.connect(secondGain);
      secondGain.connect(lowFilter);
      secondTone.start(secondStart);
      secondTone.stop(secondStart + 0.21);
    }

    return true;
  } catch {
    return false;
  }
}
