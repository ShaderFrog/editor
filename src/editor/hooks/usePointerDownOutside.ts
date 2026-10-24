import { RefObject, useEffect, useRef } from 'react';

/**
 * Calls onOutside when the user presses down anywhere outside of the given
 * elements, or outside of anything matching ignoreSelector (for menus rendered
 * into a portal).
 *
 * Listens for pointerdown in the capture phase so this still fires over the
 * graph and the 3D scene. React Flow stops propagation of mouse events, and
 * OrbitControls calls preventDefault() on pointerdown, which means the browser
 * never sends the follow-up mousedown event.
 */
export const usePointerDownOutside = ({
  refs,
  onOutside,
  enabled = true,
  ignoreSelector,
}: {
  refs: RefObject<Element>[];
  onOutside: () => void;
  enabled?: boolean;
  ignoreSelector?: string;
}) => {
  // Keep the latest values so callers don't need to memoize them
  const latest = useRef({ refs, onOutside, ignoreSelector });
  latest.current = { refs, onOutside, ignoreSelector };

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const { refs, onOutside, ignoreSelector } = latest.current;
      const target = event.target as Node;
      if (refs.some((ref) => ref.current?.contains(target))) {
        return;
      }
      if (
        ignoreSelector &&
        target instanceof Element &&
        target.closest(ignoreSelector)
      ) {
        return;
      }
      onOutside();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () =>
      document.removeEventListener('pointerdown', onPointerDown, true);
  }, [enabled]);
};
