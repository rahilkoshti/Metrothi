import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getPref, setPref } from '../data/db';
import { syncNow } from '../services/syncEngine';

/** What the rider chose. `system` defers to the OS. */
export type ThemePref = 'system' | 'dark' | 'light';
/** What actually gets painted. */
export type Theme = 'dark' | 'light';

interface ThemeContextType {
  /** The resolved theme — what is on screen right now. */
  theme: Theme;
  /** The rider's preference, which may be `system`. */
  pref: ThemePref;
  setPref: (pref: ThemePref) => void;
  /** Kept for the callers that just want the other one of the two. */
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  pref: 'system',
  setPref: () => {},
  toggleTheme: () => {},
});

/**
 * Synchronous first-paint mirror of the theme preference.
 *
 * Theme is the one user value needed *before* React renders anything, and
 * IndexedDB can only be read asynchronously — so reading it from Dexie alone
 * means a frame of the wrong theme on every cold start, which is a visible white
 * flash for a dark-mode rider.
 *
 * So Dexie stays the source of truth and the thing that syncs, and this key is a
 * cache that's allowed to be one frame stale. **Don't "simplify" this into a
 * single source** (§5.2), and don't copy the pattern for anything that isn't
 * read at first paint — everything else should read Dexie directly.
 *
 * It holds the *preference*, not the resolved theme, because `system` cannot be
 * reconstructed from a resolved value: the inline script in `index.html` has to
 * know whether to consult `prefers-color-scheme` or to honour an explicit
 * choice, and it has to know it before it can paint.
 */
const PAINT_HINT_KEY = 'metrothi-theme';

const MEDIA = '(prefers-color-scheme: dark)';

function systemTheme(): Theme {
  try {
    return window.matchMedia(MEDIA).matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function readPaintHint(): ThemePref {
  try {
    const v = localStorage.getItem(PAINT_HINT_KEY);
    return v === 'dark' || v === 'light' ? v : 'system';
  } catch {
    return 'system';
  }
}

function writePaintHint(pref: ThemePref) {
  try {
    localStorage.setItem(PAINT_HINT_KEY, pref);
  } catch { /* private mode — Dexie still has it */ }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(readPaintHint);
  const [system, setSystem] = useState<Theme>(systemTheme);
  const theme: Theme = pref === 'system' ? system : pref;

  /** Resolved once the Dexie read has come back, whatever it found. */
  const hydrated = useRef(false);
  /**
   * The value Dexie is known to already hold.
   *
   * Guards against writing back what we just read: loading `dark` over a `light`
   * paint hint changes the preference, which re-runs the persist effect, which
   * would store `dark` again with a fresh `updatedAt` — and under last-write-wins
   * that bogus timestamp beats a genuinely newer preference set on another
   * device. A cold start must not be able to win a conflict.
   */
  const persisted = useRef<ThemePref | null>(null);

  // Track the OS preference for as long as `system` is selected — and while it
  // isn't, too, so flipping back to `system` is instant rather than waiting for
  // the next OS change to land.
  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(MEDIA);
    } catch {
      return;
    }
    const onChange = () => setSystem(mq.matches ? 'dark' : 'light');
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getPref('theme').then(stored => {
      if (cancelled) return;
      if (stored === 'dark' || stored === 'light' || stored === 'system') {
        persisted.current = stored;
        setPrefState(stored);
      } else {
        // Nothing in Dexie means the rider never chose a theme — so whatever is
        // in the paint hint is a default this app wrote for itself, not an
        // answer. Before this existed the app defaulted to light and never read
        // the OS at all, which shipped its least-tested surface to every rider
        // whose phone is in dark mode. Correcting it here costs at most one
        // frame, which is exactly what the hint is allowed to be wrong by.
        setPrefState('system');
      }
      hydrated.current = true;
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    writePaintHint(pref);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0f0f0f' : '#f4f4f5');

    // Before hydration, `pref` is the paint hint, not a rider's choice.
    // Nothing stored also stays nothing stored: the default isn't a preference
    // anyone expressed, and syncing it would overwrite a real choice made on
    // another device.
    if (!hydrated.current || persisted.current === pref) return;
    persisted.current = pref;
    void setPref('theme', pref).then(() => syncNow());
  }, [pref, theme]);

  const toggleTheme = () => setPrefState(theme === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, pref, setPref: setPrefState, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
