export type SfxType =
  | "attack_swing"
  | "attack_hit"
  | "attack_defeat"
  | "interact"
  | "ui_click"
  | "ui_open"
  | "ui_close"
  | "shop_buy"
  | "shop_sell"
  | "shop_fail"
  | "portal"
  | "zone_enter"
  | "quest_complete"
  | "chat_send"
  | "market_success"
  | "market_fail"
  | "item_use"
  | "level_up"
  | "skill_level_up"
  | "player_hurt"
  | "chop_swing"
  | "chop_hit"
  | "chop_fell";

const MASTER_VOLUME = 0.32;
const MUTE_STORAGE_KEY = "metricbase-sfx-muted";

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let initialized = false;
let soundEnabled = readStoredMutePreference();

function readStoredMutePreference(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(MUTE_STORAGE_KEY) !== "true";
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(MUTE_STORAGE_KEY, enabled ? "false" : "true");
  }
}

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (!audioContext) {
    const AudioCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;
    audioContext = new AudioCtor();
    masterGain = audioContext.createGain();
    masterGain.gain.value = MASTER_VOLUME;
    masterGain.connect(audioContext.destination);
  }

  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }

  return audioContext;
}

export function initSoundEffects(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const prime = () => {
    getContext();
    window.removeEventListener("pointerdown", prime);
    window.removeEventListener("keydown", prime);
  };

  window.addEventListener("pointerdown", prime, { once: false });
  window.addEventListener("keydown", prime, { once: false });
}

export function playSfx(type: SfxType): void {
  if (!soundEnabled) return;

  const ctx = getContext();
  if (!ctx || !masterGain) return;

  const now = ctx.currentTime;

  switch (type) {
    case "attack_swing":
      playSweep(ctx, masterGain, now, 420, 180, 0.06, "square", 0.14);
      break;
    case "attack_hit":
      playTone(ctx, masterGain, now, 140, "square", 0.1, 0.22);
      playNoiseBurst(ctx, masterGain, now + 0.01, 0.05, 0.12);
      break;
    case "attack_defeat":
      playTone(ctx, masterGain, now, 220, "square", 0.08, 0.2);
      playTone(ctx, masterGain, now + 0.09, 330, "square", 0.08, 0.2);
      playTone(ctx, masterGain, now + 0.18, 440, "square", 0.14, 0.24);
      break;
    case "interact":
      playTone(ctx, masterGain, now, 520, "sine", 0.07, 0.18);
      playTone(ctx, masterGain, now + 0.08, 660, "sine", 0.09, 0.2);
      break;
    case "ui_click":
      playTone(ctx, masterGain, now, 880, "triangle", 0.03, 0.12);
      break;
    case "ui_open":
      playTone(ctx, masterGain, now, 360, "sine", 0.06, 0.16);
      playTone(ctx, masterGain, now + 0.06, 520, "sine", 0.08, 0.18);
      break;
    case "ui_close":
      playTone(ctx, masterGain, now, 520, "sine", 0.06, 0.14);
      playTone(ctx, masterGain, now + 0.05, 360, "sine", 0.08, 0.14);
      break;
    case "shop_buy":
      playTone(ctx, masterGain, now, 988, "square", 0.05, 0.2);
      playTone(ctx, masterGain, now + 0.07, 1318, "square", 0.08, 0.22);
      break;
    case "shop_sell":
      playTone(ctx, masterGain, now, 740, "square", 0.05, 0.18);
      playTone(ctx, masterGain, now + 0.07, 988, "square", 0.08, 0.2);
      break;
    case "shop_fail":
      playTone(ctx, masterGain, now, 180, "sawtooth", 0.1, 0.18);
      playTone(ctx, masterGain, now + 0.11, 140, "sawtooth", 0.12, 0.16);
      break;
    case "portal":
      playSweep(ctx, masterGain, now, 220, 880, 0.35, "sine", 0.2);
      playNoiseBurst(ctx, masterGain, now + 0.05, 0.22, 0.08);
      break;
    case "zone_enter":
      playTone(ctx, masterGain, now, 294, "sine", 0.1, 0.14);
      playTone(ctx, masterGain, now + 0.12, 392, "sine", 0.12, 0.16);
      playTone(ctx, masterGain, now + 0.26, 494, "sine", 0.16, 0.14);
      break;
    case "quest_complete":
      playTone(ctx, masterGain, now, 392, "square", 0.08, 0.2);
      playTone(ctx, masterGain, now + 0.1, 494, "square", 0.08, 0.2);
      playTone(ctx, masterGain, now + 0.2, 587, "square", 0.14, 0.24);
      break;
    case "chat_send":
      playTone(ctx, masterGain, now, 700, "triangle", 0.04, 0.1);
      break;
    case "market_success":
      playTone(ctx, masterGain, now, 660, "square", 0.05, 0.18);
      playTone(ctx, masterGain, now + 0.06, 880, "square", 0.05, 0.18);
      playTone(ctx, masterGain, now + 0.12, 1108, "square", 0.1, 0.2);
      break;
    case "market_fail":
      playTone(ctx, masterGain, now, 220, "sawtooth", 0.08, 0.16);
      break;
    case "item_use":
      playTone(ctx, masterGain, now, 440, "sine", 0.06, 0.16);
      playTone(ctx, masterGain, now + 0.07, 554, "sine", 0.1, 0.18);
      break;
    case "level_up":
      playTone(ctx, masterGain, now, 330, "square", 0.08, 0.2);
      playTone(ctx, masterGain, now + 0.09, 440, "square", 0.08, 0.2);
      playTone(ctx, masterGain, now + 0.18, 554, "square", 0.08, 0.2);
      playTone(ctx, masterGain, now + 0.27, 660, "square", 0.14, 0.24);
      break;
    case "skill_level_up":
      playTone(ctx, masterGain, now, 294, "square", 0.08, 0.18);
      playTone(ctx, masterGain, now + 0.09, 392, "square", 0.08, 0.18);
      playTone(ctx, masterGain, now + 0.18, 494, "square", 0.12, 0.2);
      break;
    case "chop_swing":
      playSweep(ctx, masterGain, now, 320, 120, 0.05, "triangle", 0.12);
      break;
    case "chop_hit":
      playTone(ctx, masterGain, now, 180, "square", 0.05, 0.16);
      playNoiseBurst(ctx, masterGain, now + 0.01, 0.04, 0.1);
      break;
    case "chop_fell":
      playTone(ctx, masterGain, now, 110, "square", 0.08, 0.2);
      playNoiseBurst(ctx, masterGain, now + 0.03, 0.12, 0.14);
      playTone(ctx, masterGain, now + 0.14, 220, "square", 0.1, 0.16);
      break;
    case "player_hurt":
      playTone(ctx, masterGain, now, 180, "sawtooth", 0.06, 0.16);
      playTone(ctx, masterGain, now + 0.05, 120, "sawtooth", 0.08, 0.14);
      break;
  }
}

function playTone(
  ctx: AudioContext,
  output: GainNode,
  start: number,
  frequency: number,
  wave: OscillatorType,
  duration: number,
  peakGain: number,
): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gain);
  gain.connect(output);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playSweep(
  ctx: AudioContext,
  output: GainNode,
  start: number,
  fromHz: number,
  toHz: number,
  duration: number,
  wave: OscillatorType,
  peakGain: number,
): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(fromHz, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(toHz, 1), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gain);
  gain.connect(output);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playNoiseBurst(
  ctx: AudioContext,
  output: GainNode,
  start: number,
  duration: number,
  peakGain: number,
): void {
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < bufferSize; index++) {
    data[index] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = 900;
  filter.Q.value = 0.6;
  gain.gain.setValueAtTime(peakGain, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  source.start(start);
  source.stop(start + duration + 0.02);
}