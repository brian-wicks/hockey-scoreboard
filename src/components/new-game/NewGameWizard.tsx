import { useEffect, useState } from "react";
import { X, PlayCircle } from "lucide-react";
import { TeamState, useStore } from "../../store";
import { isGameInProgress } from "../../utils/gameProgress";
import InProgressGate from "./InProgressGate";
import TeamSelectStep, { TeamDraft } from "./TeamSelectStep";
import ReviewStep from "./ReviewStep";

interface NewGameWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onStarted: () => void;
}

type WizardStep = "gate" | "home" | "away" | "review";

const EMPTY_DRAFT: TeamDraft = { source: "new", identity: { name: "", abbreviation: "", logo: "", color: "#3b82f6" }, players: [] };

function draftToTeamState(draft: TeamDraft): TeamState {
  return {
    name: draft.identity.name,
    abbreviation: draft.identity.abbreviation,
    logo: draft.identity.logo,
    color: draft.identity.color,
    players: draft.players,
    score: 0,
    shots: 0,
    timeouts: 1,
    penalties: [],
  };
}

export default function NewGameWizard({ isOpen, onClose, onStarted }: NewGameWizardProps) {
  const { gameState, resetGame, startNewGame, saveGame, saveTeamToLibrary } = useStore();
  const [step, setStep] = useState<WizardStep>("gate");
  const [homeDraft, setHomeDraft] = useState<TeamDraft>(EMPTY_DRAFT);
  const [awayDraft, setAwayDraft] = useState<TeamDraft>(EMPTY_DRAFT);
  const [saveHomeToLibrary, setSaveHomeToLibrary] = useState(true);
  const [saveAwayToLibrary, setSaveAwayToLibrary] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!isOpen || !gameState) return;
    setStep(isGameInProgress(gameState) ? "gate" : "home");
    setHomeDraft(EMPTY_DRAFT);
    setAwayDraft(EMPTY_DRAFT);
    setSaveHomeToLibrary(true);
    setSaveAwayToLibrary(true);
    setStarting(false);
  }, [isOpen, gameState]);

  if (!isOpen || !gameState) return null;

  const cameFromGate = isGameInProgress(gameState);

  const handleQuickStart = () => {
    resetGame();
    onStarted();
  };

  const handleSaveAndContinue = async (name: string) => {
    await saveGame(name);
    setStep("home");
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      if (homeDraft.source === "new" && saveHomeToLibrary && homeDraft.identity.name.trim()) {
        await saveTeamToLibrary(homeDraft.identity.name.trim(), { ...homeDraft.identity, players: homeDraft.players });
      }
      if (awayDraft.source === "new" && saveAwayToLibrary && awayDraft.identity.name.trim()) {
        await saveTeamToLibrary(awayDraft.identity.name.trim(), { ...awayDraft.identity, players: awayDraft.players });
      }
      startNewGame(draftToTeamState(homeDraft), draftToTeamState(awayDraft));
      onStarted();
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* No backdrop-click-to-close here — this is a multi-step form, and an accidental
       * click outside shouldn't silently discard progress the way it's fine to for the
       * single-screen ShareModal. */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" />

      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-950/90 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in duration-200">
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b border-white/10 bg-zinc-950 backdrop-blur-2xl">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <PlayCircle className="text-indigo-400" size={24} />
            New Game
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {step === "gate" && (
            <InProgressGate
              gameState={gameState}
              onSaveAndContinue={handleSaveAndContinue}
              onDiscardContinue={() => setStep("home")}
              onQuickStart={handleQuickStart}
              onCancel={onClose}
            />
          )}
          {step === "home" && (
            <TeamSelectStep
              side="home"
              onConfirm={(draft) => {
                setHomeDraft(draft);
                setStep("away");
              }}
              onBack={cameFromGate ? () => setStep("gate") : undefined}
            />
          )}
          {step === "away" && (
            <TeamSelectStep
              side="away"
              onConfirm={(draft) => {
                setAwayDraft(draft);
                setStep("review");
              }}
              onBack={() => setStep("home")}
              otherSelection={{ label: "Home", draft: homeDraft }}
            />
          )}
          {step === "review" && (
            <ReviewStep
              homeDraft={homeDraft}
              awayDraft={awayDraft}
              saveHomeToLibrary={saveHomeToLibrary}
              saveAwayToLibrary={saveAwayToLibrary}
              onToggleSaveHome={setSaveHomeToLibrary}
              onToggleSaveAway={setSaveAwayToLibrary}
              onBack={() => setStep("away")}
              onStart={handleStart}
              starting={starting}
            />
          )}
        </div>
      </div>
    </div>
  );
}
