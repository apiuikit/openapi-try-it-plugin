import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEscapeLayer } from "../escapeLayer";

/** Stands in for apiuikit's SidePanel, which listens on `document` in the
 * bubble phase — the listener a plugin overlay must not let Escape reach. */
function listenLikeSidePanel(onEscape: () => void) {
  const handler = (event: KeyboardEvent) => {
    if (event.key === "Escape") onEscape();
  };
  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}

function Layer({ active, onEscape }: { active: boolean; onEscape: () => void }) {
  useEscapeLayer(active, onEscape);
  return null;
}

function pressEscape() {
  // Dispatched on an element, not on `document` itself: only then does the
  // document-level capture listener run *before* the target, which is what
  // lets it swallow the event. An event whose target is `document` would
  // reach both listeners regardless of phase.
  act(() => {
    window.document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
  });
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = window.document.createElement("div");
  window.document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("useEscapeLayer", () => {
  it("dismisses the layer and keeps Escape from reaching the side panel", () => {
    const onEscape = vi.fn();
    const onPanelEscape = vi.fn();
    const stopListening = listenLikeSidePanel(onPanelEscape);

    act(() => root.render(<Layer active onEscape={onEscape} />));
    pressEscape();

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(onPanelEscape).not.toHaveBeenCalled();
    stopListening();
  });

  it("leaves Escape alone while inactive, so the side panel still closes", () => {
    const onEscape = vi.fn();
    const onPanelEscape = vi.fn();
    const stopListening = listenLikeSidePanel(onPanelEscape);

    act(() => root.render(<Layer active={false} onEscape={onEscape} />));
    pressEscape();

    expect(onEscape).not.toHaveBeenCalled();
    expect(onPanelEscape).toHaveBeenCalledTimes(1);
    stopListening();
  });

  it("dismisses only the topmost layer, whichever order the layers mounted in", () => {
    const outer = vi.fn();
    const inner = vi.fn();

    // Both layers are mounted, but the inner one opens second — the stack,
    // not listener registration order, has to decide who owns Escape.
    act(() => root.render(<><Layer active onEscape={outer} /><Layer active={false} onEscape={inner} /></>));
    act(() => root.render(<><Layer active onEscape={outer} /><Layer active onEscape={inner} /></>));
    pressEscape();

    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });

  it("hands Escape back to the layer below once the top one closes", () => {
    const outer = vi.fn();
    const inner = vi.fn();

    act(() => root.render(<><Layer active onEscape={outer} /><Layer active onEscape={inner} /></>));
    act(() => root.render(<><Layer active onEscape={outer} /><Layer active={false} onEscape={inner} /></>));
    pressEscape();

    expect(outer).toHaveBeenCalledTimes(1);
    expect(inner).not.toHaveBeenCalled();
  });

  it("keeps its stack position when the callback identity changes each render", () => {
    const outer = vi.fn();
    const inner = vi.fn();

    function Overlays() {
      const [, forceRender] = useState(0);
      return (
        <>
          {/* Fresh closures every render — a re-registering layer would pop
              and re-push itself above the inner one. */}
          <Layer active onEscape={() => outer()} />
          <Layer active onEscape={() => inner()} />
          <button type="button" onClick={() => forceRender((n) => n + 1)} />
        </>
      );
    }

    act(() => root.render(<Overlays />));
    act(() => {
      container.querySelector("button")!.click();
    });
    pressEscape();

    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });
});
