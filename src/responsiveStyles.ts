import { useEffect } from "react";
import { NARROW_VIEWPORT_QUERY } from "./useMediaQuery";

/** Marks a panel root, scoping the injected rules below to this plugin's own
 * fields rather than every input on the host's page. */
export const TRYIT_ROOT_ATTR = "data-tryit-root";

const STYLE_ID = "apiuikit-tryit-responsive";

/** Safari on iOS zooms the viewport in when a text field smaller than 16px
 * takes focus, and this panel's fields are 13px — so every tap on a param
 * value would jump the page. Bumping them to 16px on a narrow viewport is
 * the standard way out.
 *
 * As a stylesheet, not inline styles, for two reasons: inline styles can't
 * carry a media query, and this way one rule covers every field in the
 * panel instead of threading a hook through all eight components that
 * render one. `!important` because the elements' own inline `font-size`
 * would otherwise win regardless of selector specificity. */
const CSS = `@media ${NARROW_VIEWPORT_QUERY} {
  [${TRYIT_ROOT_ATTR}] input:not([type="checkbox"]):not([type="radio"]),
  [${TRYIT_ROOT_ATTR}] textarea,
  [${TRYIT_ROOT_ATTR}] select { font-size: 16px !important; }
}`;

/** Injects the rules above once per document.
 *
 * Never removed: several panels can be mounted at once (the tab and a modal
 * share this), so a cleanup on the first unmount would strip the styles out
 * from under the others. It is a single `<style>` element either way.
 *
 * Goes in `document.head`, which is where the host renders this plugin
 * today. A host that mounted it inside a shadow root would not see these
 * rules — the panel stays usable, it just keeps the 13px fields. */
export function useResponsiveInputStyles(): void {
  useEffect(() => {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    const element = document.createElement("style");
    element.id = STYLE_ID;
    element.textContent = CSS;
    document.head.appendChild(element);
  }, []);
}
