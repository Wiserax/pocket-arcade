import {
  makeInstrument,
  SAMPLE_RATE,
  SAMPLE_PITCH,
  roomImpulse,
} from "./audio-bank.js";
const hz = (n) => 440 * 2 ** ((n - 69) / 12);
const THEMES = {
  robot: {
    bpm: 104,
    root: 50,
    minor: false,
    lead: "kalimba",
    bass: "bass",
    rhythm: "rim",
  },
  factory: {
    bpm: 106,
    root: 48,
    minor: true,
    lead: "pluck",
    bass: "bass",
    rhythm: "wood",
  },
  ricochet: {
    bpm: 110,
    root: 55,
    minor: true,
    lead: "kalimba",
    bass: "bass",
    rhythm: "drum-high",
  },
  diner: {
    bpm: 100,
    root: 53,
    minor: false,
    lead: "pluck",
    bass: "bass",
    rhythm: "rim",
  },
  drill: {
    bpm: 88,
    root: 50,
    minor: true,
    lead: "pluck",
    bass: "bass",
    rhythm: "drum-low",
  },
  harbor: {
    bpm: 80,
    root: 55,
    minor: false,
    lead: "flute",
    bass: "pluck",
    rhythm: "shaker",
  },
  train: {
    bpm: 116,
    root: 48,
    minor: false,
    lead: "pluck",
    bass: "bass",
    rhythm: "rim",
  },
  mech: {
    bpm: 118,
    root: 45,
    minor: true,
    lead: "kalimba",
    bass: "bass",
    rhythm: "drum-low",
  },
  worlds: {
    bpm: 72,
    root: 53,
    minor: false,
    lead: "kalimba",
    bass: "pluck",
    rhythm: null,
  },
  cleanup: {
    bpm: 102,
    root: 55,
    minor: false,
    lead: "pluck",
    bass: "bass",
    rhythm: "shaker",
  },
};
const MELODIES = [
  [0, 2, 4, null, 7, 4, 2, null, 0, 4, 7, 9, 7, null, 4, null],
  [4, null, 2, 0, null, 2, 4, 7, 9, 7, null, 4, 2, null, 0, null],
  [7, 9, 11, null, 9, 7, 4, null, 2, 4, 7, null, 4, 2, 0, null],
  [0, null, 4, null, 7, null, 4, 2, 0, null, 2, 4, 2, null, 0, null],
];
export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.last = {};
    this.buffers = new Map();
    this.voices = new Set();
    this.step = 0;
    this.next = 0;
    this.game = "robot";
    this.active = false;
    this.duckUntil = 0;
    this.stats = { played: 0, peak: 0, dropped: 0 };
  }
  unlock() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const c = (this.ctx = new AudioContext());
      this.master = c.createGain();
      this.master.gain.value = 0.8;
      const limiter = c.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 8;
      limiter.ratio.value = 4;
      limiter.attack.value = 0.005;
      limiter.release.value = 0.13;
      this.master.connect(limiter);
      limiter.connect(c.destination);
      this.music = c.createGain();
      this.effects = c.createGain();
      this.music.connect(this.master);
      this.effects.connect(this.master);
      this.room = c.createConvolver();
      const channels = roomImpulse(c.sampleRate);
      const impulse = c.createBuffer(2, channels[0].length, c.sampleRate);
      channels.forEach((data, i) => impulse.copyToChannel(data, i));
      this.room.buffer = impulse;
      const wet = c.createGain();
      wet.gain.value = 0.13;
      this.room.connect(wet);
      wet.connect(this.master);
      this.music.connect(this.room);
      this.next = c.currentTime + 0.1;
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }
  setGame(id) {
    if (this.game === id) return;
    this.stopGroup("music");
    this.game = id;
    this.step = 0;
    if (this.ctx) this.next = this.ctx.currentTime + 0.12;
  }
  buffer(name) {
    if (!this.buffers.has(name)) {
      const pcm = makeInstrument(name),
        b = this.ctx.createBuffer(1, pcm.length, SAMPLE_RATE);
      b.copyToChannel(pcm, 0);
      this.buffers.set(name, b);
    }
    return this.buffers.get(name);
  }
  voice(
    name,
    {
      when = 0,
      gain = 0.3,
      pitch = 1,
      duration = null,
      pan = 0,
      bus = "effects",
    } = {},
  ) {
    const c = this.ctx;
    if (!c || c.state !== "running") return;
    if (this.voices.size >= 48) {
      this.stats.dropped++;
      return;
    }
    const src = c.createBufferSource(),
      volume = c.createGain(),
      stereo = c.createStereoPanner();
    src.buffer = this.buffer(name);
    src.playbackRate.value = pitch;
    stereo.pan.value = Math.max(-1, Math.min(1, pan));
    const start = c.currentTime + Math.max(0, when),
      len = duration ?? src.buffer.duration / pitch,
      release = Math.min(0.1, len * 0.3);
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.linearRampToValueAtTime(gain, start + 0.007);
    volume.gain.setValueAtTime(gain, start + Math.max(0.008, len - release));
    volume.gain.exponentialRampToValueAtTime(0.0001, start + len);
    src.connect(volume);
    volume.connect(stereo);
    stereo.connect(bus === "music" ? this.music : this.effects);
    const entry = { src, volume, bus, stop: start + len };
    this.voices.add(entry);
    this.stats.played++;
    this.stats.peak = Math.max(this.stats.peak, this.voices.size);
    src.onended = () => {
      this.voices.delete(entry);
      src.disconnect();
      volume.disconnect();
      stereo.disconnect();
    };
    src.start(start);
    src.stop(start + len + 0.02);
  }
  stopGroup(group) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const v of this.voices)
      if (v.bus === group) {
        v.volume.gain.cancelScheduledValues(t);
        v.volume.gain.setTargetAtTime(0.0001, t, 0.02);
        try {
          v.src.stop(t + 0.09);
        } catch {}
      }
  }
  note(instrument, midi, when, gain = 0.13, length = 0.35, pan = 0) {
    this.voice(instrument, {
      pitch: hz(midi) / (SAMPLE_PITCH[instrument] || 440),
      when,
      gain,
      duration: length,
      pan,
      bus: "music",
    });
  }
  play(name) {
    if (!this.ctx || !this.settings.sfx) return;
    const t = this.ctx.currentTime,
      gap = name === "coin" ? 0.07 : name === "hit" ? 0.055 : 0.075;
    if (t - (this.last[name] ?? -100) < gap) return;
    this.last[name] = t;
    this.effects.gain.setTargetAtTime(this.settings.sfx, t, 0.015);
    const variation = 0.97 + Math.random() * 0.06;
    const sample = (n, g = 0.3, p = 1, when = 0, duration = null) =>
      this.voice(n, { gain: g, pitch: p * variation, when, duration });
    const chime = (notes, spacing = 0.07) =>
      notes.forEach((n, i) =>
        sample("kalimba", 0.3, hz(n) / 440, i * spacing, 0.65),
      );
    if (name === "click") {
      sample("wood", 0.25, 1.6, 0, 0.085);
      return;
    }
    if (name === "coin") {
      const n = (this.last.coinChain =
        t - (this.last.coinPrev ?? -10) < 0.3
          ? Math.min(7, (this.last.coinChain || 0) + 1)
          : 0);
      this.last.coinPrev = t;
      sample("coin", 0.53, 1 + n * 0.025);
      return;
    }
    if (name === "wrong") {
      sample("wood", 0.26, 0.7, 0, 0.14);
      sample("wood", 0.17, 0.6, 0.08, 0.13);
      return;
    }
    if (name === "hit") {
      const material = ["robot", "factory", "mech"].includes(this.game)
        ? "metal"
        : this.game === "drill"
          ? "stone"
          : this.game === "worlds"
            ? "wood"
            : "hit";
      sample(material, 0.32, variation, 0, 0.2);
      return;
    }
    if (name === "shot") {
      sample(
        ["factory", "mech", "train"].includes(this.game) ? "wood" : "bow-shot",
        0.3,
        1.1,
        0,
        0.18,
      );
      if (this.game === "robot") sample("clink", 0.18, 0.8, 0.025, 0.12);
      return;
    }
    if (name === "break") {
      sample("stone", 0.4, 0.7, 0, 0.25);
      sample("crack", 0.25, 0.9, 0.025, 0.28);
      this.duckUntil = t + 0.3;
      return;
    }
    if (name === "build") {
      sample("wood", 0.25, 0.85, 0, 0.12);
      sample("clink", 0.25, 1.1, 0.06, 0.14);
      chime([62, 69, 74]);
      return;
    }
    if (name === "alert") {
      sample("horn", 0.18, 1.5, 0, 0.35);
      sample("bell", 0.2, 0.7, 0.05, 0.5);
      this.duckUntil = t + 0.65;
      return;
    }
    if (name === "win") {
      this.duckUntil = t + 2;
      sample("drum-low", 0.24, 1);
      chime([62, 66, 69, 74], 0.12);
      sample("bell", 0.25, hz(86) / 880, 0.55, 1.3);
      return;
    }
    if (name === "lose") {
      this.duckUntil = t + 1.6;
      chime([69, 66, 62], 0.16);
      return;
    }
  }
  tick(active) {
    if (!this.ctx) return;
    const c = this.ctx,
      now = c.currentTime;
    this.effects.gain.setTargetAtTime(this.settings.sfx, now, 0.04);
    this.music.gain.setTargetAtTime(
      this.settings.music * (now < this.duckUntil ? 0.35 : 1),
      now,
      0.08,
    );
    if (!active || !this.settings.music) {
      if (this.active) this.stopGroup("music");
      this.active = false;
      return;
    }
    if (!this.active) {
      this.next = now + 0.09;
      this.active = true;
    }
    if (c.state !== "running") return;
    const theme = THEMES[this.game] || THEMES.robot,
      stepLength = 60 / theme.bpm / 4;
    if (this.next < now - 0.3) this.next = now + 0.04;
    while (this.next < now + 0.16) {
      const step = this.step % 16,
        bar = Math.floor(this.step / 16),
        phrase = bar % 8,
        root = theme.root + [0, 5, 7, 0, 5, 0, 7, 0][phrase],
        third = theme.minor ? 3 : 4,
        delay = this.next - now;
      if (step % 8 === 0)
        this.note(theme.bass, root - 12, delay, 0.15, 0.7, -0.15);
      if (step === 0 && phrase % 2 === 0) {
        for (const n of [root, root + third, root + 7])
          this.note("bow", n, delay, 0.028, 1.6, 0.1);
      }
      const melody =
          MELODIES[(Math.floor(bar / 2) + (this.game.length % 4)) % 4],
        note = melody[step];
      if (note !== null && step % 2 === 0) {
        const corrected = theme.minor
          ? note === 4
            ? 3
            : note === 9
              ? 8
              : note === 11
                ? 10
                : note
          : note;
        this.note(
          theme.lead,
          root + 12 + corrected,
          delay,
          0.115,
          theme.lead === "flute" ? 0.36 : 0.6,
          Math.sin(step) * 0.28,
        );
      }
      if (theme.rhythm) {
        if (step === 0 || step === 8)
          this.voice("drum-low", {
            when: delay,
            gain: 0.1,
            pitch: 1,
            duration: 0.28,
            bus: "music",
          });
        if (step === 4 || step === 12)
          this.voice(theme.rhythm, {
            when: delay,
            gain: 0.12,
            pitch: 1.15,
            duration: 0.13,
            bus: "music",
          });
        if (step % 2)
          this.voice("shaker", {
            when: delay,
            gain: 0.035,
            pitch: 1.2,
            duration: 0.09,
            pan: step % 4 === 1 ? -0.35 : 0.35,
            bus: "music",
          });
      }
      this.step++;
      this.next += stepLength;
    }
  }
}
