import { useState, useEffect, useRef } from "react";
import { Share2, Copy, Check, ExternalLink, X, QrCode, AlertTriangle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useStore } from "../../store";
import { GlassButton } from "./ui/glass";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const [shareId, setShareId] = useState<string | null>(null);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const hasLoadedShareRef = useRef(false);

  // @ts-ignore
  const baseUrl = (import.meta.env.VITE_BASE_URL || window.location.origin).replace(/\/+$/, "");

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

  const handleCopyLink = (path: string) => {
    const fullUrl = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(path);
    setTimeout(() => setCopiedLink(null), 2000);
  };

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
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-2xl bg-zinc-950/90 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in duration-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Share2 className="text-indigo-400" size={24} />
            Share Scoreboard
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {!shareId ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto">
                <Share2 size={32} className="text-indigo-400" />
              </div>
              <div className="max-w-xs mx-auto">
                <p className="text-zinc-300 font-medium">No share link generated yet.</p>
                <p className="text-sm text-zinc-500 mt-1">Generate a unique ID to share your live scoreboard with others.</p>
              </div>
              <GlassButton
                onClick={handleGenerateShare}
                disabled={isGeneratingShare}
                variant="primary"
                className="mt-4 px-6 py-2.5 mx-auto"
              >
                {isGeneratingShare ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Share2 size={18} />
                )}
                Generate Public Share Link
              </GlassButton>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-amber-900/20 border border-amber-900/30 rounded-xl p-4 flex gap-3">
                <div className="text-amber-500 pt-0.5">
                  <AlertTriangle size={18} />
                </div>
                <p className="text-sm text-amber-200/80 leading-relaxed italic">
                  Anyone with these links can view your live scoreboard and jumbotron without logging in. They <span className="text-amber-400 font-semibold underline decoration-amber-400/30">cannot</span> control the game or change settings.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Control Panel", path: `/share/${shareId}`, desc: "Full control panel view" },
                  { label: "Public Overlay", path: `/share/${shareId}/overlay`, desc: "Stream-ready graphic" },
                  { label: "Public Jumbotron", path: `/share/${shareId}/jumbotron`, desc: "Arena-style display" },
                ].map((link) => (
                  <div key={link.path} className="group bg-white/[0.04] border border-white/10 hover:border-white/20 rounded-xl p-4 flex flex-col gap-3 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-zinc-100">{link.label}</span>
                      <a
                        href={link.path}
                        target="_blank"
                        rel="noreferrer"
                        className="text-zinc-500 hover:text-indigo-400 transition-colors"
                        title="Open in new tab"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                    
                    <p className="text-[11px] text-zinc-500 -mt-2">{link.desc}</p>

                    <div className="flex justify-center py-2">
                      <div className="bg-white p-2 rounded-xl shadow-lg shadow-white/5 transition-transform group-hover:scale-105">
                        <QRCodeSVG 
                          value={`${window.location.origin}${link.path}`}
                          size={110}
                          level="M"
                          includeMargin={false}
                        />
                      </div>
                    </div>

                    <div className="flex items-start gap-2 bg-white/[0.05] border border-white/10 rounded-lg px-2.5 py-2">
                      <code className="text-[10px] text-zinc-400 break-all flex-1 font-mono leading-relaxed">
                        {window.location.origin}{link.path}
                      </code>
                      <button
                        onClick={() => handleCopyLink(link.path)}
                        className="text-zinc-400 hover:text-white transition-colors p-1 shrink-0"
                        title="Copy to clipboard"
                      >
                        {copiedLink === link.path ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-white/10">
                <p className="text-[11px] text-zinc-500">Share ID: <span className="font-mono text-zinc-400">{shareId}</span></p>
                <button
                  onClick={handleGenerateShare}
                  disabled={isGeneratingShare}
                  className="text-xs text-zinc-500 hover:text-zinc-300 underline transition-colors decoration-zinc-700 underline-offset-4"
                >
                  Regenerate New Link
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
