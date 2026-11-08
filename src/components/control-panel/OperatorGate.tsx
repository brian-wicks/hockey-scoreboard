import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { OPERATOR_PIN_LENGTH } from "../../lib/operatorAccess";
import { useStore, type OperatorAuth } from "../../store";
import { Button, Wordmark, inputClass } from "./ui/primitives";

const SCREEN_CLASS = "ui min-h-screen bg-canvas flex items-center justify-center p-4";
const CARD_CLASS = "w-full max-w-md bg-canvas border border-line rounded-sm p-8 space-y-4";

function pinMessage(auth: OperatorAuth): string | null {
  switch (auth.status) {
    case "wrong-pin":
      return `That PIN is wrong. ${auth.attemptsLeft} ${auth.attemptsLeft === 1 ? "attempt" : "attempts"} left.`;
    case "locked": {
      const minutes = Math.ceil(auth.retryAfterSeconds / 60);
      return `Too many wrong PINs. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
    }
    case "error":
      return "Couldn't check the PIN. Try again in a moment.";
    case "needs-pin":
      return auth.sessionEnded ? "Your session ended. Enter the current PIN to continue." : null;
    default:
      return null;
  }
}

function PinForm({ auth }: { auth: OperatorAuth }) {
  const submitOperatorPin = useStore((state) => state.submitOperatorPin);
  const [pin, setPin] = useState("");
  const isSubmitting = auth.status === "submitting";
  const message = pinMessage(auth);

  useEffect(() => {
    if (auth.status === "wrong-pin") setPin("");
  }, [auth]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (pin.length === OPERATOR_PIN_LENGTH && !isSubmitting) void submitOperatorPin(pin);
  };

  return (
    <div className={SCREEN_CLASS}>
      <form onSubmit={handleSubmit} className={CARD_CLASS}>
        <Wordmark />
        <div>
          <h1 className="text-xl font-semibold text-ink">Enter the PIN</h1>
          <p className="text-sm text-muted mt-1">Ask the main operator for the six-digit PIN.</p>
        </div>
        {message && (
          <p role="alert" className="text-sm text-danger flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{message}</span>
          </p>
        )}
        <div>
          <label htmlFor="operator-pin" className="text-sm font-semibold text-ink">
            PIN
          </label>
          <input
            id="operator-pin"
            className={`${inputClass} mt-1 w-full text-center text-2xl tabular-nums tracking-widest`}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, OPERATOR_PIN_LENGTH))}
          />
        </div>
        <Button type="submit" variant="primary" className="w-full" disabled={pin.length !== OPERATOR_PIN_LENGTH || isSubmitting}>
          Continue
        </Button>
      </form>
    </div>
  );
}

function Message({ title, detail }: { title: string; detail: string }) {
  return (
    <div className={SCREEN_CLASS}>
      <div className={CARD_CLASS}>
        <Wordmark />
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        <p className="text-sm text-muted">{detail}</p>
      </div>
    </div>
  );
}

export default function OperatorGate({ children }: { children: ReactNode }) {
  const auth = useStore((state) => state.operatorAuth);
  const hasGameState = useStore((state) => state.gameState !== null);
  const activeGameId = useStore((state) => state.activeGameId);

  if (auth.status === "not-found") {
    return <Message title="This link is no longer active" detail="Ask the main operator for a new second operator link." />;
  }

  const isConnecting =
    auth.status === "connecting" || (auth.status === "connected" && (!hasGameState || activeGameId === undefined));
  if (isConnecting) {
    return (
      <div className={SCREEN_CLASS}>
        <p className="text-muted">Connecting...</p>
      </div>
    );
  }

  if (auth.status === "connected") {
    if (activeGameId === null) {
      return (
        <Message
          title="Waiting for a game to start"
          detail="The controls will appear here when the main operator opens a game."
        />
      );
    }
    return <>{children}</>;
  }

  return <PinForm auth={auth} />;
}
