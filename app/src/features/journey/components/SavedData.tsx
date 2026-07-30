import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { BookMarked, Train, Clock, X } from 'lucide-react';
import { ExpandableRow, RowDivider, SectionCard, SectionHeader } from './settingsRows';
import { LineBadge } from '../../../components/LineBadge';
import { STATION_BY_ID, type StationRecord } from '../engine/journeyEngine';
import { useSavedStations } from '../hooks/useSavedStations';
import {
  listSavedJourneys,
  listRecentTrips,
  toggleSavedJourney,
  removeRecentTrip,
  RECENT_TRIP_LIMIT,
  type SavedJourney,
  type RecentTrip,
} from '../../../data/db';
import { syncNow } from '../../../services/syncEngine';

/**
 * The YOU screen's Saved and Journey History sections (PRD §4.5, §8.1 phase D).
 *
 * These three rows carried a "Phase 4" badge long after the data behind them
 * shipped: saved stations, saved journeys and recent trips have been live,
 * queryable and syncing since the Dexie work (§5.7), and were already rendered
 * on the search overlay and in the planner. YOU was the last place in the app
 * claiming they didn't exist.
 *
 * Every list here is the *only* full view of its table. The search overlay shows
 * saved journeys and recents as shortcuts to act on, mixed into a screen about
 * going somewhere; this is the screen about what's stored, so each row expands
 * to the whole list and each entry can be removed. Removal is the reason the
 * expansion earns its place — a favourite could always be undone from the
 * station page, but a rider who wants to see everything they've saved had
 * nowhere to look.
 *
 * Reads are `useLiveQuery`, so unfavouriting a station on its own page updates
 * the count here without a remount, and a pull from another device lands the
 * same way. Writes are fire-and-forget for the same reason as everywhere else:
 * the write is local, the row re-renders off the tombstone, and sync follows
 * when it can (§5.7).
 */

/**
 * One entry inside an expanded list.
 *
 * Tinted against the card so the list reads as belonging to the row above it,
 * and indented past the row's icon well so the two don't line up as siblings.
 */
function EntryRow({
  line,
  title,
  meta,
  onOpen,
  onRemove,
  removeLabel,
}: {
  line?: string;
  title: string;
  meta?: string;
  onOpen?: () => void;
  onRemove: () => void;
  removeLabel: string;
}) {
  const Body = onOpen ? 'button' : 'div';

  return (
    <div className="flex items-center gap-2 pl-5 pr-3 py-2.5" style={{ background: 'var(--c-card-alt)' }}>
      <Body
        {...(onOpen ? { type: 'button' as const, onClick: onOpen } : {})}
        className={`flex-1 min-w-0 flex items-center gap-3 text-left rounded-lg ${onOpen ? 'active:opacity-60 transition-opacity' : ''}`}
      >
        {line ? <LineBadge line={line} size="xs" /> : <span className="w-5 shrink-0" />}
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold truncate" style={{ color: 'var(--c-text)' }}>
            {title}
          </span>
          {meta && (
            <span className="block text-[11px] font-medium truncate" style={{ color: 'var(--c-text-3)' }}>
              {meta}
            </span>
          )}
        </span>
      </Body>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-transform"
        style={{ background: 'var(--c-card)' }}
      >
        <X size={14} style={{ color: 'var(--c-text-3)' }} />
      </button>
    </div>
  );
}

/** Plural-aware count: "1 station" / "4 stations". */
function plural(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

// ─── Saved ───────────────────────────────────────────────────────────────────

export function SavedSection() {
  const navigate = useNavigate();
  // The favourites hook, not a second copy of it: it already owns both the live
  // read and the write-then-sync, and this was the only site in the app writing
  // a favourite without it.
  const { savedIds, toggle } = useSavedStations();
  const savedJourneys = useLiveQuery(listSavedJourneys, [], [] as SavedJourney[]);

  // Sorted by name, not by the primary-key order Dexie hands back: this is a
  // list to read down, and station ids are slugs that don't match their labels.
  const stations = savedIds
    .map(id => STATION_BY_ID[id])
    // A saved id with no station behind it is a slug the data no longer has.
    // Dropping it here is presentation only — the row stays in Dexie, so a
    // rename that lands in a later build brings it back rather than losing it.
    .filter((s): s is StationRecord => s != null)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <SectionHeader label="Saved" />
      <SectionCard>
        <ExpandableRow
          icon={BookMarked}
          label="Saved places"
          expandable={stations.length > 0}
          value={
            stations.length === 0
              ? 'Tap the star on any station to save it'
              : plural(stations.length, 'station', 'stations')
          }
        >
          {stations.map(s => (
            <EntryRow
              key={s.id}
              line={s.line}
              title={s.name}
              meta={s.secondLine ? 'Interchange' : undefined}
              onOpen={() => navigate(`/stations/${s.id}`)}
              onRemove={() => toggle(s.id)}
              removeLabel={`Remove ${s.name} from saved places`}
            />
          ))}
        </ExpandableRow>
        <RowDivider />
        <ExpandableRow
          icon={Train}
          label="Saved journeys"
          expandable={savedJourneys.length > 0}
          value={
            savedJourneys.length === 0
              ? 'Save a route while planning to keep it here'
              : plural(savedJourneys.length, 'route', 'routes')
          }
        >
          {savedJourneys.map(j => {
            const dest = j.destId ? STATION_BY_ID[j.destId] : undefined;
            const title = j.destName || dest?.name || j.destId || 'Journey';
            return (
              <EntryRow
                key={j.key}
                line={dest?.line}
                title={title}
                meta={`from ${j.sourceName || j.sourceId || 'somewhere'}`}
                // Opens the destination, the same landing the search overlay
                // gives a saved journey. Planning re-runs from the home sheet,
                // which isn't mounted on this route.
                onOpen={dest ? () => navigate(`/stations/${dest.id}`) : undefined}
                onRemove={() => void toggleSavedJourney({
                  key: j.key,
                  sourceId: j.sourceId,
                  destId: j.destId,
                  sourceName: j.sourceName,
                  destName: j.destName,
                }).then(() => syncNow())}
                removeLabel={`Remove the saved journey to ${title}`}
              />
            );
          })}
        </ExpandableRow>
      </SectionCard>
    </>
  );
}

// ─── Journey history ─────────────────────────────────────────────────────────

export function HistorySection() {
  const navigate = useNavigate();
  const trips = useLiveQuery(listRecentTrips, [], [] as RecentTrip[]);

  return (
    <>
      <SectionHeader label="Journey History" />
      <SectionCard>
        <ExpandableRow
          icon={Clock}
          label="Past trips"
          expandable={trips.length > 0}
          value={
            trips.length === 0
              ? 'Trips you plan are kept here'
              : `${plural(trips.length, 'trip', 'trips')} · last ${RECENT_TRIP_LIMIT} kept`
          }
        >
          {trips.map(t => {
            // A trip end is a station or a resolved landmark (§4.2), and only
            // the former has a page to open.
            const dest = typeof t.dest?.id === 'string' ? STATION_BY_ID[t.dest.id] : undefined;
            const title = t.dest?.name ?? 'Trip';
            return (
              <EntryRow
                key={t.key}
                line={dest?.line}
                title={title}
                meta={t.source?.name ? `from ${t.source.name}` : undefined}
                onOpen={dest ? () => navigate(`/stations/${dest.id}`) : undefined}
                onRemove={() => void removeRecentTrip(t.key).then(() => syncNow())}
                removeLabel={`Remove the trip to ${title} from history`}
              />
            );
          })}
        </ExpandableRow>
      </SectionCard>
    </>
  );
}
