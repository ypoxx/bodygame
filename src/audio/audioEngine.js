export function createAudioEngine() {
  let context = null;
  let enabled = true;

  const channelVolumes = {
    master: 1,
    ui: 0.7,
    sfx: 0.8,
    ambience: 0.35,
  };

  let masterGain = null;

  function ensureContext() {
    if (!context) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        return null;
      }
      context = new Ctx();
      masterGain = context.createGain();
      masterGain.gain.value = channelVolumes.master;
      masterGain.connect(context.destination);
    }

    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }

    return context;
  }

  function channelGainValue(channelName, baseVolume) {
    const channelVolume = channelVolumes[channelName] ?? 1;
    return baseVolume * channelVolume * channelVolumes.master;
  }

  function beep({
    channel = "sfx",
    freq = 440,
    duration = 0.12,
    volume = 0.045,
    type = "sine",
    slideTo = null,
    when = 0,
  }) {
    if (!enabled) {
      return;
    }

    const ctx = ensureContext();
    if (!ctx || !masterGain) {
      return;
    }

    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    }

    const scaledVolume = Math.max(0.0001, channelGainValue(channel, volume));
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(scaledVolume, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  function setEnabled(value) {
    enabled = Boolean(value);
  }

  function setVolume(value) {
    channelVolumes.master = Math.min(1, Math.max(0, Number(value) || 0));
    if (masterGain) {
      masterGain.gain.value = channelVolumes.master;
    }
  }

  function setChannelVolume(channelName, value) {
    if (!Object.hasOwn(channelVolumes, channelName)) {
      return;
    }
    channelVolumes[channelName] = Math.min(1, Math.max(0, Number(value) || 0));
  }

  return {
    setEnabled,
    setVolume,
    setChannelVolume,
    unlock() {
      ensureContext();
    },
    countdown(step) {
      beep({ channel: "ui", freq: 460 + step * 55, duration: 0.14, volume: 0.045, type: "square" });
    },
    go() {
      beep({ channel: "ui", freq: 620, duration: 0.12, volume: 0.05, type: "triangle" });
      beep({ channel: "ui", freq: 780, duration: 0.14, volume: 0.06, type: "triangle", when: 0.08 });
    },
    roundStart() {
      beep({ channel: "ui", freq: 440, duration: 0.1, volume: 0.038, type: "sine" });
      beep({ channel: "ui", freq: 660, duration: 0.14, volume: 0.044, type: "sine", when: 0.08 });
    },
    correct(combo) {
      const boost = Math.min(200, combo * 10);
      beep({ channel: "sfx", freq: 620 + boost, duration: 0.09, volume: 0.045, type: "triangle" });
      beep({ channel: "sfx", freq: 820 + boost, duration: 0.12, volume: 0.052, type: "triangle", when: 0.06 });
    },
    wrong() {
      beep({ channel: "sfx", freq: 240, duration: 0.11, volume: 0.05, type: "sawtooth", slideTo: 160 });
      beep({ channel: "sfx", freq: 180, duration: 0.09, volume: 0.04, type: "square", when: 0.08 });
    },
    tick(second) {
      const freq = second <= 5 ? 980 : 780;
      beep({ channel: "ui", freq, duration: 0.06, volume: 0.028, type: "triangle" });
    },
    comboTier(level) {
      const base = level >= 3 ? 880 : level === 2 ? 760 : 680;
      beep({ channel: "sfx", freq: base, duration: 0.08, volume: 0.045, type: "triangle" });
      beep({ channel: "sfx", freq: base * 1.25, duration: 0.11, volume: 0.05, type: "triangle", when: 0.06 });
    },
    bossStart() {
      beep({ channel: "ui", freq: 360, duration: 0.11, volume: 0.055, type: "sawtooth" });
      beep({ channel: "ui", freq: 540, duration: 0.11, volume: 0.055, type: "sawtooth", when: 0.08 });
      beep({ channel: "ui", freq: 760, duration: 0.13, volume: 0.065, type: "triangle", when: 0.16 });
    },
    hurryPulse(level = 1) {
      const freq = level >= 2 ? 1120 : 980;
      beep({ channel: "ui", freq, duration: 0.07, volume: 0.04, type: "triangle" });
      beep({ channel: "ui", freq: freq * 0.78, duration: 0.06, volume: 0.033, type: "triangle", when: 0.05 });
    },
    roundEnd(reason, rank) {
      if (reason === "fail") {
        beep({ channel: "ui", freq: 240, duration: 0.14, volume: 0.05, type: "sawtooth", slideTo: 150 });
        beep({ channel: "ui", freq: 180, duration: 0.18, volume: 0.05, type: "sawtooth", when: 0.1, slideTo: 120 });
        return;
      }

      const high = rank === "S" ? 980 : rank === "A" ? 920 : 820;
      beep({ channel: "ui", freq: 620, duration: 0.09, volume: 0.04, type: "triangle" });
      beep({ channel: "ui", freq: high, duration: 0.16, volume: 0.06, type: "triangle", when: 0.08 });
      beep({ channel: "ui", freq: high * 1.12, duration: 0.2, volume: 0.05, type: "sine", when: 0.18 });
    },
  };
}
