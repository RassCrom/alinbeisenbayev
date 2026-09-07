import type { WeatherLook } from './weather/sim.ts';

/*
 * Ambient sound (stage 7): waves, wind and a blizzard howl, mixed from the
 * weather look with slow cross-fades. Nothing is downloaded: the three
 * voices are shaped noise from the Web Audio graph, which keeps the map
 * free of audio files and their licences, loops without a seam, and reacts
 * to the weather continuously rather than switching between clips.
 *
 *   waves     brown noise through a low-pass, swelling on a slow LFO
 *   wind      white noise through a wandering band-pass
 *   blizzard  a higher, narrower band with a fast flutter
 *
 * Muted by default: the AudioContext is created on the first toggle, so no
 * sound ever starts without a gesture. `update` is cheap enough to call
 * every frame, but the view calls it a few times a second.
 */

export interface AmbientAudio {
  enabled(): boolean;
  /** Turn the sound on or off; resolves with the new state. */
  toggle(): Promise<boolean>;
  update(look: WeatherLook): void;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

const MASTER_LEVEL = 0.55;
/** Seconds for a voice to reach a new level, and for the master to fade in and out. */
const VOICE_FADE = 2.5;
const MASTER_FADE = 1.2;

interface Voice {
  level: GainNode;
}

function noiseBuffer(context: AudioContext, seconds: number, brown: boolean): AudioBuffer {
  const frames = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < frames; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      // Leaky integration: a 1/f² slope, normalised to stay within range.
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

function loopSource(context: AudioContext, buffer: AudioBuffer): AudioBufferSourceNode {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.start();
  return source;
}

/** A sine LFO wired into an AudioParam: `param = base + depth × sin`. */
function lfo(context: AudioContext, param: AudioParam, hertz: number, depth: number): void {
  const oscillator = context.createOscillator();
  oscillator.frequency.value = hertz;
  const gain = context.createGain();
  gain.gain.value = depth;
  oscillator.connect(gain).connect(param);
  oscillator.start();
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export function createAmbientAudio(): AmbientAudio {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let voices: { waves: Voice; wind: Voice; blizzard: Voice } | null = null;
  let on = false;
  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  const build = (): void => {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) throw new Error('Web Audio is not available');
    context = new Ctor();
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);

    const brown = noiseBuffer(context, 4, true);
    const white = noiseBuffer(context, 4, false);

    // Waves: deep rumble with a swell every twelve seconds or so.
    const wavesFilter = context.createBiquadFilter();
    wavesFilter.type = 'lowpass';
    wavesFilter.frequency.value = 420;
    wavesFilter.Q.value = 0.4;
    const swell = context.createGain();
    swell.gain.value = 0.7;
    lfo(context, swell.gain, 0.085, 0.3);
    const wavesLevel = context.createGain();
    wavesLevel.gain.value = 0;
    loopSource(context, brown).connect(wavesFilter).connect(swell).connect(wavesLevel).connect(master);

    // Wind: a band that wanders up and down, gusting slowly.
    const windFilter = context.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 650;
    windFilter.Q.value = 0.9;
    lfo(context, windFilter.frequency, 0.13, 320);
    const gust = context.createGain();
    gust.gain.value = 0.75;
    lfo(context, gust.gain, 0.21, 0.25);
    const windLevel = context.createGain();
    windLevel.gain.value = 0;
    loopSource(context, white).connect(windFilter).connect(gust).connect(windLevel).connect(master);

    // Blizzard: higher and narrower, with a fast flutter.
    const howlFilter = context.createBiquadFilter();
    howlFilter.type = 'bandpass';
    howlFilter.frequency.value = 1500;
    howlFilter.Q.value = 2.2;
    lfo(context, howlFilter.frequency, 0.37, 500);
    const flutter = context.createGain();
    flutter.gain.value = 0.7;
    lfo(context, flutter.gain, 0.9, 0.3);
    const howlLevel = context.createGain();
    howlLevel.gain.value = 0;
    loopSource(context, white).connect(howlFilter).connect(flutter).connect(howlLevel).connect(master);

    voices = { waves: { level: wavesLevel }, wind: { level: windLevel }, blizzard: { level: howlLevel } };
  };

  return {
    enabled: () => on,
    async toggle() {
      if (!on) {
        if (!context) build();
        if (context!.state === 'suspended') await context!.resume();
        master!.gain.cancelScheduledValues(context!.currentTime);
        master!.gain.setTargetAtTime(MASTER_LEVEL, context!.currentTime, MASTER_FADE / 3);
        on = true;
      } else if (context && master) {
        master.gain.cancelScheduledValues(context.currentTime);
        master.gain.setTargetAtTime(0, context.currentTime, MASTER_FADE / 3);
        on = false;
        const ctx = context;
        window.setTimeout(() => {
          if (!on && ctx.state === 'running') void ctx.suspend();
        }, MASTER_FADE * 1000 + 200);
      }
      notify();
      return on;
    },
    update(look) {
      if (!context || !voices || !on) return;
      const wind = clamp01(look.windSpeed / 45);
      const waves = 0.3 + 0.5 * wind + 0.2 * look.storm;
      const gale = clamp01((look.windSpeed - 6) / 30) * (0.45 + 0.35 * look.storm) + 0.25 * look.rain;
      const howl = look.snow * (0.3 + 0.7 * wind) * 0.8;
      const now = context.currentTime;
      voices.waves.level.gain.setTargetAtTime(clamp01(waves), now, VOICE_FADE / 3);
      voices.wind.level.gain.setTargetAtTime(clamp01(gale), now, VOICE_FADE / 3);
      voices.blizzard.level.gain.setTargetAtTime(clamp01(howl), now, VOICE_FADE / 3);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      on = false;
      void context?.close();
      context = null;
      master = null;
      voices = null;
    },
  };
}
