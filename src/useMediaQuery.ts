import { useSyncExternalStore } from "react";

/** Below this width the modal goes full-screen and its two columns stack
 * into one. Inline styles can't carry media queries, hence a hook rather
 * than CSS. */
export const NARROW_VIEWPORT_QUERY = "(max-width: 767px)";

/** Whether `query` currently matches, re-rendering when that changes.
 * Reports `false` wherever `matchMedia` is missing (SSR, jsdom), so the
 * default is the wide layout. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}

export function useIsNarrowViewport(): boolean {
  return useMediaQuery(NARROW_VIEWPORT_QUERY);
}
