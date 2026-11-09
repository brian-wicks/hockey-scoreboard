import { useState, useEffect, useRef } from "react";
import { Share2, X } from "lucide-react";
import { useStore } from "../../store";
import { getBaseUrl } from "../../lib/localMode";
import { isValidShareName, normalizeShareName } from "../../lib/shareNames";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { Button, inputClass } from "./ui/primitives";
import ShareLinkRow from "./ShareLinkRow";
import SecondOperatorSection from "./SecondOperatorSection";

const RANDOM_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const INVALID_NAME_ERROR = "Use 4 to 40 letters, numbers and hyphens.";
const SAVE_NAME_ERROR = "Couldn't save the link name. Check your connection and try again.";

/** What the name box shows for a share ID: a random one isn't a name anyone chose. */
const nameForShareId = (shareId: string) => (RANDOM_ID_PATTERN.test(shareId) ? "" : shareId);

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const [shareId, setShareIdState] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [isConfirmingName, setIsConfirmingName] = useState(false);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const hasLoadedShareRef = useRef(false);

  // @ts-ignore
  const baseUrl = getBaseUrl().replace(/\/+$/, "");

  const setShareId = (id: string) => {
    setShareIdState(id);
    setNameInput(nameForShareId(id));
    setNameError(null);
  };

  const loadShareId = async () => {
    const { user } = useStore.getState();
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${baseUrl}/api/share`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.shareId) setShareId(data.shareId);
      }
    } catch (error) {
      console.error("Failed to load share ID:", error);
    }
  };

  const handleGenerateShare = async () => {
    const { user } = useStore.getState();
    if (!user) return;
    setIsGeneratingShare(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${baseUrl}/api/share`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.shareId) setShareId(data.shareId);
      }
    } catch (error) {
      console.error("Failed to generate share ID:", error);
    } finally {
      setIsGeneratingShare(false);
    }
  };

  const claimName = async (name: string) => {
    const { user } = useStore.getState();
    if (!user) return;
    setIsConfirmingName(false);
    setIsGeneratingShare(true);
    setNameError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${baseUrl}/api/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ shareId: name }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.shareId) {
        setShareId(data.shareId);
      } else {
        setNameError(data.error || SAVE_NAME_ERROR);
      }
    } catch (error) {
      console.error("Failed to save link name:", error);
      setNameError(SAVE_NAME_ERROR);
    } finally {
      setIsGeneratingShare(false);
    }
  };

  const typedName = normalizeShareName(nameInput);

  const createLinks = () => {
    if (!typedName) {
      void handleGenerateShare();
    } else if (isValidShareName(typedName)) {
      void claimName(typedName);
    } else {
      setNameError(INVALID_NAME_ERROR);
    }
  };

  const saveName = () => {
    if (isValidShareName(typedName)) {
      setNameError(null);
      setIsConfirmingName(true);
    } else {
      setNameError(INVALID_NAME_ERROR);
    }
  };

  const nameField = (
    <div className="text-left">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="share-link-name" className="text-sm font-semibold text-ink">
          Link name
        </label>
        {shareId && (
          <button
            onClick={handleGenerateShare}
            disabled={isGeneratingShare}
            className="text-xs text-muted hover:text-ink underline transition-colors decoration-zinc-700 underline-offset-4"
          >
            Replace with new links
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <input
          id="share-link-name"
          type="text"
          value={nameInput}
          onChange={(event) => {
            setNameInput(event.target.value);
            setNameError(null);
          }}
          placeholder="newcastle-wildcats"
          autoCapitalize="none"
          spellCheck={false}
          className={`${inputClass} flex-1 min-w-48`}
        />
        {shareId && (
          <Button onClick={saveName} disabled={isGeneratingShare || !typedName || typedName === shareId} variant="secondary">
            Save name
          </Button>
        )}
      </div>
      {nameError && <p className="text-sm text-danger mt-1">{nameError}</p>}
      <p className="text-xs text-muted mt-1">
        Optional. Anyone who guesses the name can view these screens.
      </p>
    </div>
  );

  useEffect(() => {
    if (isOpen && !hasLoadedShareRef.current) {
      hasLoadedShareRef.current = true;
      void loadShareId();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-ink/60 duration-200"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-2xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] overflow-y-auto bg-canvas border border-line rounded-sm duration-200">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-line">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-ink">
            <Share2 className="text-ink" size={24} />
            Share scoreboard
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-muted hover:text-ink hover:bg-surface rounded-sm transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-ink">Viewer links</h3>
              <p className="text-sm text-muted mt-1">
                {shareId
                  ? "Anyone with a link can view these screens, but can't change anything."
                  : "No share links yet."}
              </p>
            </div>

            {shareId && (
              <div className="space-y-2">
                {[
                  { label: "Overlay", path: `/share/${shareId}/overlay` },
                  { label: "Jumbotron", path: `/share/${shareId}/jumbotron` },
                  { label: "Pre-show", path: `/share/${shareId}/preshow` },
                  { label: "Results", path: `/share/${shareId}/results` },
                ].map((link) => (
                  <ShareLinkRow key={link.path} label={link.label} url={`${window.location.origin}${link.path}`} />
                ))}
              </div>
            )}

            {nameField}

            {!shareId && (
              <Button onClick={createLinks} disabled={isGeneratingShare} variant="primary">
                {isGeneratingShare ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Share2 size={16} />
                )}
                Create share links
              </Button>
            )}
          </section>

          <SecondOperatorSection />
        </div>
      </div>

      <ConfirmDialog
        open={isConfirmingName}
        title="Change the link name?"
        message="Links using the current name stop working, including any OBS sources set up with them."
        confirmLabel="Change name"
        onConfirm={() => void claimName(typedName)}
        onCancel={() => setIsConfirmingName(false)}
      />
    </div>
  );
}
