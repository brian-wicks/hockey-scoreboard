import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../../utils/cn";

const SHOW_DELAY_MS = 200;
const ANCHOR_GAP_PX = 6;
const VIEWPORT_MARGIN_PX = 8;

interface TruncatedTextProps {
  text: string;
  className?: string;
}

/** One line of text that shows the whole of it in a popup on hover, but only when it's cut off. */
export function TruncatedText({ text, className }: TruncatedTextProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const close = () => {
    window.clearTimeout(showTimer.current);
    setOpen(false);
  };

  const handleMouseEnter = () => {
    const anchor = anchorRef.current;
    if (!anchor || anchor.scrollWidth <= anchor.clientWidth) return;
    window.clearTimeout(showTimer.current);
    showTimer.current = window.setTimeout(() => setOpen(true), SHOW_DELAY_MS);
  };

  useEffect(() => () => window.clearTimeout(showTimer.current), []);

  // Sits above the text, or below it when there's no room, and stays inside the window.
  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !popupRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const popup = popupRef.current.getBoundingClientRect();
    const above = anchor.top - popup.height - ANCHOR_GAP_PX;
    const maxLeft = window.innerWidth - popup.width - VIEWPORT_MARGIN_PX;
    setPosition({
      top: above < VIEWPORT_MARGIN_PX ? anchor.bottom + ANCHOR_GAP_PX : above,
      left: Math.max(VIEWPORT_MARGIN_PX, Math.min(anchor.left, maxLeft)),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const handleScroll = () => setOpen(false);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  return (
    <>
      <div ref={anchorRef} className={cn("truncate", className)} onMouseEnter={handleMouseEnter} onMouseLeave={close}>
        {text}
      </div>
      {open &&
        createPortal(
          // Hidden from screen readers, which already get the whole text from the element above.
          <div ref={popupRef} aria-hidden="true" className="ui fixed z-50 max-w-xs pointer-events-none" style={position}>
            <div data-testid="truncated-text-popup" className="ui-dark rounded-sm bg-ink px-2 py-1 text-sm font-normal text-canvas">
              {text}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
