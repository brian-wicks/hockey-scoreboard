import { useState } from "react";
import type { KeyboardEvent } from "react";
import { X } from "lucide-react";
import { KeyboardShortcut } from "../../store";

interface ShortcutEditorProps {
  shortcut: KeyboardShortcut;
  onUpdate: (shortcut: KeyboardShortcut) => void;
}

export default function ShortcutEditor({ shortcut, onUpdate }: ShortcutEditorProps) {
  const [isRecording, setIsRecording] = useState(false);

  const handleCaptureKey = (e: KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
      return;
    }

    const key = e.key === " " ? " " : e.key.length === 1 ? e.key.toLowerCase() : e.key;

    onUpdate({
      ...shortcut,
      key,
      ctrl: e.ctrlKey,
      shift: e.shiftKey,
      alt: e.altKey,
    });

    setIsRecording(false);
  };

  const formatKey = (shortcutToFormat: KeyboardShortcut) => {
    const parts: string[] = [];
    if (shortcutToFormat.ctrl) parts.push("Ctrl");
    if (shortcutToFormat.alt) parts.push("Alt");
    if (shortcutToFormat.shift) parts.push("Shift");

    const keyName =
      shortcutToFormat.key === " "
        ? "Space"
        : shortcutToFormat.key === "ArrowUp"
          ? "\u2191"
          : shortcutToFormat.key === "ArrowDown"
            ? "\u2193"
            : shortcutToFormat.key === "ArrowLeft"
              ? "\u2190"
              : shortcutToFormat.key === "ArrowRight"
                ? "\u2192"
                : shortcutToFormat.key.toUpperCase();

    parts.push(keyName);
    return parts.join(" + ");
  };

  return (
    <div className="flex items-center justify-between bg-zinc-950 p-3 rounded-lg border border-zinc-800">
      <span className="text-zinc-300 flex-1">{shortcut.description}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsRecording(true)}
          className={`px-4 py-2 rounded-lg text-sm font-mono transition-colors ${
            isRecording ? "bg-indigo-600 text-white animate-pulse" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
          }`}
        >
          {isRecording ? "Press any key..." : formatKey(shortcut)}
        </button>
        {isRecording && (
          <input
            autoFocus
            aria-hidden="true"
            className="absolute opacity-0 pointer-events-none"
            onKeyDown={handleCaptureKey}
            onBlur={() => setIsRecording(false)}
          />
        )}
        {isRecording && (
          <button
            onClick={() => setIsRecording(false)}
            className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
