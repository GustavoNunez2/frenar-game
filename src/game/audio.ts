import { CharacterId } from './types';

export type MusicMode = 'menu' | 'level' | 'boss' | 'victory' | 'paused';

const STORAGE_KEY_MUSIC_VOL = 'frenar_music_volume_v1';
const STORAGE_KEY_MUTED = 'frenar_audio_muted_v1';

interface CuartetoBar {
  bassRoot: number; // Hz
  bassFifth: number; // Hz
  bassOctave: number; // Hz
  chord: number[]; // Triad/7th freqs for off-beat tunga-tunga piano/organ chops
  melody: Array<number | null>; // 16 steps per bar (16th notes)
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Progresión bailable estilo Cuarteto de Córdoba Capital (tunga-tunga en La menor / Do mayor)
// Compases de 16 semicorcheas con melodía festiva de acordeón/bronces en bits
const LEVEL_BARS: CuartetoBar[] = [
  {
    // Am (A2 - E3 - A3)
    bassRoot: midiToFreq(45),
    bassFifth: midiToFreq(52),
    bassOctave: midiToFreq(57),
    chord: [midiToFreq(69), midiToFreq(72), midiToFreq(76)],
    melody: [
      midiToFreq(76), null, midiToFreq(79), null,
      midiToFreq(81), null, midiToFreq(79), midiToFreq(76),
      midiToFreq(72), null, midiToFreq(76), null,
      midiToFreq(79), null, midiToFreq(76), null,
    ],
  },
  {
    // G (G2 - D3 - G3)
    bassRoot: midiToFreq(43),
    bassFifth: midiToFreq(50),
    bassOctave: midiToFreq(55),
    chord: [midiToFreq(67), midiToFreq(71), midiToFreq(74)],
    melody: [
      midiToFreq(74), null, midiToFreq(77), null,
      midiToFreq(79), null, midiToFreq(77), midiToFreq(74),
      midiToFreq(71), null, midiToFreq(74), null,
      midiToFreq(77), null, midiToFreq(74), null,
    ],
  },
  {
    // F (F2 - C3 - F3)
    bassRoot: midiToFreq(41),
    bassFifth: midiToFreq(48),
    bassOctave: midiToFreq(53),
    chord: [midiToFreq(65), midiToFreq(69), midiToFreq(72)],
    melody: [
      midiToFreq(72), null, midiToFreq(76), null,
      midiToFreq(77), null, midiToFreq(76), midiToFreq(72),
      midiToFreq(69), null, midiToFreq(72), null,
      midiToFreq(76), null, midiToFreq(74), null,
    ],
  },
  {
    // E7 (E2 - B2 - E3) con corte sabroso cordobés
    bassRoot: midiToFreq(40),
    bassFifth: midiToFreq(47),
    bassOctave: midiToFreq(52),
    chord: [midiToFreq(64), midiToFreq(68), midiToFreq(71), midiToFreq(74)],
    melody: [
      midiToFreq(76), null, midiToFreq(74), midiToFreq(72),
      midiToFreq(71), null, midiToFreq(68), null,
      midiToFreq(71), null, midiToFreq(74), null,
      midiToFreq(76), null, midiToFreq(79), null,
    ],
  },
  {
    // C (C3 - G3 - C4) - Estribillo alegre
    bassRoot: midiToFreq(48),
    bassFifth: midiToFreq(55),
    bassOctave: midiToFreq(60),
    chord: [midiToFreq(72), midiToFreq(76), midiToFreq(79)],
    melody: [
      midiToFreq(84), null, midiToFreq(83), midiToFreq(81),
      midiToFreq(79), null, midiToFreq(76), null,
      midiToFreq(79), null, midiToFreq(81), null,
      midiToFreq(84), null, null, null,
    ],
  },
  {
    // G (G2 - D3 - G3)
    bassRoot: midiToFreq(43),
    bassFifth: midiToFreq(50),
    bassOctave: midiToFreq(55),
    chord: [midiToFreq(67), midiToFreq(71), midiToFreq(74)],
    melody: [
      midiToFreq(83), null, midiToFreq(81), midiToFreq(79),
      midiToFreq(77), null, midiToFreq(74), null,
      midiToFreq(77), null, midiToFreq(79), null,
      midiToFreq(83), null, null, null,
    ],
  },
  {
    // Am (A2 - E3 - A3)
    bassRoot: midiToFreq(45),
    bassFifth: midiToFreq(52),
    bassOctave: midiToFreq(57),
    chord: [midiToFreq(69), midiToFreq(72), midiToFreq(76)],
    melody: [
      midiToFreq(81), null, midiToFreq(79), null,
      midiToFreq(76), null, midiToFreq(79), null,
      midiToFreq(81), null, midiToFreq(84), null,
      midiToFreq(81), null, midiToFreq(79), null,
    ],
  },
  {
    // E7 (E2 - B2 - E3) - Cierre para reiniciar vuelta
    bassRoot: midiToFreq(40),
    bassFifth: midiToFreq(47),
    bassOctave: midiToFreq(52),
    chord: [midiToFreq(64), midiToFreq(68), midiToFreq(71), midiToFreq(74)],
    melody: [
      midiToFreq(76), null, midiToFreq(74), null,
      midiToFreq(72), null, midiToFreq(71), null,
      midiToFreq(68), midiToFreq(71), midiToFreq(74), null,
      midiToFreq(76), null, null, null,
    ],
  },
];

// Cuarteto intenso de batalla contra Jefes (Em -> D -> C -> B7)
const BOSS_BARS: CuartetoBar[] = [
  {
    bassRoot: midiToFreq(40),
    bassFifth: midiToFreq(47),
    bassOctave: midiToFreq(52),
    chord: [midiToFreq(64), midiToFreq(67), midiToFreq(71)],
    melody: [
      midiToFreq(76), null, midiToFreq(79), midiToFreq(83),
      midiToFreq(84), null, midiToFreq(83), null,
      midiToFreq(79), null, midiToFreq(76), midiToFreq(79),
      midiToFreq(83), null, midiToFreq(76), null,
    ],
  },
  {
    bassRoot: midiToFreq(38),
    bassFifth: midiToFreq(45),
    bassOctave: midiToFreq(50),
    chord: [midiToFreq(62), midiToFreq(66), midiToFreq(69)],
    melody: [
      midiToFreq(74), null, midiToFreq(78), midiToFreq(81),
      midiToFreq(83), null, midiToFreq(81), null,
      midiToFreq(78), null, midiToFreq(74), midiToFreq(78),
      midiToFreq(81), null, midiToFreq(74), null,
    ],
  },
  {
    bassRoot: midiToFreq(36),
    bassFifth: midiToFreq(43),
    bassOctave: midiToFreq(48),
    chord: [midiToFreq(60), midiToFreq(64), midiToFreq(67)],
    melody: [
      midiToFreq(72), null, midiToFreq(76), midiToFreq(79),
      midiToFreq(81), null, midiToFreq(79), null,
      midiToFreq(76), null, midiToFreq(72), null,
      midiToFreq(79), null, midiToFreq(76), null,
    ],
  },
  {
    bassRoot: midiToFreq(35),
    bassFifth: midiToFreq(42),
    bassOctave: midiToFreq(47),
    chord: [midiToFreq(63), midiToFreq(66), midiToFreq(71)],
    melody: [
      midiToFreq(75), null, midiToFreq(78), null,
      midiToFreq(83), null, midiToFreq(81), midiToFreq(78),
      midiToFreq(75), null, midiToFreq(78), null,
      midiToFreq(83), null, midiToFreq(87), null,
    ],
  },
];

// Cuarteto festivo mayor para Victoria y Cinemática del taller FRENAR
const VICTORY_BARS: CuartetoBar[] = [
  {
    bassRoot: midiToFreq(48),
    bassFifth: midiToFreq(55),
    bassOctave: midiToFreq(60),
    chord: [midiToFreq(72), midiToFreq(76), midiToFreq(79)],
    melody: [
      midiToFreq(79), null, midiToFreq(84), null,
      midiToFreq(88), null, midiToFreq(86), midiToFreq(84),
      midiToFreq(81), null, midiToFreq(84), null,
      midiToFreq(88), null, null, null,
    ],
  },
  {
    bassRoot: midiToFreq(43),
    bassFifth: midiToFreq(50),
    bassOctave: midiToFreq(55),
    chord: [midiToFreq(67), midiToFreq(71), midiToFreq(74)],
    melody: [
      midiToFreq(83), null, midiToFreq(86), null,
      midiToFreq(83), null, midiToFreq(79), null,
      midiToFreq(74), null, midiToFreq(79), null,
      midiToFreq(83), null, null, null,
    ],
  },
  {
    bassRoot: midiToFreq(41),
    bassFifth: midiToFreq(48),
    bassOctave: midiToFreq(53),
    chord: [midiToFreq(65), midiToFreq(69), midiToFreq(72)],
    melody: [
      midiToFreq(81), null, midiToFreq(84), null,
      midiToFreq(86), null, midiToFreq(84), midiToFreq(81),
      midiToFreq(77), null, midiToFreq(81), null,
      midiToFreq(84), null, null, null,
    ],
  },
  {
    bassRoot: midiToFreq(43),
    bassFifth: midiToFreq(50),
    bassOctave: midiToFreq(55),
    chord: [midiToFreq(67), midiToFreq(71), midiToFreq(74)],
    melody: [
      midiToFreq(79), null, midiToFreq(83), null,
      midiToFreq(86), null, midiToFreq(84), null,
      midiToFreq(83), null, midiToFreq(79), null,
      midiToFreq(84), null, null, null,
    ],
  },
];

/**
 * Sintetizador de efectos de sonido + secuenciador musical en tiempo real (Web Audio API)
 * estilo CUARTETO DE CÓRDOBA CAPITAL en bits (16/32-bit chiptune + ritmo tunga-tunga).
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private muted = false;
  private musicVolume = 0.65;
  private musicMode: MusicMode = 'menu';

  private schedulerTimer: number | null = null;
  private nextStepTime = 0;
  private currentStep = 0;

  constructor() {
    this.musicVolume = this.readSavedVolume();
    this.muted = this.readSavedMuted();
  }

  private readSavedVolume(): number {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_MUSIC_VOL);
      if (raw !== null) {
        const parsed = Number(raw);
        if (!Number.isNaN(parsed)) {
          return Math.max(0, Math.min(1, parsed));
        }
      }
    } catch {
      // Ignorar si localStorage no está disponible
    }
    return 0.65;
  }

  private writeSavedVolume(vol: number): void {
    try {
      window.localStorage.setItem(STORAGE_KEY_MUSIC_VOL, vol.toFixed(2));
    } catch {
      // Ignorar
    }
  }

  private readSavedMuted(): boolean {
    try {
      return window.localStorage.getItem(STORAGE_KEY_MUTED) === 'true';
    } catch {
      return false;
    }
  }

  private writeSavedMuted(muted: boolean): void {
    try {
      window.localStorage.setItem(STORAGE_KEY_MUTED, muted ? 'true' : 'false');
    } catch {
      // Ignorar
    }
  }

  private ensureContext(forMusic = false): AudioContext | null {
    if (!forMusic && this.muted) return null;
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = this.muted ? 0 : 1;
        this.sfxGain.connect(this.ctx.destination);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = this.getEffectiveMusicGain();
        this.musicGain.connect(this.ctx.destination);

        this.noiseBuffer = this.createNoiseBuffer(this.ctx);
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 0.25);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private getEffectiveMusicGain(): number {
    if (this.muted || this.musicVolume <= 0.001) return 0;
    const modeScale =
      this.musicMode === 'paused'
        ? 0.34
        : this.musicMode === 'menu'
          ? 0.52
          : this.musicMode === 'boss'
            ? 0.92
            : 0.8;
    return Math.min(0.65, this.musicVolume * 0.55 * modeScale);
  }

  private syncGains(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(this.muted ? 0 : 1, now, 0.02);
    }
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(
        this.getEffectiveMusicGain(),
        now,
        0.04
      );
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.writeSavedMuted(muted);
    this.syncGains();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  public setMusicVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, Math.round(volume * 20) / 20));
    this.musicVolume = clamped;
    this.writeSavedVolume(clamped);
    if (clamped > 0 && this.muted) {
      this.muted = false;
      this.writeSavedMuted(false);
    }
    this.ensureContext(true);
    this.syncGains();
    this.startMusicLoop();
  }

  public stepMusicVolume(delta: number): void {
    this.setMusicVolume(this.musicVolume + delta);
  }

  public setMusicMode(mode: MusicMode): void {
    if (this.musicMode === mode) return;
    this.musicMode = mode;
    this.syncGains();
  }

  public unlock(): void {
    const ctx = this.ensureContext(true);
    if (ctx) {
      this.syncGains();
      this.startMusicLoop();
    }
  }

  private startMusicLoop(): void {
    if (typeof window === 'undefined') return;
    if (this.schedulerTimer !== null) return;
    const ctx = this.ctx;
    if (!ctx) return;

    this.nextStepTime = ctx.currentTime + 0.05;
    this.schedulerTimer = window.setInterval(() => {
      this.scheduleMusicAhead();
    }, 28);
  }

  private getStepDuration(): number {
    const bpm =
      this.musicMode === 'boss'
        ? 156
        : this.musicMode === 'victory'
          ? 138
          : this.musicMode === 'menu' || this.musicMode === 'paused'
            ? 136
            : 146;
    return 60 / bpm / 4; // 16th note
  }

  private scheduleMusicAhead(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (this.muted || this.musicVolume <= 0.001) {
      this.nextStepTime = Math.max(this.nextStepTime, ctx.currentTime + 0.04);
      return;
    }

    const lookahead = 0.14;
    const stepDur = this.getStepDuration();

    if (this.nextStepTime < ctx.currentTime - 0.25) {
      this.nextStepTime = ctx.currentTime + 0.04;
    }

    while (this.nextStepTime < ctx.currentTime + lookahead) {
      this.scheduleCuartetoStep(this.currentStep, this.nextStepTime, stepDur);
      this.nextStepTime += stepDur;
      this.currentStep += 1;
    }
  }

  private scheduleCuartetoStep(
    stepGlobal: number,
    time: number,
    stepDur: number
  ): void {
    const bars =
      this.musicMode === 'boss'
        ? BOSS_BARS
        : this.musicMode === 'victory'
          ? VICTORY_BARS
          : LEVEL_BARS;

    const barIdx = Math.floor(stepGlobal / 16) % bars.length;
    const step = stepGlobal % 16;
    const bar = bars[barIdx];

    // 1. BOMBO ("TUN") en tiempos fuertes 0, 4, 8, 12
    if (step % 4 === 0) {
      this.playCuartetoKick(time);
    }

    // 2. BAJO TUNGA-TUNGA (pulso marcado en tierra + caminata rítmica)
    if (step === 0) {
      this.playCuartetoBass(bar.bassRoot, time, stepDur * 1.85);
    } else if (step === 4) {
      this.playCuartetoBass(bar.bassFifth, time, stepDur * 1.75);
    } else if (step === 8) {
      this.playCuartetoBass(bar.bassOctave, time, stepDur * 1.75);
    } else if (step === 12) {
      this.playCuartetoBass(bar.bassFifth, time, stepDur * 1.75);
    } else if (step === 14 && (this.musicMode === 'boss' || barIdx % 2 === 1)) {
      this.playCuartetoBass(bar.bassRoot * 1.12, time, stepDur * 1.1);
    }

    // 3. PIANO / ACORDEÓN DE CONTRATIEMPO ("GA") en pasos 2, 6, 10, 14
    if (step % 4 === 2) {
      this.playCuartetoChordChop(bar.chord, time, stepDur * 1.25);
      this.playCuartetoSnare(time, 0.085);
    }

    // 4. GÜIRO / MARACA CORDOBESA EN SEMICORCHEAS ("chiki-chaka")
    if (step % 2 === 1) {
      this.playGuiroScrape(time, step % 4 === 3 ? 0.055 : 0.032);
    }

    // 5. CENCERRO / TIMBAL FESTIVO (en jefes y compases pares de nivel)
    if (
      (this.musicMode === 'boss' && (step === 2 || step === 6 || step === 10 || step === 14)) ||
      (this.musicMode === 'victory' && (step === 0 || step === 6 || step === 12))
    ) {
      this.playCowbell(time, step === 0 ? 0.06 : 0.04);
    }

    // 6. MELODÍA PRINCIPAL 16-BIT (Acordeón / Bronces de cuarteto)
    const melFreq = bar.melody[step];
    if (melFreq !== null && this.musicMode !== 'paused') {
      const leadDur =
        step + 1 < 16 && bar.melody[step + 1] === null ? stepDur * 1.9 : stepDur * 0.95;
      this.playCuartetoLead(melFreq, time, leadDur);
    }
  }

  private playCuartetoKick(time: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(142, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.36, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.14);
  }

  private playCuartetoBass(freq: number, time: number, dur: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, time);
    filter.frequency.exponentialRampToValueAtTime(190, time + dur);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.24, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private playCuartetoChordChop(
    freqs: number[],
    time: number,
    dur: number
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1350, time);
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.095, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    filter.connect(gain);
    gain.connect(this.musicGain);

    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, time);
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + dur + 0.015);
    }
  }

  private playCuartetoLead(freq: number, time: number, dur: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    // Sonido acordeón/bronce 16-bit con ligera desafinación cálida
    osc1.type = 'square';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq * 1.004, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(
      this.musicMode === 'menu' ? 1400 : 2700,
      time
    );

    const vol = this.musicMode === 'menu' ? 0.055 : 0.092;
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + dur + 0.02);
    osc2.stop(time + dur + 0.02);
  }

  private playCuartetoSnare(time: number, vol: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1600, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    src.start(time);
    src.stop(time + 0.09);
  }

  private playGuiroScrape(time: number, vol: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(4800, time);
    filter.Q.value = 3.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.055);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    src.start(time);
    src.stop(time + 0.065);
  }

  private playCowbell(time: number, vol: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'square';
    osc2.type = 'square';
    osc1.frequency.setValueAtTime(540, time);
    osc2.frequency.setValueAtTime(800, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.075);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.musicGain);
    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + 0.085);
    osc2.stop(time + 0.085);
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType = 'triangle',
    gainVal = 0.16,
    delay = 0
  ): void {
    const ctx = this.ensureContext(false);
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, freqStart), now);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, freqEnd),
      now + duration
    );

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(gainVal, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playJump(): void {
    this.playTone(230, 580, 0.16, 'sine', 0.15);
    this.playTone(340, 740, 0.12, 'triangle', 0.08, 0.02);
  }

  public playBounce(): void {
    this.playTone(170, 920, 0.25, 'sine', 0.18);
    this.playTone(260, 1100, 0.2, 'triangle', 0.1, 0.03);
  }

  public playFluidPickup(): void {
    this.playTone(520, 880, 0.09, 'sine', 0.13);
    this.playTone(880, 1280, 0.11, 'triangle', 0.11, 0.05);
  }

  public playPartPickup(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, n * 1.03, 0.16, 'triangle', 0.14, idx * 0.065);
    });
  }

  public playEnemyPop(): void {
    this.playTone(480, 130, 0.14, 'square', 0.11);
    this.playTone(760, 1180, 0.1, 'sine', 0.12, 0.03);
  }

  public playHurt(): void {
    this.playTone(240, 85, 0.28, 'sawtooth', 0.15);
    this.playTone(190, 65, 0.3, 'square', 0.1, 0.04);
  }

  public playNoFluid(): void {
    this.playTone(180, 140, 0.09, 'square', 0.08);
    this.playTone(140, 110, 0.1, 'square', 0.08, 0.08);
  }

  public playPower(characterId: CharacterId): void {
    switch (characterId) {
      case 'rodolfo':
        this.playTone(320, 520, 0.08, 'sawtooth', 0.12);
        this.playTone(380, 620, 0.1, 'sawtooth', 0.13, 0.1);
        break;
      case 'marcela':
        this.playTone(620, 1120, 0.16, 'triangle', 0.12);
        this.playTone(900, 1480, 0.18, 'sine', 0.1, 0.06);
        break;
      case 'gustavo':
        this.playTone(220, 440, 0.18, 'sawtooth', 0.1);
        this.playTone(329.6, 659.2, 0.2, 'sawtooth', 0.09, 0.03);
        this.playTone(440, 880, 0.22, 'square', 0.07, 0.06);
        break;
      case 'micaela':
        this.playTone(440, 554, 0.24, 'sine', 0.12);
        this.playTone(659, 880, 0.3, 'sine', 0.1, 0.08);
        break;
      case 'lautaro':
        this.playTone(920, 260, 0.15, 'sawtooth', 0.13);
        this.playTone(300, 980, 0.16, 'triangle', 0.12, 0.12);
        break;
      case 'leandro':
        this.playTone(1100, 320, 0.11, 'triangle', 0.15);
        this.playTone(1450, 720, 0.09, 'sine', 0.12, 0.04);
        break;
    }
  }

  public playSonicShot(): void {
    this.playTone(640, 280, 0.12, 'sawtooth', 0.08);
  }

  public playLevelClear(): void {
    const melody = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    melody.forEach((freq, i) => {
      this.playTone(freq, freq * 1.02, 0.22, 'triangle', 0.15, i * 0.085);
    });
  }

  public playVictory(): void {
    const fanfare = [523.25, 659.25, 783.99, 1046.5, 987.77, 1046.5, 1567.98];
    fanfare.forEach((freq, i) => {
      this.playTone(freq, freq * 1.01, 0.28, 'triangle', 0.16, i * 0.1);
    });
  }

  public playBossHit(): void {
    this.playTone(220, 75, 0.18, 'sawtooth', 0.16);
    this.playTone(540, 290, 0.12, 'square', 0.1, 0.02);
  }

  public playBossDefeat(): void {
    this.playTone(320, 55, 0.45, 'sawtooth', 0.18);
    this.playTone(440, 880, 0.28, 'triangle', 0.14, 0.2);
    this.playTone(660, 1320, 0.35, 'triangle', 0.16, 0.38);
  }

  public playUnlockCharacter(): void {
    const chord = [587.33, 739.99, 880, 1174.66];
    chord.forEach((freq, i) => {
      this.playTone(freq, freq * 1.02, 0.25, 'sine', 0.15, i * 0.08);
    });
  }

  public playFreeze(): void {
    this.playTone(1320, 620, 0.22, 'triangle', 0.14);
    this.playTone(1760, 2240, 0.14, 'sine', 0.1, 0.03);
    this.playTone(980, 520, 0.2, 'square', 0.06, 0.05);
  }

  public playIceBreak(): void {
    this.playTone(960, 280, 0.12, 'square', 0.12);
    this.playTone(1480, 520, 0.14, 'triangle', 0.12, 0.03);
  }

  public playUpdraftWhoosh(): void {
    this.playTone(190, 920, 0.28, 'sine', 0.15);
    this.playTone(320, 1180, 0.22, 'triangle', 0.09, 0.03);
  }

  public playSuctionWhoosh(): void {
    this.playTone(540, 110, 0.26, 'sawtooth', 0.11);
    this.playTone(360, 90, 0.28, 'triangle', 0.1, 0.04);
  }
}

export const soundEngine = new SoundEngine();
