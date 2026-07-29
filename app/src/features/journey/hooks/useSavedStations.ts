import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listSavedStationIds, toggleSavedStation } from '../../../data/db';
import { syncNow } from '../../../services/syncEngine';

/**
 * Favourited station ids, persisted to Dexie (§5.7).
 *
 * The hand-rolled `metrothi-saved-stations-change` event this hook used to
 * broadcast is gone: `storage` only fires in *other* tabs, so keeping every
 * mounted Favorite button in this tab in sync needed a same-tab event too.
 * `useLiveQuery` observes the table itself and covers both cases at once — and
 * removes the failure mode where a write that forgot to dispatch the event left
 * a stale button behind.
 *
 * `savedIds` is `[]` for the first frame while IndexedDB is read, so callers keep
 * a plain `string[]`. A favourite button that renders unfilled for one frame is
 * exactly what this hook already did when it read inside a `useEffect`.
 */
export function useSavedStations() {
  const savedIds = useLiveQuery(listSavedStationIds, [], [] as string[]);

  const toggle = useCallback((id: string) => {
    // Fire-and-forget: the write is local and `useLiveQuery` re-renders off it,
    // so there's nothing to await before the UI is right. Sync follows when it
    // can, and no-ops when it can't.
    void toggleSavedStation(id).then(() => syncNow());
  }, []);

  return { savedIds, isSaved: (id: string) => savedIds.includes(id), toggle };
}
