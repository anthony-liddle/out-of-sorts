import { useEffect } from 'react';

export interface KeyboardActions {
  letter(key: string): void;
  spend(): void;
  backspace(): void;
  clear(): void;
}

/**
 * Global keydown capture, so you open the game and type. No click to focus,
 * ever, because the word display is not a text field: on a phone that field
 * would raise the OS keyboard over the very tiles that exist so no OS
 * keyboard is needed.
 *
 * It yields to anything else focusable. Nothing else is focusable today, but
 * a future modal or settings field must not have its typing silently eaten.
 */
function typingElsewhere(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function useKeyboard(actions: KeyboardActions, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (typingElsewhere(event.target)) return;

      if (/^[a-zA-Z]$/.test(event.key)) {
        event.preventDefault();
        actions.letter(event.key.toLowerCase());
        return;
      }
      switch (event.key) {
        case 'Enter':
          event.preventDefault();
          actions.spend();
          break;
        case 'Backspace':
          event.preventDefault();
          actions.backspace();
          break;
        case 'Escape':
          event.preventDefault();
          actions.clear();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actions, enabled]);
}
