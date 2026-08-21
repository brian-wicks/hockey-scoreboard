import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, PlusCircle, Pencil } from "lucide-react";
import { SavedTeam, useStore } from "../../store";
import DashboardHeader from "../dashboard/DashboardHeader";
import { GlassButton, GlassPanel } from "../control-panel/ui/glass";
import TeamLibraryGrid from "./TeamLibraryGrid";
import TeamEditModal from "./TeamEditModal";

export default function TeamManagerPage() {
  const { isViewer, user } = useStore();
  const [editorTarget, setEditorTarget] = useState<SavedTeam | "new" | null>(null);

  // Viewers only ever arrive via /share/:shareId links, never here — theoretical guard.
  if (isViewer || !user) return null;

  return (
    <div className="relative min-h-screen text-zinc-100 font-sans">
      <div className="control-panel-ambient-bg" />
      <div className="relative z-10 flex flex-col min-h-screen">
        <DashboardHeader />

        <main className="flex-1 min-w-0 p-3 sm:p-6 max-w-5xl mx-auto w-full flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors mb-2">
                <ArrowLeft size={14} /> Back to Dashboard
              </Link>
              <h1 className="text-xl font-bold text-white">Team Library</h1>
            </div>
            <GlassButton onClick={() => setEditorTarget("new")} variant="primary">
              <PlusCircle size={16} />
              Create New Team
            </GlassButton>
          </div>

          <GlassPanel>
            <TeamLibraryGrid
              emptyMessage="No saved teams yet. Create one to get started."
              renderActions={(entry) => (
                <GlassButton onClick={() => setEditorTarget(entry)} variant="secondary" className="w-full text-sm">
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </GlassButton>
              )}
            />
          </GlassPanel>
        </main>
      </div>

      {editorTarget !== null && (
        <TeamEditModal entry={editorTarget === "new" ? null : editorTarget} onClose={() => setEditorTarget(null)} />
      )}
    </div>
  );
}
