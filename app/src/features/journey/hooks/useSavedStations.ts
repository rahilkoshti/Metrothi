import { useCallback, useEffect, useState } from 'react';

const KEY = 'metrothi-saved-stations';
// `storage` only fires in *other* tabs, so a toggle broadcasts its own event to
// keep every mounted copy of the Favorite button in this tab in sync.
const SYNC_EVENT = 'metrothi-saved-stations-change';

function read(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((id: unknown): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** Favourited station ids, persisted to localStorage. */
export function useSavedStations() {
  const [savedIds, setSavedIds] = useState<string[]>(read);

  useEffect(() => {
    const sync = () => setSavedIds(read());
    window.addEventListener(SYNC_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SYNC_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const next = read();
    const i = next.indexOf(id);
    if (i === -1) next.push(id);
    else next.splice(i, 1);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Private mode / quota — the in-memory state below still updates.
    }
    window.dispatchEvent(new Event(SYNC_EVENT));
  }, []);

  return { savedIds, isSaved: (id: string) => savedIds.includes(id), toggle };
}
