import { getAudioContext } from "./soundEffects";

// A cozy, procedurally-generated looping soundtrack: soft triangle-wave pads
// over a gentle I–vi–IV–V progression, a warm bass pulse, and a sparse
// pentatonic bell melody. No audio files — everything is synthesized so it
// streams instantly and loops seamlessly.

const MUSIC_STORAGE_KEY = "metricbase-music-muted";
const BPM = 70;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const LOOP = BAR * 4;
const TARGET_VOLUME = 0.22;

interface ChordBar {
  pad: number[];
  bass: number;
  melody: { beat: number; freq: number }[];
}

// C major: C–Am–F–G, with a sparse C-major-pentatonic melody.
const PROGRESSION: ChordBar[] = [
  {
    pad: [261.63, 329.63, 392.0],
    bass: 130.81,
    melody: [
      { beat: 0, freq: 659.25 },
      { beat: 2.5, freq: 783.99 },
    ],
  },
  {
    pad: [220.0, 261.63, 329.63],
    bass: 110.0,
    melody: [
      { beat: 1, freq: 880.0 },
      { beat: 3, freq: 659.25 },
    ],
  },
  {
    pad: [174.61, 220.0, 261.63],
    bass: 87.31,
    melody: [
      { beat: 0.5, freq: 523.25 },
      { beat: 2, freq: 587.33 },
    ],
  },
  {
    pad: [196.0, 246.94, 293.66],
    bass: 98.0,
    melody: [
      { beat: 1, freq: 587.33 },
      { beat: 2.5, freq: 493.88 },
      { beat: 3.5, freq: 392.0 },
    ],
  },
];

let musicGain: GainNode | null = null;
let musicFilter: BiquadFilterNode | null = null;
let playing = false;
let wantInWorld = false;
let enabled = readStoredMusicPreference();
let nextLoopStart = 0;
let scheduleTimer: number | null = null;

function readStoredMusicPreference(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(MUSIC_STORAGE_KEY) !== "true";
}

export function isMusicEnabled(): boolean {
  return enabled;
}

export function setMusicEnabled(value: boolean): void {
  enabled = value;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(MUSIC_STORAGE_KEY, value ? "false" : "true");
  }
  syncPlayback();
}

/** Call when the player enters the world. */
export function startBackgroundMusic(): void {
  wantInWorld = true;
  syncPlayback();
}

/** Call when the player leaves the world. */
export function stopBackgroundMusic(): void {
  wantInWorld = false;
  syncPlayback();
}

function syncPlayback(): void {
  if (wantInWorld && enabled) {
    start();
  } else {
    stop();
  }
}

function ensureBus(ctx: AudioContext): GainNode {
  if (!musicGain || !musicFilter) {
    musicFilter = ctx.createBiquadFilter();
    musicFilter.type = "lowpass";
    musicFilter.frequency.value = 1800;
    musicFilter.Q.value = 0.4;
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.0001;
    musicGain.connect(musicFilter);
    musicFilter.connect(ctx.destination);
  }
  return musicGain;
}

function start(): void {
  if (playing) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const bus = ensureBus(ctx);
  playing = true;

  const now = ctx.currentTime;
  bus.gain.cancelScheduledValues(now);
  bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now);
  bus.gain.exponentialRampToValueAtTime(TARGET_VOLUME, now + 1.5);

  nextLoopStart = now + 0.2;
  scheduleAhead();
}

function stop(): void {
  if (!playing) return;
  playing = false;
  if (scheduleTimer !== null) {
    window.clearTimeout(scheduleTimer);
    scheduleTimer = null;
  }
  const ctx = getAudioContext();
  if (ctx && musicGain) {
    const now = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(Math.max(0.0001, musicGain.gain.value), now);
    musicGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
  }
}

function scheduleAhead(): void {
  if (!playing) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  // Keep roughly one loop scheduled in advance.
  while (nextLoopStart < ctx.currentTime + LOOP + 0.5) {
    scheduleLoop(ctx, nextLoopStart);
    nextLoopStart += LOOP;
  }

  scheduleTimer = window.setTimeout(scheduleAhead, 2000);
}

function scheduleLoop(ctx: AudioContext, loopStart: number): void {
  PROGRESSION.forEach((bar, index) => {
    const barStart = loopStart + index * BAR;
    for (const freq of bar.pad) {
      playPad(ctx, freq, barStart, BAR * 0.98);
    }
    playBass(ctx, bar.bass, barStart, BEAT * 1.7);
    playBass(ctx, bar.bass, barStart + BEAT * 2, BEAT * 1.7);
    for (const note of bar.melody) {
      playBell(ctx, note.freq, barStart + note.beat * BEAT);
    }
  });
}

function playPad(ctx: AudioContext, freq: number, start: number, dur: number): void {
  const bus = musicGain;
  if (!bus) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  osc.detune.value = (Math.random() - 0.5) * 6;
  const peak = 0.05;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.5);
  gain.gain.setValueAtTime(peak, start + dur - 0.7);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain);
  gain.connect(bus);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function playBass(ctx: AudioContext, freq: number, start: number, dur: number): void {
  const bus = musicGain;
  if (!bus) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  const peak = 0.075;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain);
  gain.connect(bus);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function playBell(ctx: AudioContext, freq: number, start: number): void {
  const bus = musicGain;
  if (!bus) return;
  const dur = 0.9;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  const peak = 0.06;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain);
  gain.connect(bus);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}
