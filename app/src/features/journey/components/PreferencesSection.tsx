import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Footprints, MapPin, Check } from 'lucide-react';
import { ExpandableRow, Row, RowDivider, SectionCard, SectionHeader } from './settingsRows';
import { LineBadge } from '../../../components/LineBadge';
import { STATIONS } from '../engine/journeyEngine';
import { LINE_NAMES } from '../constants';
import { useWalkSpeed, useDefaultDeparture } from '../hooks/usePreferences';
import { WALK_SPEED_PRESETS, walkSpeedPreset, DEPARTURE_USE_GPS } from '../../../data/preferences';

/**
 * The YOU screen's Preferences section (PRD §4.5, §8.1 phase E).
 *
 * Two settings that were "Phase 4" stubs printing their own default as if it
 * were a stored value. Both live in the `prefs` table, so both sync with
 * everything else the rider has (§5.7) — which is the argument for putting them
 * here rather than inventing a second settings store: `prefs` already held
 * theme, already synced, and already had a home in the schema.
 *
 * Neither is a text field. A walking pace is three choices, and a departure
 * station is one of 53 — both are pick-from-a-list, and a list is the control
 * that can't be typed wrong.
 */

// ─── Walking speed ───────────────────────────────────────────────────────────

function WalkSpeedRow() {
  const { t } = useTranslation();
  const { walkSpeedKmh, setWalkSpeed } = useWalkSpeed();
  const preset = walkSpeedPreset(walkSpeedKmh);

  return (
    <ExpandableRow
      icon={Footprints}
      label={t('you.walkingSpeed')}
      // Two whole sentences rather than one with the named half appended: a
      // speed with no preset behind it is reachable (a pref synced down from a
      // build offering a fourth pace), and it needs its own wording, not a gap.
      value={
        preset
          ? t('you.walkSpeedValue', { label: t(preset.labelKey), kmh: preset.kmh })
          : t('you.walkSpeedValueRaw', { kmh: walkSpeedKmh })
      }
    >
      {close => (
        <div role="radiogroup" aria-label={t('you.walkingSpeed')}>
          {WALK_SPEED_PRESETS.map(preset => {
            const selected = preset.kmh === walkSpeedKmh;
            return (
              <button
                key={preset.kmh}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => { setWalkSpeed(preset.kmh); close(); }}
                className="w-full flex items-center gap-3 pl-5 pr-4 py-3 text-left transition-colors"
                style={{ background: 'var(--c-card-alt)' }}
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold" style={{ color: 'var(--c-text)' }}>
                    {t(preset.labelKey)}
                  </span>
                  <span className="block text-[11px] font-medium" style={{ color: 'var(--c-text-3)' }}>
                    {t(preset.detailKey)}
                  </span>
                </span>
                {selected && <Check size={16} className="shrink-0" style={{ color: 'var(--c-accent)' }} />}
              </button>
            );
          })}
        </div>
      )}
    </ExpandableRow>
  );
}

// ─── Default departure station ───────────────────────────────────────────────

/**
 * A native `<select>`, deliberately.
 *
 * 53 stations is too many for the expand-to-a-list pattern above and too few to
 * justify a second search surface — and the platform's own picker is the one
 * control that already scrolls, filters by keypress and reads correctly to a
 * screen reader on every device this ships to. Grouped by line because that's
 * how the network is signed, and how a rider knows which of two similar names
 * is theirs.
 */
function DefaultDepartureRow() {
  const { t } = useTranslation();
  const { defaultDepartureId, defaultDeparture: selected, setDefaultDeparture } = useDefaultDeparture();

  const byLine = useMemo(() => {
    const groups = new Map<string, typeof STATIONS>();
    for (const s of STATIONS) {
      if (s.operational === false) continue;
      const group = groups.get(s.line) ?? [];
      group.push(s);
      groups.set(s.line, group);
    }
    // Ordered along each line, which is how the in-carriage map reads.
    for (const group of groups.values()) group.sort((a, b) => a.order - b.order);
    return groups;
  }, []);

  return (
    <Row
      icon={MapPin}
      label={t('you.defaultDeparture')}
      value={
        selected
          ? t('you.defaultDepartureSet', { station: selected.name })
          : t('you.defaultDepartureUnset')
      }
    >
      <div className="flex items-center gap-2 shrink-0">
        {selected && <LineBadge line={selected.line} size="xs" />}
        <select
          aria-label={t('you.defaultDeparture')}
          value={defaultDepartureId ?? DEPARTURE_USE_GPS}
          onChange={e => setDefaultDeparture(e.target.value || null)}
          className="rounded-lg px-2 py-1.5 text-[12px] font-semibold outline-none focus-visible:border-[var(--c-accent)] max-w-[7.5rem]"
          style={{
            background: 'var(--c-card-alt)',
            border: '1px solid var(--c-border-2)',
            color: 'var(--c-text)',
          }}
        >
          <option value={DEPARTURE_USE_GPS}>{t('you.useMyLocation')}</option>
          {[...byLine.entries()].map(([line, stations]) => (
            <optgroup key={line} label={LINE_NAMES[line] ?? line}>
              {stations.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </Row>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

export function PreferencesSection() {
  const { t } = useTranslation();
  return (
    <>
      <SectionHeader label={t('you.preferences')} />
      <SectionCard>
        <WalkSpeedRow />
        <RowDivider />
        <DefaultDepartureRow />
      </SectionCard>
    </>
  );
}
