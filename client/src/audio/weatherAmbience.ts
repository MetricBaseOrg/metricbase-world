import { getWeather, ZONE_INTERIOR } from "@metricbase/shared";
import { networkManager } from "../game/network";
import { isMusicEnabled } from "./backgroundMusic";
import { getAudioContext } from "./soundEffects";

// Procedural weather ambience: a continuous filtered-noise rain bed whose
// loudness tracks the shared weather clock, plus occasional thunder rumbles
// during storms. No audio files — synthesized through the shared AudioContext.
// It rides the music toggle (it's a continuous ambient layer, like the score).

const RAIN_MAX_GAIN = 0.16;

let rainSource: AudioBufferSourceNode | null = null;
let rainGain: GainNode | null = null;
let rainFilter: BiquadFilterNode | null = null;
let running = false;
let wantInWorld = false;
let tickTimer: number | null = null;
let nextThunderAt = 0;

/** Call when the player enters the world. */
export function startWeatherAmbience(): void {
  wantInWorld = true;
  sync();
}

/** Call when the player leaves the world. */
export function stopWeatherAmbience(): void {
  wantInWorld = false;
  sync();
}

function sync(): void {
  if (wantInWorld) startLoop();
  else stopLoop();
}

/** Soft "brown" noise — gentler than white noise, reads as rain hiss. */
function makeNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const size = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < size; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

function startLoop(): void {
  if (running) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  running = true;

  rainFilter = ctx.createBiquadFilter();
  rainFilter.type = "lowpass";
  rainFilter.frequency.value = 1200;
  rainFilter.Q.value = 0.5;

  rainGain = ctx.createGain();
  rainGain.gain.value = 0.0001;

  rainSource = ctx.createBufferSource();
  rainSource.buffer = makeNoiseBuffer(ctx, 2.5);
  rainSource.loop = true;
  rainSource.connect(rainFilter);
  rainFilter.connect(rainGain);
  rainGain.connect(ctx.destination);
  rainSource.start();

  tick();
}

function stopLoop(): void {
  if (!running) return;
  running = false;
  if (tickTimer !== null) {
    window.clearTimeout(tickTimer);
    tickTimer = null;
  }
  const ctx = getAudioContext();
  if (ctx && rainGain) {
    const now = ctx.currentTime;
    rainGain.gain.cancelScheduledValues(now);
    rainGain.gain.setValueAtTime(Math.max(0.0001, rainGain.gain.value), now);
    rainGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
  }
  const src = rainSource;
  if (src && ctx) {
    try {
      src.stop(ctx.currentTime + 1);
    } catch {
      /* already stopped */
    }
  }
  rainSource = null;
  rainGain = null;
  rainFilter = null;
}

function tick(): void {
  if (!running) return;
  const ctx = getAudioContext();
  if (!ctx || !rainGain || !rainFilter) return;

  const weather = getWeather();
  const indoors = networkManager.zoneId === ZONE_INTERIOR;
  const muted = !isMusicEnabled() || indoors;
  const rain = muted ? 0 : weather.rain;

  const now = ctx.currentTime;
  const targetGain = Math.max(0.0001, rain * RAIN_MAX_GAIN);
  rainGain.gain.cancelScheduledValues(now);
  rainGain.gain.setValueAtTime(Math.max(0.0001, rainGain.gain.value), now);
  rainGain.gain.linearRampToValueAtTime(targetGain, now + 1.6);

  // Heavier rain is brighter (more high-frequency hiss).
  rainFilter.frequency.cancelScheduledValues(now);
  rainFilter.frequency.linearRampToValueAtTime(900 + rain * 1700, now + 1.6);

  // Thunder during storms.
  if (!muted && weather.lightning && weather.rain > 0.5) {
    const t = Date.now();
    if (t >= nextThunderAt) {
      nextThunderAt = t + 6000 + Math.random() * 10000;
      playThunder(ctx);
    }
  }

  tickTimer = window.setTimeout(tick, 1500);
}

function playThunder(ctx: AudioContext): void {
  const now = ctx.currentTime;
  const dur = 1.8 + Math.random() * 1.4;

  // Low rumble: brown-noise burst through a low-pass with a long decay.
  const noise = ctx.createBufferSource();
  noise.buffer = makeNoiseBuffer(ctx, dur);
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = 380;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.4, now + 0.08);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + dur + 0.05);

  // Sub-bass boom that sinks as it fades.
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(72, now);
  osc.frequency.exponentialRampToValueAtTime(38, now + dur);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.0001, now);
  oscGain.gain.exponentialRampToValueAtTime(0.18, now + 0.1);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + dur + 0.05);
}
