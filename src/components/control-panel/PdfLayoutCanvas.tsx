import { useEffect, useRef, useState } from "react";
import { GamesheetPdfLayout } from "../../utils/gamesheetPdf";
import { ANCHOR_GROUPS, LAYOUT_ANCHORS, LayoutAnchor } from "../../utils/gamesheetAnchors";

interface PdfLayoutCanvasProps {
  /** Rendered gamesheet bytes — the template with data already drawn on it. */
  pdfBytes: Uint8Array | null;
  layout: GamesheetPdfLayout;
  onChange: (next: GamesheetPdfLayout) => void;
  /** Only anchors in these groups get a handle; empty means all of them. */
  visibleGroups: string[];
}

// pdf.js is ~1MB of JS that only the layout editor needs, so it's imported on
// first render rather than pulled into the Control Panel's main chunk.
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

/**
 * Converts between layout coordinates and on-screen pixels.
 *
 * Layout coordinates are PDF points measured from the page's top-left, then put
 * through the layout's own scale/offset when drawn (see `t()` in
 * gamesheetPdf.ts). The editor has to apply that same transform, or handles
 * would sit where the text *would* be at scale 1 rather than where it actually
 * landed.
 */
export function makeTransform(pageHeight: number, displayScale: number, layout: GamesheetPdfLayout) {
  const scale = layout.scale || 1;
  const offsetX = layout.offsetX || 0;
  const offsetY = layout.offsetY || 0;

  return {
    toScreen(x: number, yFromTop: number) {
      const pdfX = offsetX + scale * x;
      const pdfY = offsetY + scale * (pageHeight - yFromTop);
      return { left: pdfX * displayScale, top: (pageHeight - pdfY) * displayScale };
    },
    toLayout(left: number, top: number) {
      const pdfX = left / displayScale;
      const pdfY = pageHeight - top / displayScale;
      return {
        x: (pdfX - offsetX) / scale,
        yFromTop: pageHeight - (pdfY - offsetY) / scale,
      };
    },
  };
}

export default function PdfLayoutCanvas({ pdfBytes, layout, onChange, visibleGroups }: PdfLayoutCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const [displayWidth, setDisplayWidth] = useState(0);
  const [dragging, setDragging] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track the container's width so the page can be drawn at its display size
  // (rendering at CSS size keeps the raster crisp instead of upscaling a fixed bitmap).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setDisplayWidth(width);
    });
    observer.observe(el);
    setDisplayWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdfBytes || displayWidth <= 0) return;
    let cancelled = false;

    void (async () => {
      try {
        const pdfjs = await loadPdfjs();
        if (cancelled) return;
        // pdf.js takes ownership of (and detaches) the buffer it's handed, so it
        // gets a copy — the same bytes also feed the download button.
        const doc = await pdfjs.getDocument({ data: pdfBytes.slice() }).promise;
        if (cancelled) return;
        const page = await doc.getPage(1);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const scale = displayWidth / baseViewport.width;
        const viewport = page.getViewport({ scale: scale * (window.devicePixelRatio || 1) });

        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${baseViewport.height * scale}px`;

        renderTaskRef.current?.cancel();
        const task = page.render({ canvas, canvasContext: context, viewport });
        renderTaskRef.current = task;
        await task.promise;
        if (cancelled) return;

        setPageSize({ width: baseViewport.width, height: baseViewport.height });
        setError(null);
      } catch (err) {
        // A cancelled render is the expected outcome of typing in a field while
        // the previous frame is still drawing — not something to surface.
        if (cancelled || (err as { name?: string })?.name === "RenderingCancelledException") return;
        setError("Could not render the template preview.");
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [pdfBytes, displayWidth]);

  const displayScale = pageSize ? displayWidth / pageSize.width : 1;
  const transform = pageSize ? makeTransform(pageSize.height, displayScale, layout) : null;

  const anchors = LAYOUT_ANCHORS.filter(
    (anchor) => visibleGroups.length === 0 || visibleGroups.includes(anchor.group),
  );

  const handlePointerDown = (anchor: LayoutAnchor) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!transform || !containerRef.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(anchor.id);

    const container = containerRef.current;
    const start = anchor.get(layout);
    const startScreen = transform.toScreen(start.x, start.yFromTop);
    const startPointer = { x: e.clientX, y: e.clientY };
    // Snapshot the layout at drag start so every move applies to the same base,
    // rather than compounding against the layout the previous move produced.
    const baseLayout = layout;

    const move = (ev: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      let left = startScreen.left + (ev.clientX - startPointer.x);
      let top = startScreen.top + (ev.clientY - startPointer.y);
      left = Math.max(0, Math.min(rect.width, left));
      top = Math.max(0, Math.min(rect.height, top));

      const next = transform.toLayout(left, top);
      onChange(
        anchor.set(baseLayout, {
          x: Math.round(next.x * 10) / 10,
          yFromTop: Math.round(next.yFromTop * 10) / 10,
        }),
      );
    };

    const up = () => {
      setDragging(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const nudge = (anchor: LayoutAnchor, dx: number, dy: number) => {
    const current = anchor.get(layout);
    onChange(anchor.set(layout, { x: current.x + dx, yFromTop: current.yFromTop + dy }));
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <canvas ref={canvasRef} className="w-full rounded-lg bg-white shadow-lg" />

      {!pdfBytes && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
          Generating preview…
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-red-950/60 text-sm text-red-200">
          {error}
        </div>
      )}

      {transform &&
        anchors.map((anchor) => {
          const pos = anchor.get(layout);
          const screen = transform.toScreen(pos.x, pos.yFromTop);
          const isDragging = dragging === anchor.id;
          return (
            <button
              key={anchor.id}
              type="button"
              onPointerDown={handlePointerDown(anchor)}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 10 : 1;
                if (e.key === "ArrowLeft") { e.preventDefault(); nudge(anchor, -step, 0); }
                if (e.key === "ArrowRight") { e.preventDefault(); nudge(anchor, step, 0); }
                if (e.key === "ArrowUp") { e.preventDefault(); nudge(anchor, 0, -step); }
                if (e.key === "ArrowDown") { e.preventDefault(); nudge(anchor, 0, step); }
              }}
              style={{ left: `${screen.left}px`, top: `${screen.top}px` }}
              title={`${anchor.group} · ${anchor.label} (drag to move, arrow keys to nudge)`}
              aria-label={`${anchor.group} ${anchor.label} position`}
              className={`group absolute -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full border touch-none cursor-grab focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
                isDragging
                  ? "cursor-grabbing border-white bg-indigo-400 scale-125"
                  : "border-white/80 bg-indigo-500/80 hover:bg-indigo-400"
              }`}
            >
              <span className="pointer-events-none absolute left-1/2 top-full z-10 hidden -translate-x-1/2 translate-y-1 whitespace-nowrap rounded bg-zinc-900/95 px-1.5 py-0.5 text-[10px] text-zinc-100 group-hover:block group-focus:block">
                {anchor.group} · {anchor.label}
              </span>
            </button>
          );
        })}
    </div>
  );
}
