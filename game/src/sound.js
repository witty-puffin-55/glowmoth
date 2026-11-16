// All of GLOWMOTH's sound, synthesised with WebAudio: no audio files, nothing to load. The
// context is created lazily on the first call, which the game makes from a click or a keypress,
// so the browser's autoplay rules are already satisfied. Every voice is a short oscillator
// envelope; the gather chime climbs as the combo grows, so a long streak sounds like one.

export function createSound() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context !== null) return true;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return false;
    context = new AudioCtor();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.42;
    master.connect(context.destination);
    return true;
  }

  function tone({ frequency, end = null, type = 'sine', duration = 0.18, volume = 0.5, delay = 0 }) {
    if (!ensure()) return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (end !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  function thud() {
    if (!ensure()) return;
    const start = context.currentTime;
    const length = Math.floor(context.sampleRate * 0.22);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** 2;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = context.createGain();
    gain.gain.value = 0.8;
    source.connect(filter).connect(gain).connect(master);
    source.start(start);
    tone({ frequency: 150, end: 48, type: 'sawtooth', duration: 0.24, volume: 0.35 });
  }

  return {
    /** A two-note chime that rises with the combo count. */
    collect(combo) {
      const step = Math.min(combo, 24);
      const base = 620 * 2 ** (step / 24);
      tone({ frequency: base, type: 'sine', duration: 0.12, volume: 0.4 });
      tone({ frequency: base * 1.5, type: 'sine', duration: 0.16, volume: 0.3, delay: 0.05 });
    },
    hit() {
      thud();
    },
    nightClear() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((frequency, index) => {
        tone({ frequency, type: 'triangle', duration: 0.22, volume: 0.4, delay: index * 0.09 });
      });
    },
    win() {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
      notes.forEach((frequency, index) => {
        tone({ frequency, type: 'triangle', duration: 0.3, volume: 0.38, delay: index * 0.11 });
      });
      tone({ frequency: 261.63, type: 'sine', duration: 1.1, volume: 0.22, delay: 0.1 });
    },
    over() {
      const notes = [392, 329.63, 261.63, 196];
      notes.forEach((frequency, index) => {
        tone({ frequency, type: 'triangle', duration: 0.34, volume: 0.36, delay: index * 0.16 });
      });
    },
    start() {
      tone({ frequency: 523.25, type: 'triangle', duration: 0.14, volume: 0.35 });
      tone({ frequency: 783.99, type: 'triangle', duration: 0.2, volume: 0.35, delay: 0.08 });
    },
    toggleMute() {
      muted = !muted;
      if (master !== null) master.gain.value = muted ? 0 : 0.42;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
