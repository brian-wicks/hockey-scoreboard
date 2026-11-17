import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Wifi } from "lucide-react";
import { getBaseUrl } from "../../lib/localMode";
import { useStore } from "../../store";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { Button, inputClass } from "./ui/primitives";

const LOAD_ERROR = "Couldn't check network access. Reopen this window to try again.";
const CHANGE_ERROR = "Couldn't change network access. Try again, or restart the app.";

interface NetworkStatus {
  enabled: boolean;
  port: number | null;
  urls: string[];
}

export interface LocalNetwork {
  loaded: boolean;
  enabled: boolean;
  urls: string[];
  /** The address other devices use, as an origin like http://192.168.1.20:3696. */
  address: string | null;
  setAddress: (url: string) => void;
  busy: boolean;
  error: string | null;
  setEnabled: (enabled: boolean) => Promise<void>;
}

/** Network access in the desktop app (see src/server/localNetwork.ts). Does nothing when `active` is false. */
export function useLocalNetwork(active: boolean): LocalNetwork {
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async (method: "GET" | "POST", enabled?: boolean): Promise<NetworkStatus> => {
    const { user } = useStore.getState();
    if (!user) throw new Error("Not signed in");
    const token = await user.getIdToken();
    const baseUrl = getBaseUrl().replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/api/local-network`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
      ...(method === "POST" ? { body: JSON.stringify({ enabled }) } : {}),
    });
    if (!response.ok) throw new Error(`Network access request failed: ${response.status}`);
    return response.json();
  };

  useEffect(() => {
    if (!active) return;
    request("GET")
      .then((data) => {
        setStatus(data);
        setError(null);
      })
      .catch((loadError) => {
        console.error("Failed to load network access:", loadError);
        setError(LOAD_ERROR);
      });
  }, [active]);

  const setEnabled = async (enabled: boolean) => {
    setBusy(true);
    setError(null);
    try {
      setStatus(await request("POST", enabled));
    } catch (changeError) {
      console.error("Failed to change network access:", changeError);
      setError(CHANGE_ERROR);
    } finally {
      setBusy(false);
    }
  };

  const urls = status?.enabled ? status.urls : [];
  const address = chosen && urls.includes(chosen) ? chosen : (urls[0] ?? null);

  return {
    loaded: status !== null,
    enabled: status?.enabled === true,
    urls,
    address,
    setAddress: setChosen,
    busy,
    error,
    setEnabled,
  };
}

export default function NetworkAccessSection({ network }: { network: LocalNetwork }) {
  const [confirmingOff, setConfirmingOff] = useState(false);
  const { loaded, enabled, urls, address, busy, error } = network;

  return (
    <section className="mb-6 pb-6 border-b border-line space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">Devices on this network</h3>
        <p className="text-sm text-muted mt-1">
          {enabled
            ? "Tablets and other screens on the same wifi can open the links below. Only this computer can open the control panel."
            : "Turn this on to open share links and the second operator link on a tablet or another screen on the same wifi. Only this computer can open the control panel."}
        </p>
      </div>

      {error && (
        <p className="text-sm text-danger flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </p>
      )}

      {enabled && urls.length === 0 && (
        <p className="text-sm text-ink">
          This computer isn't on a network. Join the rink's wifi or a hotspot, then reopen this window.
        </p>
      )}

      {enabled && urls.length > 1 && (
        <div>
          <label htmlFor="network-address" className="text-sm font-semibold text-ink">
            Address for links
          </label>
          <select
            id="network-address"
            value={address ?? ""}
            onChange={(event) => network.setAddress(event.target.value)}
            className={`${inputClass} block mt-1`}
          >
            {urls.map((url) => (
              <option key={url} value={url}>
                {url.replace(/^http:\/\//, "")}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted mt-1">This computer is on more than one network. Pick the one the tablet is on.</p>
        </div>
      )}

      {enabled && urls.length === 1 && (
        <p className="text-sm text-ink">
          Other devices reach this computer at <code className="font-semibold">{urls[0].replace(/^http:\/\//, "")}</code>.
        </p>
      )}

      {loaded && (
        <Button
          onClick={() => (enabled ? setConfirmingOff(true) : void network.setEnabled(true))}
          disabled={busy}
          variant={enabled ? "secondary" : "primary"}
        >
          <Wifi size={16} />
          {enabled ? "Turn off network access" : "Turn on network access"}
        </Button>
      )}

      {enabled && (
        <p className="text-xs text-muted">
          The first time, your computer may ask whether to allow incoming connections. Choose Allow. If a tablet still
          can't connect, the wifi may stop devices reaching each other. Use a phone hotspot or a travel router instead.
        </p>
      )}

      {/* Portalled because ConfirmDialog must render outside the modal's scrolling panel. */}
      {createPortal(
        <ConfirmDialog
          open={confirmingOff}
          title="Turn off network access?"
          message="Screens and second operators on other devices lose their connection straight away."
          confirmLabel="Turn off"
          onConfirm={() => {
            setConfirmingOff(false);
            void network.setEnabled(false);
          }}
          onCancel={() => setConfirmingOff(false)}
        />,
        document.body,
      )}
    </section>
  );
}
