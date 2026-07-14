// Getting the share text out of the app. Two routes, and the browser
// decides which: the native sheet where there is one (a phone, and it is
// what a phone user expects), the clipboard where there is not.
//
// FEATURE DETECT, NEVER SNIFF THE USER AGENT. A phone without a share sheet
// must still copy, and a desktop with one must still use it. The capability
// is the question; the device never is.

export type ShareOutcome = 'shared' | 'copied' | 'cancelled';

/**
 * Hand the share text to the platform. Returns what actually happened, so
 * the caller can say "Copied." only when something was in fact copied.
 *
 * A cancelled sheet is not a failure and must not fall through to the
 * clipboard: the player closed it on purpose, and silently copying behind
 * their back is the app doing something they just declined. Any OTHER share
 * error is a broken route, and the clipboard is a real fallback for that.
 */
export async function deliverShare(text: string): Promise<ShareOutcome> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return 'cancelled';
    }
  }
  await navigator.clipboard?.writeText(text);
  return 'copied';
}
