import { useRef, useState } from "react";
import { GameEvent, TeamState, useStore } from "../../store";
import { buildGamesheetPdfBytes, GamesheetPdfLayout, getDefaultGamesheetPdfLayout } from "../../utils/gamesheetPdf";
import { GlassPanel } from "./ui/glass";

const PDF_LAYOUT_STORAGE_KEY = "gamesheetPdfLayoutV1";

function AlignSelect({
  value,
  onChange,
}: {
  value: "left" | "center" | "right";
  onChange: (next: "left" | "center" | "right") => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as "left" | "center" | "right")}
      className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded-md px-2 py-1 text-xs"
    >
      <option value="left">Left</option>
      <option value="center">Center</option>
      <option value="right">Right</option>
    </select>
  );
}

export function loadPdfLayout(): GamesheetPdfLayout {
  try {
    const raw = localStorage.getItem(PDF_LAYOUT_STORAGE_KEY);
    if (!raw) return getDefaultGamesheetPdfLayout();
    const parsed = JSON.parse(raw) as Partial<GamesheetPdfLayout> & {
      awayRoster?: any;
      homeRoster?: any;
      awayPenalties?: any;
      homePenalties?: any;
      awayGoals?: any;
      homeGoals?: any;
    };
    const merged = { ...getDefaultGamesheetPdfLayout(), ...parsed } as GamesheetPdfLayout;

    // Back-compat: legacy teamNames used homeY/awayY (from bottom).
    const tnAny = parsed.teamNames as any;
    if (tnAny && typeof tnAny.homeY === "number" && typeof tnAny.homeYFromTop !== "number") {
      merged.teamNames = { ...merged.teamNames, homeYFromTop: 0, awayYFromTop: 0 } as any;
      (merged.teamNames as any).homeY = tnAny.homeY;
    }
    if (tnAny && typeof tnAny.awayY === "number" && typeof tnAny.awayYFromTop !== "number") {
      (merged.teamNames as any).awayY = tnAny.awayY;
    }

    // Back-compat: legacy shots used `y` (from bottom).
    const hsAny = parsed.homeShots as any;
    if (hsAny && typeof hsAny.y === "number" && typeof (hsAny.yFromTop ?? null) !== "number") {
      (merged.homeShots as any).y = hsAny.y;
    }
    const asAny = parsed.awayShots as any;
    if (asAny && typeof asAny.y === "number" && typeof (asAny.yFromTop ?? null) !== "number") {
      (merged.awayShots as any).y = asAny.y;
    }

    // Back-compat: older saved layouts used `awayRoster.x` / `homeRoster.x`.
    const awayAny = parsed.awayRoster as any;
    if (awayAny && typeof awayAny.x === "number" && typeof (awayAny.numX ?? merged.awayRoster.numX) !== "number") {
      merged.awayRoster = { ...merged.awayRoster, numX: awayAny.x, nameX: awayAny.x + 20 };
    }
    const homeAny = parsed.homeRoster as any;
    if (homeAny && typeof homeAny.x === "number" && typeof (homeAny.numX ?? merged.homeRoster.numX) !== "number") {
      merged.homeRoster = { ...merged.homeRoster, numX: homeAny.x, nameX: homeAny.x + 20 };
    }

    // Back-compat: if roster stat columns/aligns are missing, keep defaults.
    merged.awayRoster = { ...getDefaultGamesheetPdfLayout().awayRoster, ...merged.awayRoster };
    merged.homeRoster = { ...getDefaultGamesheetPdfLayout().homeRoster, ...merged.homeRoster };
    merged.awayNmRoster = { ...getDefaultGamesheetPdfLayout().awayNmRoster, ...merged.awayNmRoster } as any;
    merged.homeNmRoster = { ...getDefaultGamesheetPdfLayout().homeNmRoster, ...merged.homeNmRoster } as any;

    // Back-compat: older saved layouts used `awayPenalties.x` / `homePenalties.x`.
    const awayPenAny = parsed.awayPenalties as any;
    if (awayPenAny && typeof awayPenAny.x === "number" && !awayPenAny.cols) {
      merged.awayPenalties = {
        ...merged.awayPenalties,
        yFromTop: awayPenAny.yFromTop ?? merged.awayPenalties.yFromTop,
        lineHeight: awayPenAny.lineHeight ?? merged.awayPenalties.lineHeight,
        size: awayPenAny.size ?? merged.awayPenalties.size,
        maxLines: awayPenAny.maxLines ?? merged.awayPenalties.maxLines,
        cols: {
          ...merged.awayPenalties.cols,
          playerNumX: awayPenAny.x,
          pimX: awayPenAny.x + 34,
          offenceX: awayPenAny.x + 66,
          givenX: awayPenAny.x + 210,
          startX: awayPenAny.x + 278,
          endX: awayPenAny.x + 330,
        },
      };
    }
    const homePenAny = parsed.homePenalties as any;
    if (homePenAny && typeof homePenAny.x === "number" && !homePenAny.cols) {
      merged.homePenalties = {
        ...merged.homePenalties,
        yFromTop: homePenAny.yFromTop ?? merged.homePenalties.yFromTop,
        lineHeight: homePenAny.lineHeight ?? merged.homePenalties.lineHeight,
        size: homePenAny.size ?? merged.homePenalties.size,
        maxLines: homePenAny.maxLines ?? merged.homePenalties.maxLines,
        cols: {
          ...merged.homePenalties.cols,
          playerNumX: homePenAny.x,
          pimX: homePenAny.x + 34,
          offenceX: homePenAny.x + 66,
          givenX: homePenAny.x + 210,
          startX: homePenAny.x + 278,
          endX: homePenAny.x + 330,
        },
      };
    }

    // Back-compat: older saved layouts used `awayGoals.x` / `homeGoals.x` and a single `align`.
    const awayGoalsAny = parsed.awayGoals as any;
    if (awayGoalsAny && typeof awayGoalsAny.x === "number" && !awayGoalsAny.cols) {
      merged.awayGoals = {
        ...merged.awayGoals,
        yFromTop: awayGoalsAny.yFromTop ?? merged.awayGoals.yFromTop,
        lineHeight: awayGoalsAny.lineHeight ?? merged.awayGoals.lineHeight,
        size: awayGoalsAny.size ?? merged.awayGoals.size,
        maxLines: awayGoalsAny.maxLines ?? merged.awayGoals.maxLines,
        cols: merged.awayGoals.cols,
        aligns: {
          ...merged.awayGoals.aligns,
          time: awayGoalsAny.align ?? merged.awayGoals.aligns.time,
          scorer: awayGoalsAny.align ?? merged.awayGoals.aligns.scorer,
          assist1: awayGoalsAny.align ?? merged.awayGoals.aligns.assist1,
          assist2: awayGoalsAny.align ?? merged.awayGoals.aligns.assist2,
        },
      } as any;
      (merged.awayGoals as any).x = awayGoalsAny.x;
    }
    const homeGoalsAny = parsed.homeGoals as any;
    if (homeGoalsAny && typeof homeGoalsAny.x === "number" && !homeGoalsAny.cols) {
      merged.homeGoals = {
        ...merged.homeGoals,
        yFromTop: homeGoalsAny.yFromTop ?? merged.homeGoals.yFromTop,
        lineHeight: homeGoalsAny.lineHeight ?? merged.homeGoals.lineHeight,
        size: homeGoalsAny.size ?? merged.homeGoals.size,
        maxLines: homeGoalsAny.maxLines ?? merged.homeGoals.maxLines,
        cols: merged.homeGoals.cols,
        aligns: {
          ...merged.homeGoals.aligns,
          time: homeGoalsAny.align ?? merged.homeGoals.aligns.time,
          scorer: homeGoalsAny.align ?? merged.homeGoals.aligns.scorer,
          assist1: homeGoalsAny.align ?? merged.homeGoals.aligns.assist1,
          assist2: homeGoalsAny.align ?? merged.homeGoals.aligns.assist2,
        },
      } as any;
      (merged.homeGoals as any).x = homeGoalsAny.x;
    }

    const awayNmAny = parsed.awayNmRoster as any;
    if (awayNmAny && typeof awayNmAny.x === "number" && !awayNmAny.cols) {
      merged.awayNmRoster = {
        ...merged.awayNmRoster,
        yFromTop: awayNmAny.yFromTop ?? merged.awayNmRoster.yFromTop,
        lineHeight: awayNmAny.lineHeight ?? merged.awayNmRoster.lineHeight,
        size: awayNmAny.size ?? merged.awayNmRoster.size,
        maxLines: awayNmAny.maxLines ?? merged.awayNmRoster.maxLines,
        cols: { ...merged.awayNmRoster.cols, numX: awayNmAny.x, nameX: awayNmAny.x + 20 },
      } as any;
    }
    const homeNmAny = parsed.homeNmRoster as any;
    if (homeNmAny && typeof homeNmAny.x === "number" && !homeNmAny.cols) {
      merged.homeNmRoster = {
        ...merged.homeNmRoster,
        yFromTop: homeNmAny.yFromTop ?? merged.homeNmRoster.yFromTop,
        lineHeight: homeNmAny.lineHeight ?? merged.homeNmRoster.lineHeight,
        size: homeNmAny.size ?? merged.homeNmRoster.size,
        maxLines: homeNmAny.maxLines ?? merged.homeNmRoster.maxLines,
        cols: { ...merged.homeNmRoster.cols, numX: homeNmAny.x, nameX: homeNmAny.x + 20 },
      } as any;
    }

    return merged;
  } catch {
    return getDefaultGamesheetPdfLayout();
  }
}

function loadPdfLayoutFromUnknown(data: unknown): GamesheetPdfLayout {
  try {
    localStorage.setItem(PDF_LAYOUT_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
  return loadPdfLayout();
}

function savePdfLayout(layout: GamesheetPdfLayout) {
  localStorage.setItem(PDF_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
}

interface PdfLayoutSettingsProps {
  homeTeam: TeamState;
  awayTeam: TeamState;
  eventLog: GameEvent[];
}

export default function PdfLayoutSettings({ homeTeam, awayTeam, eventLog }: PdfLayoutSettingsProps) {
  const { user } = useStore();
  const [pdfLayout, setPdfLayout] = useState<GamesheetPdfLayout>(() => loadPdfLayout());
  const [fileLayoutStatus, setFileLayoutStatus] = useState<"idle" | "loading" | "saving" | "loaded" | "saved" | "error">("idle");
  const [showPdfPreview, setShowPdfPreview] = useState(true);
  const [previewDebug, setPreviewDebug] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const hasLoadedLayoutRef = useRef(false);
  const lastSavedLayoutRef = useRef<GamesheetPdfLayout | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const lastPreviewDepsRef = useRef<{
    showPdfPreview: boolean;
    previewDebug: boolean;
    pdfLayout: GamesheetPdfLayout;
    homeTeam: TeamState;
    awayTeam: TeamState;
    eventLog: GameEvent[];
  } | null>(null);

  if (lastSavedLayoutRef.current !== pdfLayout) {
    lastSavedLayoutRef.current = pdfLayout;
    savePdfLayout(pdfLayout);
  }

  if (!hasLoadedLayoutRef.current && user) {
    hasLoadedLayoutRef.current = true;
    setFileLayoutStatus("loading");
    user.getIdToken().then((token) => {
      fetch("/api/pdf-layout", {
        headers: { "Authorization": `Bearer ${token}` }
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((data) => {
          setPdfLayout(loadPdfLayoutFromUnknown(data));
          setFileLayoutStatus("loaded");
        })
        .catch(() => {
          setFileLayoutStatus("idle");
        });
    });
  }

  const previewDeps = {
    showPdfPreview,
    previewDebug,
    pdfLayout,
    homeTeam,
    awayTeam,
    eventLog,
  };
  const lastPreviewDeps = lastPreviewDepsRef.current;
  const previewDepsChanged =
    !lastPreviewDeps ||
    lastPreviewDeps.showPdfPreview !== previewDeps.showPdfPreview ||
    lastPreviewDeps.previewDebug !== previewDeps.previewDebug ||
    lastPreviewDeps.pdfLayout !== previewDeps.pdfLayout ||
    lastPreviewDeps.homeTeam !== previewDeps.homeTeam ||
    lastPreviewDeps.awayTeam !== previewDeps.awayTeam ||
    lastPreviewDeps.eventLog !== previewDeps.eventLog;
  lastPreviewDepsRef.current = previewDeps;

  if (!showPdfPreview) {
    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  } else if (previewDepsChanged) {
    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    previewTimerRef.current = window.setTimeout(() => {
      setIsGeneratingPreview(true);
      buildGamesheetPdfBytes({ homeTeam, awayTeam, eventLog }, { layout: pdfLayout, debug: previewDebug })
        .then((bytes) => {
          const blob = new Blob([bytes], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
        })
        .catch(() => {
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        })
        .finally(() => {
          setIsGeneratingPreview(false);
        });
    }, 300);
  }

  return (
    <GlassPanel className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-zinc-200 font-semibold">PDF layout tweaks</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    setFileLayoutStatus("saving");
                    const token = await user?.getIdToken();
                    const res = await fetch("/api/pdf-layout", {
                      method: "POST",
                      headers: { 
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                      },
                      body: JSON.stringify(pdfLayout),
                    });
                    if (!res.ok) {
                      setFileLayoutStatus("error");
                      setTimeout(() => setFileLayoutStatus("idle"), 2000);
                      return;
                    }
                    setFileLayoutStatus("saved");
                    setTimeout(() => setFileLayoutStatus("idle"), 1200);
                  } catch {
                    setFileLayoutStatus("error");
                    setTimeout(() => setFileLayoutStatus("idle"), 2000);
                  }
                }}
                className="px-2 py-1 text-xs rounded bg-indigo-500/80 hover:bg-indigo-500 border border-indigo-400/40 text-white"
              >
                Save to file
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setFileLayoutStatus("loading");
                    const token = await user?.getIdToken();
                    const res = await fetch("/api/pdf-layout", {
                      headers: { "Authorization": `Bearer ${token}` }
                    });
                    if (!res.ok) {
                      setFileLayoutStatus("error");
                      setTimeout(() => setFileLayoutStatus("idle"), 2000);
                      return;
                    }
                    const data = (await res.json()) as unknown;
                    setPdfLayout(loadPdfLayoutFromUnknown(data));
                    setFileLayoutStatus("loaded");
                    setTimeout(() => setFileLayoutStatus("idle"), 1200);
                  } catch {
                    setFileLayoutStatus("error");
                    setTimeout(() => setFileLayoutStatus("idle"), 2000);
                  }
                }}
                className="px-2 py-1 text-xs rounded bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] text-zinc-200"
              >
                Load from file
              </button>
              <button
                type="button"
                onClick={() => setPdfLayout(getDefaultGamesheetPdfLayout())}
                className="px-2 py-1 text-xs rounded bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] text-zinc-200"
              >
                Reset defaults
              </button>
              <div className="text-xs text-zinc-500 min-w-[90px] text-right">
                {fileLayoutStatus === "saving"
                  ? "Saving…"
                  : fileLayoutStatus === "saved"
                    ? "Saved"
                    : fileLayoutStatus === "loading"
                      ? "Loading…"
                      : fileLayoutStatus === "loaded"
                        ? "Loaded"
                        : fileLayoutStatus === "error"
                          ? "Error"
                          : ""}
              </div>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 min-[760px]:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={showPdfPreview}
                onChange={(e) => setShowPdfPreview(e.target.checked)}
                className="accent-indigo-500"
              />
              Live preview
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={previewDebug}
                onChange={(e) => setPreviewDebug(e.target.checked)}
                className="accent-indigo-500"
                disabled={!showPdfPreview}
              />
              Preview debug grid/labels
            </label>
            <div className="text-xs text-zinc-500 flex items-center">
              {showPdfPreview ? (isGeneratingPreview ? "Updating preview…" : "Preview ready") : "Preview off"}
            </div>
          </div>

          {showPdfPreview && (
            <div className="mb-6 border border-white/10 rounded-lg overflow-hidden bg-zinc-900">
              {previewUrl ? (
                <iframe
                  title="Gamesheet PDF preview"
                  src={previewUrl}
                  className="w-full h-[560px] bg-zinc-900"
                />
              ) : (
                <div className="p-4 text-sm text-zinc-500">Preview unavailable (template missing or generation error).</div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 min-[760px]:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400">Scale</span>
              <input
                type="number"
                step="0.01"
                value={pdfLayout.scale}
                onChange={(e) => setPdfLayout((p) => ({ ...p, scale: Number(e.target.value) || 1 }))}
                className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-sm font-mono"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400">Offset X</span>
              <input
                type="number"
                step="1"
                value={pdfLayout.offsetX}
                onChange={(e) => setPdfLayout((p) => ({ ...p, offsetX: Number(e.target.value) || 0 }))}
                className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-sm font-mono"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400">Offset Y</span>
              <input
                type="number"
                step="1"
                value={pdfLayout.offsetY}
                onChange={(e) => setPdfLayout((p) => ({ ...p, offsetY: Number(e.target.value) || 0 }))}
                className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-sm font-mono"
              />
            </label>
          </div>

          <div className="mt-4 border border-white/10 rounded p-3">
            <div className="text-xs font-semibold text-zinc-300 mb-2">Team names</div>
            <div className="grid grid-cols-1 min-[760px]:grid-cols-3 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-zinc-400">Home X</span>
                <input
                  type="number"
                  step="1"
                  value={pdfLayout.teamNames.homeX}
                  onChange={(e) =>
                    setPdfLayout((p) => ({ ...p, teamNames: { ...p.teamNames, homeX: Number(e.target.value) || p.teamNames.homeX } }))
                  }
                  className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-zinc-400">Home Y from top</span>
                <input
                  type="number"
                  value={pdfLayout.teamNames.homeYFromTop}
                  onChange={(e) =>
                    setPdfLayout((p) => ({
                      ...p,
                      teamNames: { ...p.teamNames, homeYFromTop: Number(e.target.value) || p.teamNames.homeYFromTop },
                    }))
                  }
                  className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-zinc-400">Name font size</span>
                <input
                  type="number"
                  step="0.5"
                  value={pdfLayout.teamNames.size}
                  onChange={(e) =>
                    setPdfLayout((p) => ({ ...p, teamNames: { ...p.teamNames, size: Number(e.target.value) || p.teamNames.size } }))
                  }
                  className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-zinc-400">Alignment</span>
                <AlignSelect
                  value={pdfLayout.teamNames.align ?? "left"}
                  onChange={(next) => setPdfLayout((p) => ({ ...p, teamNames: { ...p.teamNames, align: next } }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-zinc-400">Away X</span>
                <input
                  type="number"
                  step="1"
                  value={pdfLayout.teamNames.awayX}
                  onChange={(e) =>
                    setPdfLayout((p) => ({ ...p, teamNames: { ...p.teamNames, awayX: Number(e.target.value) || p.teamNames.awayX } }))
                  }
                  className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-zinc-400">Away Y from top</span>
                <input
                  type="number"
                  value={pdfLayout.teamNames.awayYFromTop}
                  onChange={(e) =>
                    setPdfLayout((p) => ({
                      ...p,
                      teamNames: { ...p.teamNames, awayYFromTop: Number(e.target.value) || p.teamNames.awayYFromTop },
                    }))
                  }
                  className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                />
              </label>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 min-[760px]:grid-cols-2 gap-4">
            <div className="border border-white/10 rounded p-3">
              <div className="text-xs font-semibold text-zinc-300 mb-2">Away roster</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400"># X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayRoster.numX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, awayRoster: { ...p.awayRoster, numX: Number(e.target.value) || 0 } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Name X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayRoster.nameX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, awayRoster: { ...p.awayRoster, nameX: Number(e.target.value) || 0 } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">G X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayRoster.goalsX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, awayRoster: { ...p.awayRoster, goalsX: Number(e.target.value) || 0 } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">A X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayRoster.assistsX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, awayRoster: { ...p.awayRoster, assistsX: Number(e.target.value) || 0 } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">PIM X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayRoster.pimX}
                    onChange={(e) => setPdfLayout((p) => ({ ...p, awayRoster: { ...p.awayRoster, pimX: Number(e.target.value) || 0 } }))}
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Y from top</span>
                  <input
                    type="number"
                    value={pdfLayout.awayRoster.yFromTop}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, awayRoster: { ...p.awayRoster, yFromTop: Number(e.target.value) || 0 } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Line height</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.awayRoster.lineHeight}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayRoster: { ...p.awayRoster, lineHeight: Number(e.target.value) || p.awayRoster.lineHeight },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Font size</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.awayRoster.size}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, awayRoster: { ...p.awayRoster, size: Number(e.target.value) || p.awayRoster.size } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Max lines</span>
                  <input
                    type="number"
                    value={pdfLayout.awayRoster.maxLines}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayRoster: { ...p.awayRoster, maxLines: Math.max(1, Number(e.target.value) || p.awayRoster.maxLines) },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400"># align</span>
                  <AlignSelect
                    value={pdfLayout.awayRoster.numAlign ?? "left"}
                    onChange={(next) => setPdfLayout((p) => ({ ...p, awayRoster: { ...p.awayRoster, numAlign: next } }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Name align</span>
                  <AlignSelect
                    value={pdfLayout.awayRoster.nameAlign ?? "left"}
                    onChange={(next) => setPdfLayout((p) => ({ ...p, awayRoster: { ...p.awayRoster, nameAlign: next } }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">G align</span>
                  <AlignSelect
                    value={pdfLayout.awayRoster.goalsAlign ?? "left"}
                    onChange={(next) => setPdfLayout((p) => ({ ...p, awayRoster: { ...p.awayRoster, goalsAlign: next } }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">A align</span>
                  <AlignSelect
                    value={pdfLayout.awayRoster.assistsAlign ?? "left"}
                    onChange={(next) => setPdfLayout((p) => ({ ...p, awayRoster: { ...p.awayRoster, assistsAlign: next } }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">PIM align</span>
                  <AlignSelect
                    value={pdfLayout.awayRoster.pimAlign ?? "left"}
                    onChange={(next) => setPdfLayout((p) => ({ ...p, awayRoster: { ...p.awayRoster, pimAlign: next } }))}
                  />
                </label>
              </div>
            </div>

            <div className="border border-white/10 rounded p-3">
              <div className="text-xs font-semibold text-zinc-300 mb-2">Home roster</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400"># X</span>
                  <input
                    type="number"
                    value={pdfLayout.homeRoster.numX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, homeRoster: { ...p.homeRoster, numX: Number(e.target.value) || 0 } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Name X</span>
                  <input
                    type="number"
                    value={pdfLayout.homeRoster.nameX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, homeRoster: { ...p.homeRoster, nameX: Number(e.target.value) || 0 } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">G X</span>
                  <input
                    type="number"
                    value={pdfLayout.homeRoster.goalsX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, homeRoster: { ...p.homeRoster, goalsX: Number(e.target.value) || 0 } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">A X</span>
                  <input
                    type="number"
                    value={pdfLayout.homeRoster.assistsX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, homeRoster: { ...p.homeRoster, assistsX: Number(e.target.value) || 0 } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">PIM X</span>
                  <input
                    type="number"
                    value={pdfLayout.homeRoster.pimX}
                    onChange={(e) => setPdfLayout((p) => ({ ...p, homeRoster: { ...p.homeRoster, pimX: Number(e.target.value) || 0 } }))}
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Y from top</span>
                  <input
                    type="number"
                    value={pdfLayout.homeRoster.yFromTop}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, homeRoster: { ...p.homeRoster, yFromTop: Number(e.target.value) || 0 } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Line height</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.homeRoster.lineHeight}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homeRoster: { ...p.homeRoster, lineHeight: Number(e.target.value) || p.homeRoster.lineHeight },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Font size</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.homeRoster.size}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, homeRoster: { ...p.homeRoster, size: Number(e.target.value) || p.homeRoster.size } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Max lines</span>
                  <input
                    type="number"
                    value={pdfLayout.homeRoster.maxLines}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homeRoster: { ...p.homeRoster, maxLines: Math.max(1, Number(e.target.value) || p.homeRoster.maxLines) },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400"># align</span>
                  <AlignSelect
                    value={pdfLayout.homeRoster.numAlign ?? "left"}
                    onChange={(next) => setPdfLayout((p) => ({ ...p, homeRoster: { ...p.homeRoster, numAlign: next } }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Name align</span>
                  <AlignSelect
                    value={pdfLayout.homeRoster.nameAlign ?? "left"}
                    onChange={(next) => setPdfLayout((p) => ({ ...p, homeRoster: { ...p.homeRoster, nameAlign: next } }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">G align</span>
                  <AlignSelect
                    value={pdfLayout.homeRoster.goalsAlign ?? "left"}
                    onChange={(next) => setPdfLayout((p) => ({ ...p, homeRoster: { ...p.homeRoster, goalsAlign: next } }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">A align</span>
                  <AlignSelect
                    value={pdfLayout.homeRoster.assistsAlign ?? "left"}
                    onChange={(next) => setPdfLayout((p) => ({ ...p, homeRoster: { ...p.homeRoster, assistsAlign: next } }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">PIM align</span>
                  <AlignSelect
                    value={pdfLayout.homeRoster.pimAlign ?? "left"}
                    onChange={(next) => setPdfLayout((p) => ({ ...p, homeRoster: { ...p.homeRoster, pimAlign: next } }))}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 min-[760px]:grid-cols-2 gap-4">
            <div className="border border-white/10 rounded p-3">
              <div className="text-xs font-semibold text-zinc-300 mb-2">Away goals</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayGoals.cols.timeX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, awayGoals: { ...p.awayGoals, cols: { ...p.awayGoals.cols, timeX: Number(e.target.value) || 0 } } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Scorer # X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayGoals.cols.scorerX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, awayGoals: { ...p.awayGoals, cols: { ...p.awayGoals.cols, scorerX: Number(e.target.value) || 0 } } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Assist 1 X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayGoals.cols.assist1X}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, awayGoals: { ...p.awayGoals, cols: { ...p.awayGoals.cols, assist1X: Number(e.target.value) || 0 } } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Assist 2 X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayGoals.cols.assist2X}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, awayGoals: { ...p.awayGoals, cols: { ...p.awayGoals.cols, assist2X: Number(e.target.value) || 0 } } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Y from top</span>
                  <input
                    type="number"
                    value={pdfLayout.awayGoals.yFromTop}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, awayGoals: { ...p.awayGoals, yFromTop: Number(e.target.value) || 0 } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Line height</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.awayGoals.lineHeight}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, awayGoals: { ...p.awayGoals, lineHeight: Number(e.target.value) || p.awayGoals.lineHeight } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Font size</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.awayGoals.size}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, awayGoals: { ...p.awayGoals, size: Number(e.target.value) || p.awayGoals.size } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Max lines</span>
                  <input
                    type="number"
                    value={pdfLayout.awayGoals.maxLines}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayGoals: { ...p.awayGoals, maxLines: Math.max(1, Number(e.target.value) || p.awayGoals.maxLines) },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Time align</span>
                  <AlignSelect value={pdfLayout.awayGoals.aligns.time} onChange={(next) => setPdfLayout((p) => ({ ...p, awayGoals: { ...p.awayGoals, aligns: { ...p.awayGoals.aligns, time: next } } }))} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Scorer align</span>
                  <AlignSelect value={pdfLayout.awayGoals.aligns.scorer} onChange={(next) => setPdfLayout((p) => ({ ...p, awayGoals: { ...p.awayGoals, aligns: { ...p.awayGoals.aligns, scorer: next } } }))} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">A1 align</span>
                  <AlignSelect value={pdfLayout.awayGoals.aligns.assist1} onChange={(next) => setPdfLayout((p) => ({ ...p, awayGoals: { ...p.awayGoals, aligns: { ...p.awayGoals.aligns, assist1: next } } }))} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">A2 align</span>
                  <AlignSelect value={pdfLayout.awayGoals.aligns.assist2} onChange={(next) => setPdfLayout((p) => ({ ...p, awayGoals: { ...p.awayGoals, aligns: { ...p.awayGoals.aligns, assist2: next } } }))} />
                </label>
              </div>
            </div>

            <div className="border border-white/10 rounded p-3">
              <div className="text-xs font-semibold text-zinc-300 mb-2">Home goals</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">X</span>
                  <input
                    type="number"
                    value={pdfLayout.homeGoals.cols.timeX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, homeGoals: { ...p.homeGoals, cols: { ...p.homeGoals.cols, timeX: Number(e.target.value) || 0 } } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Scorer # X</span>
                  <input
                    type="number"
                    value={pdfLayout.homeGoals.cols.scorerX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, homeGoals: { ...p.homeGoals, cols: { ...p.homeGoals.cols, scorerX: Number(e.target.value) || 0 } } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Assist 1 X</span>
                  <input
                    type="number"
                    value={pdfLayout.homeGoals.cols.assist1X}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, homeGoals: { ...p.homeGoals, cols: { ...p.homeGoals.cols, assist1X: Number(e.target.value) || 0 } } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Assist 2 X</span>
                  <input
                    type="number"
                    value={pdfLayout.homeGoals.cols.assist2X}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, homeGoals: { ...p.homeGoals, cols: { ...p.homeGoals.cols, assist2X: Number(e.target.value) || 0 } } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Y from top</span>
                  <input
                    type="number"
                    value={pdfLayout.homeGoals.yFromTop}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, homeGoals: { ...p.homeGoals, yFromTop: Number(e.target.value) || 0 } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Line height</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.homeGoals.lineHeight}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, homeGoals: { ...p.homeGoals, lineHeight: Number(e.target.value) || p.homeGoals.lineHeight } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Font size</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.homeGoals.size}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, homeGoals: { ...p.homeGoals, size: Number(e.target.value) || p.homeGoals.size } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Max lines</span>
                  <input
                    type="number"
                    value={pdfLayout.homeGoals.maxLines}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homeGoals: { ...p.homeGoals, maxLines: Math.max(1, Number(e.target.value) || p.homeGoals.maxLines) },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Time align</span>
                  <AlignSelect value={pdfLayout.homeGoals.aligns.time} onChange={(next) => setPdfLayout((p) => ({ ...p, homeGoals: { ...p.homeGoals, aligns: { ...p.homeGoals.aligns, time: next } } }))} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Scorer align</span>
                  <AlignSelect value={pdfLayout.homeGoals.aligns.scorer} onChange={(next) => setPdfLayout((p) => ({ ...p, homeGoals: { ...p.homeGoals, aligns: { ...p.homeGoals.aligns, scorer: next } } }))} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">A1 align</span>
                  <AlignSelect value={pdfLayout.homeGoals.aligns.assist1} onChange={(next) => setPdfLayout((p) => ({ ...p, homeGoals: { ...p.homeGoals, aligns: { ...p.homeGoals.aligns, assist1: next } } }))} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">A2 align</span>
                  <AlignSelect value={pdfLayout.homeGoals.aligns.assist2} onChange={(next) => setPdfLayout((p) => ({ ...p, homeGoals: { ...p.homeGoals, aligns: { ...p.homeGoals.aligns, assist2: next } } }))} />
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 min-[760px]:grid-cols-2 gap-4">
            <div className="border border-white/10 rounded p-3">
              <div className="text-xs font-semibold text-zinc-300 mb-2">Away penalties</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Player # X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayPenalties.cols.playerNumX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPenalties: {
                          ...p.awayPenalties,
                          cols: { ...p.awayPenalties.cols, playerNumX: Number(e.target.value) || 0 },
                        },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">PIM X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayPenalties.cols.pimX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPenalties: { ...p.awayPenalties, cols: { ...p.awayPenalties.cols, pimX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Offence X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayPenalties.cols.offenceX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPenalties: {
                          ...p.awayPenalties,
                          cols: { ...p.awayPenalties.cols, offenceX: Number(e.target.value) || 0 },
                        },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Given X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayPenalties.cols.givenX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPenalties: { ...p.awayPenalties, cols: { ...p.awayPenalties.cols, givenX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Start X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayPenalties.cols.startX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPenalties: { ...p.awayPenalties, cols: { ...p.awayPenalties.cols, startX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">End X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayPenalties.cols.endX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPenalties: { ...p.awayPenalties, cols: { ...p.awayPenalties.cols, endX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Player # align</span>
                  <AlignSelect
                    value={pdfLayout.awayPenalties.aligns?.playerNum ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPenalties: { ...p.awayPenalties, aligns: { ...(p.awayPenalties as any).aligns, playerNum: next } },
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">PIM align</span>
                  <AlignSelect
                    value={pdfLayout.awayPenalties.aligns?.pim ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPenalties: { ...p.awayPenalties, aligns: { ...(p.awayPenalties as any).aligns, pim: next } },
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Offence align</span>
                  <AlignSelect
                    value={pdfLayout.awayPenalties.aligns?.offence ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPenalties: { ...p.awayPenalties, aligns: { ...(p.awayPenalties as any).aligns, offence: next } },
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Given align</span>
                  <AlignSelect
                    value={pdfLayout.awayPenalties.aligns?.given ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPenalties: { ...p.awayPenalties, aligns: { ...(p.awayPenalties as any).aligns, given: next } },
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Start align</span>
                  <AlignSelect
                    value={pdfLayout.awayPenalties.aligns?.start ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPenalties: { ...p.awayPenalties, aligns: { ...(p.awayPenalties as any).aligns, start: next } },
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">End align</span>
                  <AlignSelect
                    value={pdfLayout.awayPenalties.aligns?.end ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPenalties: { ...p.awayPenalties, aligns: { ...(p.awayPenalties as any).aligns, end: next } },
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Y from top</span>
                  <input
                    type="number"
                    value={pdfLayout.awayPenalties.yFromTop}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPenalties: { ...p.awayPenalties, yFromTop: Number(e.target.value) || 0 },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Line height</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.awayPenalties.lineHeight}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPenalties: { ...p.awayPenalties, lineHeight: Number(e.target.value) || p.awayPenalties.lineHeight },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Font size</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.awayPenalties.size}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPenalties: { ...p.awayPenalties, size: Number(e.target.value) || p.awayPenalties.size },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Max lines</span>
                  <input
                    type="number"
                    value={pdfLayout.awayPenalties.maxLines}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPenalties: { ...p.awayPenalties, maxLines: Math.max(1, Number(e.target.value) || p.awayPenalties.maxLines) },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
              </div>
            </div>

            <div className="border border-white/10 rounded p-3">
              <div className="text-xs font-semibold text-zinc-300 mb-2">Home penalties</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Player # X</span>
                  <input
                    type="number"
                    value={pdfLayout.homePenalties.cols.playerNumX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePenalties: {
                          ...p.homePenalties,
                          cols: { ...p.homePenalties.cols, playerNumX: Number(e.target.value) || 0 },
                        },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">PIM X</span>
                  <input
                    type="number"
                    value={pdfLayout.homePenalties.cols.pimX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePenalties: { ...p.homePenalties, cols: { ...p.homePenalties.cols, pimX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Offence X</span>
                  <input
                    type="number"
                    value={pdfLayout.homePenalties.cols.offenceX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePenalties: {
                          ...p.homePenalties,
                          cols: { ...p.homePenalties.cols, offenceX: Number(e.target.value) || 0 },
                        },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Given X</span>
                  <input
                    type="number"
                    value={pdfLayout.homePenalties.cols.givenX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePenalties: { ...p.homePenalties, cols: { ...p.homePenalties.cols, givenX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Start X</span>
                  <input
                    type="number"
                    value={pdfLayout.homePenalties.cols.startX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePenalties: { ...p.homePenalties, cols: { ...p.homePenalties.cols, startX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">End X</span>
                  <input
                    type="number"
                    value={pdfLayout.homePenalties.cols.endX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePenalties: { ...p.homePenalties, cols: { ...p.homePenalties.cols, endX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Player # align</span>
                  <AlignSelect
                    value={pdfLayout.homePenalties.aligns?.playerNum ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePenalties: { ...p.homePenalties, aligns: { ...(p.homePenalties as any).aligns, playerNum: next } },
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">PIM align</span>
                  <AlignSelect
                    value={pdfLayout.homePenalties.aligns?.pim ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePenalties: { ...p.homePenalties, aligns: { ...(p.homePenalties as any).aligns, pim: next } },
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Offence align</span>
                  <AlignSelect
                    value={pdfLayout.homePenalties.aligns?.offence ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePenalties: { ...p.homePenalties, aligns: { ...(p.homePenalties as any).aligns, offence: next } },
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Given align</span>
                  <AlignSelect
                    value={pdfLayout.homePenalties.aligns?.given ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePenalties: { ...p.homePenalties, aligns: { ...(p.homePenalties as any).aligns, given: next } },
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Start align</span>
                  <AlignSelect
                    value={pdfLayout.homePenalties.aligns?.start ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePenalties: { ...p.homePenalties, aligns: { ...(p.homePenalties as any).aligns, start: next } },
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">End align</span>
                  <AlignSelect
                    value={pdfLayout.homePenalties.aligns?.end ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePenalties: { ...p.homePenalties, aligns: { ...(p.homePenalties as any).aligns, end: next } },
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Y from top</span>
                  <input
                    type="number"
                    value={pdfLayout.homePenalties.yFromTop}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePenalties: { ...p.homePenalties, yFromTop: Number(e.target.value) || 0 },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Line height</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.homePenalties.lineHeight}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePenalties: { ...p.homePenalties, lineHeight: Number(e.target.value) || p.homePenalties.lineHeight },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Font size</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.homePenalties.size}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePenalties: { ...p.homePenalties, size: Number(e.target.value) || p.homePenalties.size },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Max lines</span>
                  <input
                    type="number"
                    value={pdfLayout.homePenalties.maxLines}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePenalties: { ...p.homePenalties, maxLines: Math.max(1, Number(e.target.value) || p.homePenalties.maxLines) },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 min-[760px]:grid-cols-2 gap-4">
            <div className="border border-white/10 rounded p-3">
              <div className="text-xs font-semibold text-zinc-300 mb-2">Shots on goal</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Home X</span>
                  <input
                    type="number"
                    step="1"
                    value={pdfLayout.homeShots.x}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, homeShots: { ...p.homeShots, x: Number(e.target.value) || p.homeShots.x } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Away X</span>
                  <input
                    type="number"
                    step="1"
                    value={pdfLayout.awayShots.x}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, awayShots: { ...p.awayShots, x: Number(e.target.value) || p.awayShots.x } }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Home Y from top</span>
                  <input
                    type="number"
                    value={pdfLayout.homeShots.yFromTop}
                    onChange={(e) => {
                      const yFromTop = Number(e.target.value) || 0;
                      setPdfLayout((p) => ({ ...p, homeShots: { ...p.homeShots, yFromTop } }));
                    }}
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Home font size</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.homeShots.size}
                    onChange={(e) => {
                      const size = Number(e.target.value) || pdfLayout.homeShots.size;
                      setPdfLayout((p) => ({ ...p, homeShots: { ...p.homeShots, size } }));
                    }}
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Home align</span>
                  <AlignSelect
                    value={pdfLayout.homeShots.align ?? "left"}
                    onChange={(next) => setPdfLayout((p) => ({ ...p, homeShots: { ...p.homeShots, align: next } }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Away Y from top</span>
                  <input
                    type="number"
                    value={pdfLayout.awayShots.yFromTop}
                    onChange={(e) => {
                      const yFromTop = Number(e.target.value) || 0;
                      setPdfLayout((p) => ({ ...p, awayShots: { ...p.awayShots, yFromTop } }));
                    }}
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Away font size</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.awayShots.size}
                    onChange={(e) => {
                      const size = Number(e.target.value) || pdfLayout.awayShots.size;
                      setPdfLayout((p) => ({ ...p, awayShots: { ...p.awayShots, size } }));
                    }}
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Away align</span>
                  <AlignSelect
                    value={pdfLayout.awayShots.align ?? "left"}
                    onChange={(next) => setPdfLayout((p) => ({ ...p, awayShots: { ...p.awayShots, align: next } }))}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 min-[760px]:grid-cols-2 gap-4">
            <div className="border border-white/10 rounded p-3">
              <div className="text-xs font-semibold text-zinc-300 mb-2">Away goals by period</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Label X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayPeriodLabel.goalsX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPeriodLabel: { ...p.awayPeriodLabel, goalsX: Number(e.target.value) || 0 },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">P1 X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayPeriodGoals.cols.p1X}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPeriodGoals: { ...p.awayPeriodGoals, cols: { ...p.awayPeriodGoals.cols, p1X: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">P2 X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayPeriodGoals.cols.p2X}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPeriodGoals: { ...p.awayPeriodGoals, cols: { ...p.awayPeriodGoals.cols, p2X: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">P3 X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayPeriodGoals.cols.p3X}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPeriodGoals: { ...p.awayPeriodGoals, cols: { ...p.awayPeriodGoals.cols, p3X: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">OT X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayPeriodGoals.cols.otX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPeriodGoals: { ...p.awayPeriodGoals, cols: { ...p.awayPeriodGoals.cols, otX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Total X (0=off)</span>
                  <input
                    type="number"
                    value={pdfLayout.awayPeriodGoals.cols.totalX ?? 0}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPeriodGoals: {
                          ...p.awayPeriodGoals,
                          cols: { ...p.awayPeriodGoals.cols, totalX: Number(e.target.value) || 0 },
                        },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Y from top</span>
                  <input
                    type="number"
                    value={pdfLayout.awayPeriodGoals.yFromTop}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPeriodGoals: { ...p.awayPeriodGoals, yFromTop: Number(e.target.value) || 0 },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Font size</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.awayPeriodGoals.size}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPeriodGoals: { ...p.awayPeriodGoals, size: Number(e.target.value) || p.awayPeriodGoals.size },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Align</span>
                  <AlignSelect
                    value={pdfLayout.awayPeriodGoals.align ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPeriodGoals: { ...p.awayPeriodGoals, align: next },
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Label size</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.awayPeriodLabel.size}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPeriodLabel: { ...p.awayPeriodLabel, size: Number(e.target.value) || p.awayPeriodLabel.size },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Label align</span>
                  <AlignSelect
                    value={pdfLayout.awayPeriodLabel.align ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPeriodLabel: { ...p.awayPeriodLabel, align: next },
                      }))
                    }
                  />
                </label>
              </div>
            </div>

            <div className="border border-white/10 rounded p-3">
              <div className="text-xs font-semibold text-zinc-300 mb-2">Home goals by period</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Label X</span>
                  <input
                    type="number"
                    value={pdfLayout.homePeriodLabel.goalsX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePeriodLabel: { ...p.homePeriodLabel, goalsX: Number(e.target.value) || 0 },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">P1 X</span>
                  <input
                    type="number"
                    value={pdfLayout.homePeriodGoals.cols.p1X}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePeriodGoals: { ...p.homePeriodGoals, cols: { ...p.homePeriodGoals.cols, p1X: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">P2 X</span>
                  <input
                    type="number"
                    value={pdfLayout.homePeriodGoals.cols.p2X}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePeriodGoals: { ...p.homePeriodGoals, cols: { ...p.homePeriodGoals.cols, p2X: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">P3 X</span>
                  <input
                    type="number"
                    value={pdfLayout.homePeriodGoals.cols.p3X}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePeriodGoals: { ...p.homePeriodGoals, cols: { ...p.homePeriodGoals.cols, p3X: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">OT X</span>
                  <input
                    type="number"
                    value={pdfLayout.homePeriodGoals.cols.otX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePeriodGoals: { ...p.homePeriodGoals, cols: { ...p.homePeriodGoals.cols, otX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Total X (0=off)</span>
                  <input
                    type="number"
                    value={pdfLayout.homePeriodGoals.cols.totalX ?? 0}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePeriodGoals: {
                          ...p.homePeriodGoals,
                          cols: { ...p.homePeriodGoals.cols, totalX: Number(e.target.value) || 0 },
                        },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Y from top</span>
                  <input
                    type="number"
                    value={pdfLayout.homePeriodGoals.yFromTop}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePeriodGoals: { ...p.homePeriodGoals, yFromTop: Number(e.target.value) || 0 },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Font size</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.homePeriodGoals.size}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePeriodGoals: { ...p.homePeriodGoals, size: Number(e.target.value) || p.homePeriodGoals.size },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Align</span>
                  <AlignSelect
                    value={pdfLayout.homePeriodGoals.align ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePeriodGoals: { ...p.homePeriodGoals, align: next },
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Label size</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.homePeriodLabel.size}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePeriodLabel: { ...p.homePeriodLabel, size: Number(e.target.value) || p.homePeriodLabel.size },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Label align</span>
                  <AlignSelect
                    value={pdfLayout.homePeriodLabel.align ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePeriodLabel: { ...p.homePeriodLabel, align: next },
                      }))
                    }
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 min-[760px]:grid-cols-2 gap-4">
            <div className="border border-white/10 rounded p-3">
              <div className="text-xs font-semibold text-zinc-300 mb-2">Away PIM by period</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Label X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayPeriodLabel.pimX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPeriodLabel: { ...p.awayPeriodLabel, pimX: Number(e.target.value) || 0 },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">P1 X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayPeriodPim.cols.p1X}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPeriodPim: { ...p.awayPeriodPim, cols: { ...p.awayPeriodPim.cols, p1X: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">P2 X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayPeriodPim.cols.p2X}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPeriodPim: { ...p.awayPeriodPim, cols: { ...p.awayPeriodPim.cols, p2X: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">P3 X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayPeriodPim.cols.p3X}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPeriodPim: { ...p.awayPeriodPim, cols: { ...p.awayPeriodPim.cols, p3X: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">OT X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayPeriodPim.cols.otX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPeriodPim: { ...p.awayPeriodPim, cols: { ...p.awayPeriodPim.cols, otX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Total X (0=off)</span>
                  <input
                    type="number"
                    value={pdfLayout.awayPeriodPim.cols.totalX ?? 0}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPeriodPim: { ...p.awayPeriodPim, cols: { ...p.awayPeriodPim.cols, totalX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Y from top</span>
                  <input
                    type="number"
                    value={pdfLayout.awayPeriodPim.yFromTop}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPeriodPim: { ...p.awayPeriodPim, yFromTop: Number(e.target.value) || 0 },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Font size</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.awayPeriodPim.size}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPeriodPim: { ...p.awayPeriodPim, size: Number(e.target.value) || p.awayPeriodPim.size },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Align</span>
                  <AlignSelect
                    value={pdfLayout.awayPeriodPim.align ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayPeriodPim: { ...p.awayPeriodPim, align: next },
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Label align</span>
                  <AlignSelect
                      value={pdfLayout.awayPeriodLabel.pimAlign ?? pdfLayout.awayPeriodLabel.align ?? "left"}
                      onChange={(next) =>
                          setPdfLayout((p) => ({
                            ...p,
                            awayPeriodLabel: { ...p.awayPeriodLabel, pimAlign: next },
                          }))
                      }
                  />
                </label>
              </div>
            </div>

            <div className="border border-white/10 rounded p-3">
              <div className="text-xs font-semibold text-zinc-300 mb-2">Home PIM by period</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Label X</span>
                  <input
                    type="number"
                    value={pdfLayout.homePeriodLabel.pimX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePeriodLabel: { ...p.homePeriodLabel, pimX: Number(e.target.value) || 0 },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">P1 X</span>
                  <input
                    type="number"
                    value={pdfLayout.homePeriodPim.cols.p1X}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePeriodPim: { ...p.homePeriodPim, cols: { ...p.homePeriodPim.cols, p1X: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">P2 X</span>
                  <input
                    type="number"
                    value={pdfLayout.homePeriodPim.cols.p2X}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePeriodPim: { ...p.homePeriodPim, cols: { ...p.homePeriodPim.cols, p2X: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">P3 X</span>
                  <input
                    type="number"
                    value={pdfLayout.homePeriodPim.cols.p3X}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePeriodPim: { ...p.homePeriodPim, cols: { ...p.homePeriodPim.cols, p3X: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">OT X</span>
                  <input
                    type="number"
                    value={pdfLayout.homePeriodPim.cols.otX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePeriodPim: { ...p.homePeriodPim, cols: { ...p.homePeriodPim.cols, otX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Total X (0=off)</span>
                  <input
                    type="number"
                    value={pdfLayout.homePeriodPim.cols.totalX ?? 0}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePeriodPim: { ...p.homePeriodPim, cols: { ...p.homePeriodPim.cols, totalX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Y from top</span>
                  <input
                    type="number"
                    value={pdfLayout.homePeriodPim.yFromTop}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePeriodPim: { ...p.homePeriodPim, yFromTop: Number(e.target.value) || 0 },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Font size</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.homePeriodPim.size}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePeriodPim: { ...p.homePeriodPim, size: Number(e.target.value) || p.homePeriodPim.size },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Align</span>
                  <AlignSelect
                    value={pdfLayout.homePeriodPim.align ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homePeriodPim: { ...p.homePeriodPim, align: next },
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Label align</span>
                  <AlignSelect
                      value={pdfLayout.homePeriodLabel.pimAlign ?? pdfLayout.homePeriodLabel.align ?? "left"}
                      onChange={(next) =>
                          setPdfLayout((p) => ({
                            ...p,
                            homePeriodLabel: { ...p.homePeriodLabel, pimAlign: next },
                          }))
                      }
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 min-[760px]:grid-cols-2 gap-4">
            <div className="border border-white/10 rounded p-3">
              <div className="text-xs font-semibold text-zinc-300 mb-2">Away NM roster</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Num X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayNmRoster.cols.numX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayNmRoster: { ...p.awayNmRoster, cols: { ...p.awayNmRoster.cols, numX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Name X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayNmRoster.cols.nameX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayNmRoster: { ...p.awayNmRoster, cols: { ...p.awayNmRoster.cols, nameX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Time X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayNmRoster.cols.timeX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayNmRoster: { ...p.awayNmRoster, cols: { ...p.awayNmRoster.cols, timeX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">P1 X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayNmRoster.cols.p1X}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayNmRoster: { ...p.awayNmRoster, cols: { ...p.awayNmRoster.cols, p1X: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">P2 X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayNmRoster.cols.p2X}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayNmRoster: { ...p.awayNmRoster, cols: { ...p.awayNmRoster.cols, p2X: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">P3 X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayNmRoster.cols.p3X}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayNmRoster: { ...p.awayNmRoster, cols: { ...p.awayNmRoster.cols, p3X: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">OT X</span>
                  <input
                    type="number"
                    value={pdfLayout.awayNmRoster.cols.otX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayNmRoster: { ...p.awayNmRoster, cols: { ...p.awayNmRoster.cols, otX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Total X (0=off)</span>
                  <input
                    type="number"
                    value={pdfLayout.awayNmRoster.cols.totalX ?? 0}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayNmRoster: { ...p.awayNmRoster, cols: { ...p.awayNmRoster.cols, totalX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Y from top</span>
                  <input
                    type="number"
                    value={pdfLayout.awayNmRoster.yFromTop}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayNmRoster: { ...p.awayNmRoster, yFromTop: Number(e.target.value) || 0 },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Line height</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.awayNmRoster.lineHeight}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayNmRoster: { ...p.awayNmRoster, lineHeight: Number(e.target.value) || p.awayNmRoster.lineHeight },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Font size</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.awayNmRoster.size}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayNmRoster: { ...p.awayNmRoster, size: Number(e.target.value) || p.awayNmRoster.size },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Max lines</span>
                  <input
                    type="number"
                    value={pdfLayout.awayNmRoster.maxLines}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayNmRoster: { ...p.awayNmRoster, maxLines: Math.max(1, Number(e.target.value) || p.awayNmRoster.maxLines) },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Num align</span>
                  <AlignSelect
                    value={pdfLayout.awayNmRoster.aligns?.num ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayNmRoster: { ...p.awayNmRoster, aligns: { ...(p.awayNmRoster as any).aligns, num: next } },
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Name align</span>
                  <AlignSelect
                    value={pdfLayout.awayNmRoster.aligns?.name ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayNmRoster: { ...p.awayNmRoster, aligns: { ...(p.awayNmRoster as any).aligns, name: next } },
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Time align</span>
                  <AlignSelect
                    value={pdfLayout.awayNmRoster.aligns?.time ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayNmRoster: { ...p.awayNmRoster, aligns: { ...(p.awayNmRoster as any).aligns, time: next } },
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">P1 align</span>
                  <AlignSelect
                    value={pdfLayout.awayNmRoster.aligns?.p1 ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        awayNmRoster: { ...p.awayNmRoster, aligns: { ...(p.awayNmRoster as any).aligns, p1: next } },
                      }))
                    }
                  />
                </label>
              </div>
            </div>

            <div className="border border-white/10 rounded p-3">
              <div className="text-xs font-semibold text-zinc-300 mb-2">Home NM roster</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Num X</span>
                  <input
                    type="number"
                    value={pdfLayout.homeNmRoster.cols.numX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homeNmRoster: { ...p.homeNmRoster, cols: { ...p.homeNmRoster.cols, numX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Name X</span>
                  <input
                    type="number"
                    value={pdfLayout.homeNmRoster.cols.nameX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homeNmRoster: { ...p.homeNmRoster, cols: { ...p.homeNmRoster.cols, nameX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Time X</span>
                  <input
                    type="number"
                    value={pdfLayout.homeNmRoster.cols.timeX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homeNmRoster: { ...p.homeNmRoster, cols: { ...p.homeNmRoster.cols, timeX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">P1 X</span>
                  <input
                    type="number"
                    value={pdfLayout.homeNmRoster.cols.p1X}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homeNmRoster: { ...p.homeNmRoster, cols: { ...p.homeNmRoster.cols, p1X: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">P2 X</span>
                  <input
                    type="number"
                    value={pdfLayout.homeNmRoster.cols.p2X}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homeNmRoster: { ...p.homeNmRoster, cols: { ...p.homeNmRoster.cols, p2X: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">P3 X</span>
                  <input
                    type="number"
                    value={pdfLayout.homeNmRoster.cols.p3X}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homeNmRoster: { ...p.homeNmRoster, cols: { ...p.homeNmRoster.cols, p3X: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">OT X</span>
                  <input
                    type="number"
                    value={pdfLayout.homeNmRoster.cols.otX}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homeNmRoster: { ...p.homeNmRoster, cols: { ...p.homeNmRoster.cols, otX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Total X (0=off)</span>
                  <input
                    type="number"
                    value={pdfLayout.homeNmRoster.cols.totalX ?? 0}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homeNmRoster: { ...p.homeNmRoster, cols: { ...p.homeNmRoster.cols, totalX: Number(e.target.value) || 0 } },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Y from top</span>
                  <input
                    type="number"
                    value={pdfLayout.homeNmRoster.yFromTop}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homeNmRoster: { ...p.homeNmRoster, yFromTop: Number(e.target.value) || 0 },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Line height</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.homeNmRoster.lineHeight}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homeNmRoster: { ...p.homeNmRoster, lineHeight: Number(e.target.value) || p.homeNmRoster.lineHeight },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Font size</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pdfLayout.homeNmRoster.size}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homeNmRoster: { ...p.homeNmRoster, size: Number(e.target.value) || p.homeNmRoster.size },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Max lines</span>
                  <input
                    type="number"
                    value={pdfLayout.homeNmRoster.maxLines}
                    onChange={(e) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homeNmRoster: { ...p.homeNmRoster, maxLines: Math.max(1, Number(e.target.value) || p.homeNmRoster.maxLines) },
                      }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Num align</span>
                  <AlignSelect
                    value={pdfLayout.homeNmRoster.aligns?.num ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homeNmRoster: { ...p.homeNmRoster, aligns: { ...(p.homeNmRoster as any).aligns, num: next } },
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Name align</span>
                  <AlignSelect
                    value={pdfLayout.homeNmRoster.aligns?.name ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homeNmRoster: { ...p.homeNmRoster, aligns: { ...(p.homeNmRoster as any).aligns, name: next } },
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Time align</span>
                  <AlignSelect
                    value={pdfLayout.homeNmRoster.aligns?.time ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homeNmRoster: { ...p.homeNmRoster, aligns: { ...(p.homeNmRoster as any).aligns, time: next } },
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">P1 align</span>
                  <AlignSelect
                    value={pdfLayout.homeNmRoster.aligns?.p1 ?? "left"}
                    onChange={(next) =>
                      setPdfLayout((p) => ({
                        ...p,
                        homeNmRoster: { ...p.homeNmRoster, aligns: { ...(p.homeNmRoster as any).aligns, p1: next } },
                      }))
                    }
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 min-[760px]:grid-cols-2 gap-4">
            <div className="border border-white/10 rounded p-3">
              <div className="text-xs font-semibold text-zinc-300 mb-2">Advanced</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Right column X ratio</span>
                  <input
                    type="number"
                    step="0.01"
                    value={pdfLayout.rightColumnXRatio}
                    onChange={(e) =>
                      setPdfLayout((p) => ({ ...p, rightColumnXRatio: Number(e.target.value) || p.rightColumnXRatio }))
                    }
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Debug grid step</span>
                  <input
                    type="number"
                    step="10"
                    value={pdfLayout.debugGridStep}
                    onChange={(e) => setPdfLayout((p) => ({ ...p, debugGridStep: Math.max(10, Number(e.target.value) || p.debugGridStep) }))}
                    className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded px-2 py-1 text-xs font-mono"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="mt-3 text-xs text-zinc-500">
            Tip: click <span className="font-mono">Export (debug)</span>, then adjust scale/offset until the grid matches the
            template boxes. Settings persist in this browser.
          </div>
    </GlassPanel>
  );
}
