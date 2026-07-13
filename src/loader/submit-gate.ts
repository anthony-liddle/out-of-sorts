// The player's input surface stays live while the dictionary builds. A
// submit made before the index is ready is queued and resolved the moment
// it lands, in order. A valid word is never rejected because the dictionary
// was still loading, and nothing here knows how to render a spinner.
import type { Dictionaries } from '../engine/dictionary';

export interface SubmitGate<T> {
  submit(word: string): Promise<T>;
}

export function createSubmitGate<T>(
  ready: Promise<Dictionaries>,
  judge: (dicts: Dictionaries, word: string) => T,
): SubmitGate<T> {
  return {
    submit(word: string): Promise<T> {
      return ready.then((dicts) => judge(dicts, word));
    },
  };
}
