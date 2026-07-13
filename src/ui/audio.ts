// Prototype synth behind a clean interface so real Soundscape drops in
// later. The hierarchy matters more than the sounds: the drop fires more
// than anything else and must stay quiet and soft; All Eights is the peak
// and gets the biggest sound in the game.
export type SoundEvent = 'drop' | 'hold' | 'eight' | 'all-eights' | 'end';

export interface GameAudio {
  play(event: SoundEvent): void;
  setMuted(muted: boolean): void;
  readonly muted: boolean;
}

export const silentAudio: GameAudio = {
  play() {},
  setMuted() {},
  muted: true,
};

interface Note {
  freq: number;
  at: number;
  dur: number;
  gain: number;
}

const VOICES: Record<SoundEvent, Note[]> = {
  drop: [{ freq: 220, at: 0, dur: 0.18, gain: 0.05 }],
  hold: [
    { freq: 523, at: 0, dur: 0.12, gain: 0.06 },
    { freq: 659, at: 0.08, dur: 0.14, gain: 0.06 },
  ],
  eight: [
    { freq: 523, at: 0, dur: 0.12, gain: 0.07 },
    { freq: 659, at: 0.09, dur: 0.12, gain: 0.07 },
    { freq: 784, at: 0.18, dur: 0.2, gain: 0.07 },
  ],
  'all-eights': [
    { freq: 523, at: 0, dur: 0.14, gain: 0.09 },
    { freq: 659, at: 0.1, dur: 0.14, gain: 0.09 },
    { freq: 784, at: 0.2, dur: 0.14, gain: 0.09 },
    { freq: 1047, at: 0.3, dur: 0.4, gain: 0.1 },
    { freq: 1319, at: 0.42, dur: 0.5, gain: 0.08 },
  ],
  end: [
    { freq: 392, at: 0, dur: 0.3, gain: 0.06 },
    { freq: 330, at: 0.22, dur: 0.35, gain: 0.06 },
    { freq: 262, at: 0.44, dur: 0.5, gain: 0.06 },
  ],
};

export function createSynthAudio(initiallyMuted: boolean): GameAudio {
  let ctx: AudioContext | null = null;
  let muted = initiallyMuted;
  return {
    get muted() {
      return muted;
    },
    setMuted(m: boolean) {
      muted = m;
    },
    play(event: SoundEvent) {
      if (muted || typeof AudioContext === 'undefined') return;
      ctx ??= new AudioContext();
      const t0 = ctx.currentTime;
      for (const note of VOICES[event]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = note.freq;
        gain.gain.setValueAtTime(0, t0 + note.at);
        gain.gain.linearRampToValueAtTime(note.gain, t0 + note.at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.at + note.dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0 + note.at);
        osc.stop(t0 + note.at + note.dur + 0.05);
      }
    },
  };
}
