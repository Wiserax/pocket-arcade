// Original Firstfire instruments. Deterministic PCM, generated once, then sampled.
// No downloads, timer-driven oscillators, or allocations in the combat hot path.
export const SAMPLE_RATE = 24000;
const TAU = Math.PI * 2;
export function randomStream(seed = 1234) {
  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
}
const sin = (f, t) => Math.sin(TAU * f * t);
const fade = (t, length, attack = 0.002, release = 0.018) =>
  Math.min(1, t / attack, (length - t) / release);

function render(length, fn, seed = 7331) {
  const data = new Float32Array(Math.ceil(length * SAMPLE_RATE)),
    random = randomStream(seed);
  let low = 0,
    last = 0;
  const noise = () => random() * 2 - 1;
  for (let i = 0; i < data.length; i++) {
    const t = i / SAMPLE_RATE,
      n = noise();
    low += 0.065 * (n - low);
    const x = fn(t, n, low, i, noise) * Math.max(0, fade(t, length));
    // DC blocker; very soft saturation only on occasional transients.
    data[i] = Math.tanh(x - last * 0.015);
    last = x;
  }
  return data;
}

// Karplus–Strong string with a shaped pick impulse and wooden body modes.
function stringSample() {
  const length = 2.5,
    n = Math.round(SAMPLE_RATE / 220),
    ring = new Float32Array(n),
    random = randomStream(97);
  for (let i = 0; i < n; i++)
    ring[i] = (random() * 2 - 1) * Math.sin((Math.PI * i) / n);
  let p = 0;
  return render(length, (t) => {
    const x = ring[p];
    ring[p] = 0.497 * (x + ring[(p + 1) % n]);
    p = (p + 1) % n;
    return (
      x * 1.3 +
      sin(440, t) * Math.exp(-t * 13) * 0.1 +
      sin(660, t) * Math.exp(-t * 19) * 0.045
    );
  });
}

export function makeInstrument(name) {
  if (name === "pluck") return stringSample();
  if (name === "kalimba")
    return render(
      2.2,
      (t) =>
        sin(440, t) * Math.exp(-t * 3.2) * 0.64 +
        sin(440 * 2.76, t) * Math.exp(-t * 12) * 0.21 +
        sin(440 * 5.4, t) * Math.exp(-t * 32) * 0.09,
    );
  if (name === "flute")
    return render(2.6, (t, n, low) => {
      const breath = Math.min(1, t / 0.075) * Math.min(1, (2.6 - t) / 0.24),
        v = 0.0028 * Math.sin(t * TAU * 5.1) * Math.min(1, t * 3);
      const phase = TAU * 440 * t + v * 17;
      return (
        breath *
        (0.46 * Math.sin(phase) +
          0.09 * Math.sin(phase * 2 + 0.15) +
          0.025 * Math.sin(phase * 3) +
          low * 0.14)
      );
    });
  if (name === "bow")
    return render(3, (t, n, low) => {
      const env = Math.min(1, t / 0.24) * Math.min(1, (3 - t) / 0.6);
      let x = 0;
      for (let h = 1; h <= 7; h++)
        x +=
          (sin(220 * h, t + 0.0001 * Math.sin(t * 29)) * 0.32) / (h * h ** 0.3);
      return env * (x + low * 0.035);
    });
  if (name === "bass")
    return render(
      1.8,
      (t) =>
        (sin(110, t) * 0.7 + sin(220, t) * 0.23 + sin(330, t) * 0.075) *
        Math.exp(-t * 2.1),
    );
  if (name === "horn")
    return render(2.5, (t, n, low) => {
      const env = Math.min(1, t / 0.095) * Math.min(1, (2.5 - t) / 0.35);
      const f = 110 * (1 - 0.018 * Math.exp(-t * 18)),
        vib = 0.012 * Math.sin(t * TAU * 4.8);
      let x = 0;
      for (let h = 1; h < 9; h++)
        x += Math.sin(TAU * f * h * t + vib * h) / h ** 1.6;
      return (x * 0.4 + low * 0.07) * env;
    });
  if (name === "bell")
    return render(
      2.7,
      (t) =>
        sin(880, t) * 0.5 * Math.exp(-t * 2.1) +
        sin(1763, t) * 0.22 * Math.exp(-t * 3.8) +
        sin(3527, t) * 0.07 * Math.exp(-t * 8),
    );
  if (name === "drum-low")
    return render(0.8, (t, n, low) => {
      const phase = TAU * (74 * t + 2.5 * (1 - Math.exp(-t * 34)));
      return (
        Math.sin(phase) * 0.75 * Math.exp(-t * 7.5) +
        sin(177, t) * 0.18 * Math.exp(-t * 18) +
        low * 0.48 * Math.exp(-t * 40)
      );
    });
  if (name === "drum-high")
    return render(
      0.42,
      (t, n, low) =>
        sin(184 + 46 * Math.exp(-t * 90), t) * 0.4 * Math.exp(-t * 15) +
        sin(291, t) * 0.16 * Math.exp(-t * 23) +
        (n - low) * 0.15 * Math.exp(-t * 35),
    );
  if (name === "rim")
    return render(
      0.14,
      (t, n) =>
        (sin(630, t) * 0.45 + sin(1017, t) * 0.27 + n * 0.22) *
        Math.exp(-t * 60),
    );
  if (name === "shaker")
    return render(
      0.13,
      (t, n, low) =>
        (n - low) *
        0.3 *
        Math.sin(Math.PI * Math.min(1, t / 0.12)) *
        Math.exp(-t * 22),
    );
  if (name === "coin")
    return render(0.22, (t, n) => {
      // Short inharmonic bronze strike, with two tiny contact rattles.
      const rattle =
        Math.exp(-Math.abs(t - 0.013) * 650) +
        0.45 * Math.exp(-Math.abs(t - 0.038) * 500);
      return (
        sin(2050, t) * 0.4 * Math.exp(-t * 36) +
        sin(3277, t) * 0.2 * Math.exp(-t * 49) +
        sin(4762, t) * 0.09 * Math.exp(-t * 70) +
        n * 0.12 * rattle
      );
    });
  if (name === "clink")
    return render(
      0.16,
      (t, n) =>
        (sin(1270, t) * 0.39 + sin(2147, t) * 0.21 + sin(3581, t) * 0.07) *
          Math.exp(-t * 38) +
        n * 0.11 * Math.exp(-t * 150),
    );
  if (name === "wood")
    return render(
      0.22,
      (t, n, low) =>
        (sin(286, t) * 0.4 + sin(471, t) * 0.2) * Math.exp(-t * 31) +
        low * 0.4 * Math.exp(-t * 65),
    );
  if (name === "stone")
    return render(
      0.26,
      (t, n, low) =>
        (sin(179, t) * 0.42 + sin(391, t) * 0.18 + low * 0.8) *
        Math.exp(-t * 24),
    );
  if (name === "leather")
    return render(
      0.13,
      (t, n, low) =>
        low * 1.8 * Math.exp(-t * 48) + sin(135, t) * 0.22 * Math.exp(-t * 37),
    );
  if (name === "swish")
    return render(
      0.26,
      (t, n, low) => (n - low) * 0.2 * Math.sin((Math.PI * t) / 0.26) ** 2,
    );
  if (name === "bow-shot")
    return render(0.35, (t, n, low) => {
      const twang = Math.sin(TAU * (146 * t + 4 * (1 - Math.exp(-t * 35))));
      return (
        twang * 0.3 * Math.exp(-t * 25) +
        sin(582, t) * 0.15 * Math.exp(-t * 32) +
        (n - low) * 0.16 * Math.exp(-t * 50)
      );
    });
  if (name === "ice-shot")
    return render(
      0.38,
      (t, n, low) =>
        (sin(1700, t) * 0.23 + sin(2705, t) * 0.16 + sin(4329, t) * 0.07) *
          Math.exp(-t * 13) +
        (n - low) * 0.13 * Math.sin((Math.PI * t) / 0.38) * Math.exp(-t * 6),
    );
  if (name === "hit")
    return render(
      0.18,
      (t, n, low) =>
        sin(98, t) * 0.5 * Math.exp(-t * 38) +
        low * 1.2 * Math.exp(-t * 48) +
        n * 0.075 * Math.exp(-t * 130),
    );
  if (name === "metal")
    return render(
      0.35,
      (t, n) =>
        (sin(771, t) * 0.38 + sin(1153, t) * 0.24 + sin(2128, t) * 0.11) *
          Math.exp(-t * 18) +
        n * 0.08 * Math.exp(-t * 90),
    );
  if (name === "blast")
    return render(1.1, (t, n, low) => {
      const e = Math.exp(-t * 7.5);
      return (
        Math.sin(TAU * (48 * t + 2 * (1 - Math.exp(-t * 35)))) * 0.52 * e +
        low * 1.7 * e +
        n * 0.16 * Math.exp(-t * 23)
      );
    });
  if (name === "crack")
    return render(
      0.55,
      (t, n, low) =>
        (n - low) * 0.29 * Math.exp(-t * 15) +
        (sin(2133, t) + sin(3854, t) * 0.4) * 0.13 * Math.exp(-t * 9),
    );
  if (name === "growl")
    return render(0.65, (t, n, low) => {
      const rough = sin(91, t) * sin(39, t) + sin(182, t) * 0.3;
      return (
        (rough * 0.45 + low * 0.85) *
        Math.sin((Math.PI * t) / 0.65) ** 2 *
        (1 + 0.2 * sin(27, t))
      );
    });
  if (name === "whoosh")
    return render(
      1.15,
      (t, n, low) =>
        (low * 1.3 + n * 0.1) * Math.sin((Math.PI * t) / 1.15) ** 2,
    );
  if (name === "spark")
    return render(0.75, (t, n, low) => {
      const f = 1300 + 2200 * t;
      return (
        (sin(f, t) * 0.11 + sin(f * 1.503, t) * 0.075 + (n - low) * 0.09) *
        Math.sin((Math.PI * t) / 0.75) ** 2
      );
    });
  if (name === "riser")
    return render(1.1, (t, n, low) => {
      const u = t / 1.1,
        pulse = 0.55 + 0.45 * Math.sin(TAU * (5 * t + 9 * t * t));
      const phase = TAU * (280 * t + 310 * t * t);
      return (
        (Math.sin(phase) * 0.12 +
          Math.sin(phase * 1.5) * 0.06 +
          (n - low) * 0.12) *
        u ** 1.35 *
        pulse
      );
    });
  if (name === "wind")
    return render(
      5,
      (t, n, low) => low * (0.42 + 0.13 * sin(0.73, t) + 0.08 * sin(1.17, t)),
    );
  if (name === "water")
    return render(
      5,
      (t, n, low) =>
        (low * 0.6 + n * 0.035) * (0.45 + 0.1 * sin(0.8, t)) +
        sin(850 + 300 * sin(2.3, t), t) * 0.002,
    );
  if (name === "fire")
    return render(
      5,
      (t, n, low, i, random) => low * 0.25 + (random() > 0.998 ? n * 0.26 : 0),
    );
  throw new Error("Unknown Firstfire instrument: " + name);
}

export const INSTRUMENTS = [
  "pluck",
  "kalimba",
  "flute",
  "bow",
  "bass",
  "horn",
  "bell",
  "drum-low",
  "drum-high",
  "rim",
  "shaker",
  "coin",
  "clink",
  "wood",
  "stone",
  "leather",
  "swish",
  "bow-shot",
  "ice-shot",
  "hit",
  "metal",
  "blast",
  "crack",
  "growl",
  "whoosh",
  "spark",
  "riser",
  "wind",
  "water",
  "fire",
];
export const SAMPLE_PITCH = {
  pluck: 220,
  kalimba: 440,
  flute: 440,
  bow: 220,
  bass: 110,
  horn: 110,
  bell: 880,
};

export function roomImpulse(rate = SAMPLE_RATE) {
  const random = randomStream(87),
    length = Math.floor(rate * 1.45),
    channels = [new Float32Array(length), new Float32Array(length)];
  for (let c = 0; c < 2; c++) {
    let low = 0;
    for (let i = 0; i < length; i++) {
      const t = i / rate;
      low += 0.22 * (random() * 2 - 1 - low);
      channels[c][i] = t > 0.025 ? low * 0.25 * Math.exp(-t * 6.5) : 0;
    }
    for (const [time, amount] of [
      [0.037, 0.28],
      [0.063, 0.19],
      [0.091, 0.11],
      [0.127, 0.07],
    ])
      channels[c][Math.floor((time + c * 0.003) * rate)] += amount;
  }
  return channels;
}
