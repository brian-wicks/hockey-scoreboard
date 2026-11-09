import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, UserPlus } from "lucide-react";
import { getBaseUrl, isLocalMode } from "../../lib/localMode";
import { useStore } from "../../store";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { Button } from "./ui/primitives";
import ShareLinkRow from "./ShareLinkRow";

const CHANGE_ERROR = "Couldn't update second operator access. Check your connection and try again.";
const LOAD_ERROR = "Couldn't load second operator access. Check your connection and reopen this window.";

export default function SecondOperatorSection() {
  const localMode = isLocalMode();
  const [operatorId, setOperatorId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [needsPin, setNeedsPin] = useState(false);
  const [pin, setPin] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"new-pin" | "remove" | null>(null);

  const request = async (method: "GET" | "POST" | "DELETE") => {
    const { user } = useStore.getState();
    if (!user) throw new Error("Not signed in");
    const token = await user.getIdToken();
    const baseUrl = getBaseUrl().replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/api/operator-access`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Operator access request failed: ${response.status}`);
    return response.json();
  };

  useEffect(() => {
    if (localMode) return;
    request("GET")
      .then((data) => {
        setOperatorId(data.operatorId ?? null);
        setNeedsPin(data.needsPin === true);
        setPin(data.pin ?? null);
        setLoaded(true);
      })
      .catch((loadError) => {
        console.error("Failed to load operator access:", loadError);
        setError(LOAD_ERROR);
      });
  }, [localMode]);

  const createPin = async () => {
    setConfirming(null);
    setIsBusy(true);
    setError(null);
    try {
      const data = await request("POST");
      setOperatorId(data.operatorId);
      setPin(data.pin);
      setNeedsPin(false);
    } catch (changeError) {
      console.error("Failed to create operator PIN:", changeError);
      setError(CHANGE_ERROR);
    } finally {
      setIsBusy(false);
    }
  };

  const removeAccess = async () => {
    setConfirming(null);
    setIsBusy(true);
    setError(null);
    try {
      await request("DELETE");
      setOperatorId(null);
      setPin(null);
      setNeedsPin(false);
    } catch (changeError) {
      console.error("Failed to remove operator access:", changeError);
      setError(CHANGE_ERROR);
    } finally {
      setIsBusy(false);
    }
  };

  if (localMode) return null;

  const link = operatorId ? `${window.location.origin}/operate/${operatorId}` : null;
  const showNoPin = needsPin && !pin;

  return (
    <section className="mt-6 pt-6 border-t border-line space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">Second operator</h3>
        <p className="text-sm text-muted mt-1">
          {showNoPin
            ? "This game has no PIN yet. Create one and give it to the second operator."
            : link
              ? "Anyone with the link and PIN can change the live game. Send them separately."
              : loaded
                ? "Give one other person the Controls and Deck tabs for your live game. They need a link and a PIN."
                : error
                  ? null
                  : "Loading second operator access..."}
        </p>
      </div>

      {error && (
        <p className="text-sm text-danger flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </p>
      )}

      {!link && loaded && (
        <Button onClick={createPin} disabled={isBusy} variant="primary">
          <UserPlus size={16} />
          Set up second operator
        </Button>
      )}
      {link && (
        <>
          <ShareLinkRow label="Second operator link" url={link} />
          {pin && (
            <div className="flex items-baseline gap-3 px-3">
              <span className="text-sm font-semibold text-ink">PIN</span>
              <span className="text-2xl font-semibold text-ink tabular-nums tracking-widest">{pin}</span>
            </div>
          )}
          {!pin && !needsPin && (
            <p className="text-sm text-muted">
              This PIN can't be shown because it was created before PINs were saved here. Create a new one to see it.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {/* With no PIN, nobody can be signed in, so there's nothing to confirm. */}
            <Button onClick={() => (showNoPin ? void createPin() : setConfirming("new-pin"))} disabled={isBusy} variant="secondary">
              Create new PIN
            </Button>
            <Button onClick={() => setConfirming("remove")} disabled={isBusy} variant="secondary">
              Remove access
            </Button>
          </div>
        </>
      )}

      {/* Portalled because ConfirmDialog must render outside the modal's scrolling panel. */}
      {createPortal(
        <>
          <ConfirmDialog
            open={confirming === "new-pin"}
            title="Create a new PIN?"
            message="The second operator is signed out and needs the new PIN to get back in. The link stays the same."
            confirmLabel="Create new PIN"
            onConfirm={createPin}
            onCancel={() => setConfirming(null)}
          />
          <ConfirmDialog
            open={confirming === "remove"}
            title="Remove second operator access?"
            message="The second operator is signed out and this link stops working."
            confirmLabel="Remove access"
            onConfirm={removeAccess}
            onCancel={() => setConfirming(null)}
          />
        </>,
        document.body,
      )}
    </section>
  );
}
