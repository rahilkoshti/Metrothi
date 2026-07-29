import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getPref, setPref } from '../data/db';
import { syncNow } from '../services/syncEngine';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
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
 */
const PAINT_HINT_KEY = 'metrothi-theme';

function readPaintHint(): Theme {
  try {
    return localStorage.getItem(PAINT_HINT_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function writePaintHint(theme: Theme) {
  try {
    localStorage.setItem(PAINT_HINT_KEY, theme);
  } catch { /* private mode — Dexie still has it */ }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readPaintHint);
  /** Resolved once the Dexie read has come back, whatever it found. */
  const hydrated = useRef(false);
  /**
   * The value Dexie is known to already hold.
   *
   * Guards against writing back what we just read: loading `dark` over a `light`
   * paint hint changes `theme`, which re-runs the persist effect, which would
   * store `dark` again with a fresh `updatedAt` — and under last-write-wins that
   * bogus timestamp beats a genuinely newer preference set on another device.
   * A cold start must not be able to win a conflict.
   */
  const persisted = useRef<Theme | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getPref('theme').then(stored => {
      if (cancelled) return;
      if (stored === 'dark' || stored === 'light') {
        persisted.current = stored;
        setTheme(stored);
      }
      hydrated.current = true;
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    writePaintHint(theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0f0f0f' : '#f4f4f5');

    // Before hydration, `theme` is the paint hint, not a rider's choice.
    // Nothing stored also stays nothing stored: the default theme isn't a
    // preference anyone expressed, and syncing it would overwrite a real choice
    // made on another device.
    if (!hydrated.current || persisted.current === theme) return;
    persisted.current = theme;
    void setPref('theme', theme).then(() => syncNow());
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
