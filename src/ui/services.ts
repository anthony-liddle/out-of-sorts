// Everything the game touches in the outside world, injectable so tests
// drive the whole UI with fakes and the real wiring lives in main.tsx.
import type { Calendar } from '../calendar/types';
import type { Dictionaries } from '../engine/dictionary';
import type { KeyValueStorage } from '../game/persistence';
import { startDictionaryLoad } from '../loader/browser';
import { createSynthAudio, type GameAudio } from './audio';

export interface GameServices {
  loadCalendar(): Promise<Calendar>;
  loadDictionaries(): { dictionaries: Promise<Dictionaries> };
  storage: KeyValueStorage;
  audio: GameAudio;
  now(): Date;
  reducedMotionDefault: boolean;
}

export function browserServices(): GameServices {
  let calendar: Promise<Calendar> | null = null;
  return {
    loadCalendar() {
      calendar ??= fetch('/data/calendar.json').then((r) => {
        if (!r.ok) throw new Error(`calendar: ${r.status}`);
        return r.json();
      });
      return calendar;
    },
    loadDictionaries: () => startDictionaryLoad(),
    storage: window.localStorage,
    audio: createSynthAudio(false),
    now: () => new Date(),
    reducedMotionDefault:
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
}
