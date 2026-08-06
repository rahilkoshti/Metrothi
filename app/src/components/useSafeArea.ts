import { useEffect, useState } from 'react';

/**
 * The bottom safe-area inset, in pixels.
 *
 * `index.html` opts into `viewport-fit=cover`, so on a device with a home
 * indicator the viewport extends underneath it and the app is responsible for
 * keeping its own chrome clear. Most of that is CSS and uses the `--sab` token
 * directly — but the sheet's snap points are numbers fed to framer-motion, and
 * arithmetic can't be done on an `env()`.
 *
 * Measured from a probe element rather than read off the custom property:
 * `getComputedStyle().getPropertyValue('--sab')` returns the *specified* value
 * on some engines, which is the literal string `env(safe-area-inset-bottom, 0px)`
 * rather than a length. An `offsetHeight` read is unambiguous everywhere.
 *
 * Returns 0 on every device without an inset, which is most of them — the probe
 * is created once per mount, read synchronously, and removed.
 */
export function useSafeAreaBottom(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const measure = () => {
      const probe = document.createElement('div');
      probe.style.cssText =
        'position:fixed;left:-9999px;bottom:0;width:0;visibility:hidden;' +
        'height:env(safe-area-inset-bottom, 0px)';
      document.body.appendChild(probe);
      const px = probe.offsetHeight;
      probe.remove();
      setInset((prev) => (prev === px ? prev : px));
    };
    measure();
    // A rotation moves the inset from the bottom edge to the sides and back.
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  return inset;
}
