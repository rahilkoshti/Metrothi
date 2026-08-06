import { useEffect, useRef } from 'react';

/**
 * The four structural things a modal surface owes a keyboard or screen-reader
 * user, none of which the app's overlays had: it announces itself as a dialog,
 * it takes focus, it keeps focus, and Escape closes it.
 *
 * A hook rather than a wrapper component on purpose. The surfaces that need it
 * are shaped nothing alike — a full-bleed `motion.div`, a portaled bottom sheet
 * with its own backdrop, a mode inside the draggable sheet — and a component
 * that owned their markup would have to grow a prop for each difference. What
 * they share is the behaviour, so that is what is shared.
 *
 * Deliberately *not* here: `inert`/`aria-hidden` on the rest of the page. The
 * focus trap is what actually keeps Tab inside, and `aria-modal` is what tells
 * assistive technology to ignore everything outside — hiding siblings by hand
 * means walking a tree these overlays are rendered *inside* of.
 */

/**
 * Open dialogs, oldest first. Escape closes the topmost layer and only the
 * topmost — the live journey can open a `TrainRouteSheet` over a sheet that is
 * itself a dialog, and one Escape should peel one layer. Every dialog listens;
 * only the last one acts.
 */
const stack: symbol[] = [];

/**
 * Tab stops, in DOM order. `disabled` is filtered by the selector; the
 * visibility check catches the rest — a suggestion list that has collapsed, a
 * control inside a `display: none` branch — because a trap that wraps onto an
 * invisible element strands the user with no visible focus.
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement
  );
}

export interface DialogProps {
  role: 'dialog';
  'aria-modal': true;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  /** So the container itself can hold focus before the user has tabbed anywhere. */
  tabIndex: -1;
}

/** The attributes that make an element announce itself as a modal dialog. One
 *  of `label`/`labelledBy` is required — an unnamed dialog announces itself as
 *  nothing at all. */
export function dialogProps(label?: string, labelledBy?: string): DialogProps {
  return {
    role: 'dialog',
    'aria-modal': true,
    'aria-label': label,
    'aria-labelledby': labelledBy,
    tabIndex: -1,
  };
}

/**
 * The behaviour, applied to an element a caller already has a ref to.
 *
 * Split out from `useDialog` for the one surface that cannot mint its own ref:
 * `DraggableSheet` owns its root element for measurement and dragging, and the
 * planner *is* that sheet rather than something rendered inside it. Passing
 * `null` disables everything, which is what a sheet does in the three modes
 * where it is a surface rather than a task.
 */
export function useDialogOn<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  options: { onClose: () => void } | null
): void {
  // Held in a ref so a caller passing an inline arrow — all of them do — can't
  // retrigger the effect and re-run the focus move on every render.
  const closeRef = useRef<(() => void) | undefined>(options?.onClose);
  closeRef.current = options?.onClose;

  const active = !!options;

  useEffect(() => {
    if (!active) return;
    const id = Symbol('dialog');
    stack.push(id);

    // Where focus goes back to on close. Usually the control that opened this.
    const restoreTo = document.activeElement as HTMLElement | null;

    // Focus the *container*, not its first control. Two of these surfaces
    // already decide their own initial focus — `HomeSearch` focuses its input
    // unless it was opened from a line pill, where popping the keyboard over a
    // directory the rider asked to browse is the wrong answer — and a hook that
    // grabbed the first tabbable would overrule that. Effects run in
    // declaration order, so a caller placing its own focus effect after this
    // one wins.
    const node = ref.current;
    if (node && !node.contains(document.activeElement)) node.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      const el = ref.current;
      if (!el) return;

      if (e.key === 'Escape') {
        // Stopped rather than merely handled: the planner's suggestion list has
        // its own Escape handler, and without this an Escape meant for the list
        // would close the surface underneath it as well.
        e.stopPropagation();
        e.preventDefault();
        closeRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusableIn(el);
      const activeEl = document.activeElement as HTMLElement | null;
      if (items.length === 0) {
        e.preventDefault();
        el.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (!el.contains(activeEl)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };

    // Capture phase, so the trap sees Tab before anything inside the dialog
    // can consume it.
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const i = stack.indexOf(id);
      if (i !== -1) stack.splice(i, 1);
      // Only if it's still in the document: closing a dialog often unmounts the
      // thing that opened it, and focusing a detached node silently drops focus
      // to <body>, which is where a keyboard user then has to start again.
      if (restoreTo?.isConnected) restoreTo.focus();
    };
  }, [active, ref]);
}

/** The common case: a surface that mounts when it opens and owns its own root. */
export function useDialog<T extends HTMLElement = HTMLDivElement>({
  onClose,
  label,
  labelledBy,
}: {
  onClose: () => void;
  label?: string;
  labelledBy?: string;
}): { ref: React.RefObject<T | null>; dialogProps: DialogProps } {
  const ref = useRef<T>(null);
  useDialogOn(ref, { onClose });
  return { ref, dialogProps: dialogProps(label, labelledBy) };
}
