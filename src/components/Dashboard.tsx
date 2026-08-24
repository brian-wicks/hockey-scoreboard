import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { PlusCircle, Users2 } from "lucide-react";
import { useStore } from "../store";
import DashboardHeader from "./dashboard/DashboardHeader";
import DashboardHero from "./dashboard/DashboardHero";
import SavedGamesList from "./game/SavedGamesList";
import NewGameWizard from "./new-game/NewGameWizard";
import { GlassButton } from "./control-panel/ui/glass";

export default function Dashboard() {
  const navigate = useNavigate();
  const { isViewer, user, ensureInitialized } = useStore();
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  ensureInitialized();

  // Viewers only ever arrive via /share/:shareId links, never here — theoretical guard.
  if (isViewer || !user) return null;

  return (
    <div className="relative min-h-screen text-zinc-100 font-sans">
      <div className="control-panel-ambient-bg" />
      <div className="relative z-10 flex flex-col min-h-screen">
        <DashboardHeader />

        <main className="flex-1 min-w-0 p-3 sm:p-6 max-w-3xl mx-auto w-full flex flex-col gap-6">
          <DashboardHero />

          <div className="flex flex-col sm:flex-row gap-3">
            <GlassButton onClick={() => setIsWizardOpen(true)} variant="primary" className="flex-1 py-3">
              <PlusCircle size={18} />
              New Game
            </GlassButton>
            <Link to="/teams" className="flex-1">
              <GlassButton variant="secondary" className="w-full py-3">
                <Users2 size={18} />
                Manage Teams
              </GlassButton>
            </Link>
          </div>

          <SavedGamesList onOpened={() => navigate("/game")} />
        </main>
      </div>

      <NewGameWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onStarted={() => {
          setIsWizardOpen(false);
          navigate("/game");
        }}
      />
    </div>
  );
}
