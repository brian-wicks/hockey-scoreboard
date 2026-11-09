import { useState } from "react";
import { Check, Copy, ExternalLink, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

const ICON_BUTTON_CLASS = "text-muted hover:text-ink hover:bg-surface transition-colors p-1.5 rounded-sm shrink-0";

/** One share link on a single line, with its QR code shown on request. */
export default function ShareLinkRow({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const copyLink = () => {
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-line rounded-sm">
      <div className="flex items-center gap-1 px-3 py-2">
        <div className="flex-1 min-w-0 mr-2">
          <p className="text-sm font-semibold text-ink">{label}</p>
          <code className="block text-xs text-muted truncate" title={url}>
            {url}
          </code>
        </div>
        <button
          onClick={() => setShowQr(!showQr)}
          className={ICON_BUTTON_CLASS}
          aria-label={`QR code for ${label}`}
          aria-expanded={showQr}
          title="Show QR code"
        >
          <QrCode size={16} />
        </button>
        <button onClick={copyLink} className={ICON_BUTTON_CLASS} aria-label={`Copy ${label}`} title="Copy link">
          {copied ? <Check size={16} className="text-ink" /> : <Copy size={16} />}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={ICON_BUTTON_CLASS}
          aria-label={`Open ${label} in a new tab`}
          title="Open in new tab"
        >
          <ExternalLink size={16} />
        </a>
      </div>
      {showQr && (
        <div className="flex justify-center pb-3">
          <div className="bg-white p-2 rounded-sm">
            <QRCodeSVG value={url} size={140} level="M" includeMargin={false} />
          </div>
        </div>
      )}
    </div>
  );
}
