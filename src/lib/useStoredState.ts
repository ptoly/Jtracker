import { useEffect, useState } from 'react';

/**
 * useState that's remembered in localStorage, for small UI preferences
 * (e.g. whether a section is collapsed). Falls back to `initial` when
 * storage is unavailable or holds something else.
 */
export function useStoredBoolean(key: string, initial: boolean) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? initial : stored === 'true';
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // Private mode or storage full: the preference just isn't remembered.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
