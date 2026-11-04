import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, PlusCircle, Pencil, Upload } from "lucide-react";
import { SavedTeam, useStore } from "../../store";
import DashboardHeader from "../dashboard/DashboardHeader";
import { Button } from "../control-panel/ui/primitives";
import TeamLibraryGrid from "./TeamLibraryGrid";
import TeamEditModal from "./TeamEditModal";
import TeamImportModal from "./TeamImportModal";

export default function TeamManagerPage() {
  const { isViewer, user } = useStore();
  const [editorTarget, setEditorTarget] = useState<SavedTeam | "new" | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Viewers only ever arrive via /share/:shareId links, never here — theoretical guard.
  if (isViewer || !user) return null;

  return (
    <div className="ui relative min-h-screen bg-canvas">
      <div className="relative z-10 flex flex-col min-h-screen">
        <DashboardHeader />

        <main className="flex-1 min-w-0 p-3 sm:p-6 max-w-5xl mx-auto w-full flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors mb-2">
                <ArrowLeft size={14} /> Back to Dashboard
              </Link>
              <h1 className="text-[1.75rem] leading-[1.2] font-semibold">Team library</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setIsImportOpen(true)}>
                <Upload size={16} />
                Import teams
              </Button>
              <Button onClick={() => setEditorTarget("new")} variant="primary">
                <PlusCircle size={16} />
                Create new team
              </Button>
            </div>
          </div>

          <TeamLibraryGrid
              emptyMessage="No saved teams yet. Create one to get started."
              renderActions={(entry) => (
                <Button onClick={() => setEditorTarget(entry)} variant="secondary" className="w-full text-sm">
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
              )}
            />
        </main>
      </div>

      {isImportOpen && <TeamImportModal onClose={() => setIsImportOpen(false)} />}

      {editorTarget !== null && (
        <TeamEditModal entry={editorTarget === "new" ? null : editorTarget} onClose={() => setEditorTarget(null)} />
      )}
    </div>
  );
}
