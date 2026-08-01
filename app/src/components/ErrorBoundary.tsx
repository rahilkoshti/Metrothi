import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import i18n from '../i18n';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last-resort catch for render-time crashes (a Leaflet failure, a bad geocode
 * response, etc.) so the app degrades to a reload prompt instead of a white
 * screen. Must be a class component — React has no hook equivalent.
 *
 * Reads the i18next instance directly rather than through `useTranslation`,
 * which a class cannot call. That costs a re-render on language change, which
 * this screen doesn't need: it appears once, after a crash, and the next thing
 * the rider does is reload. `main.tsx` initialises i18n before `createRoot`, so
 * the instance is always ready by the time anything can throw.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center"
        style={{ background: 'var(--c-bg)', color: 'var(--c-text)' }}
      >
        <h1 className="text-xl font-semibold">{i18n.t('error.title')}</h1>
        <p className="text-sm max-w-sm" style={{ color: 'var(--c-text-3)' }}>
          {i18n.t('error.body')}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: 'var(--c-accent)', color: 'var(--c-accent-fg)' }}
        >
          {i18n.t('error.reload')}
        </button>
      </div>
    );
  }
}
