import { useEffect } from "react";
import { useStore } from "../store";
import { useSharedActions } from "./useSharedActions";

export function useKeyboardShortcuts(isActive: boolean) {
  const { gameState, keyboardShortcuts } = useStore();
  const { handleAction } = useSharedActions();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger shortcuts when the controls tab is active or streamdeck is active
      if (!isActive) return;

      // Don't trigger shortcuts if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (!gameState) return;

      // Check each configured shortcut
      for (const shortcut of keyboardShortcuts) {
        const keyMatches = e.key.toLowerCase() === shortcut.key.toLowerCase() ||
                          (e.key === " " && shortcut.key === " ");
        const ctrlMatches = !!shortcut.ctrl === e.ctrlKey;
        const shiftMatches = !!shortcut.shift === e.shiftKey;
        const altMatches = !!shortcut.alt === e.altKey;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
          e.preventDefault();
          handleAction(shortcut.action);
          break; // Only trigger the first matching shortcut
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, gameState, keyboardShortcuts, handleAction]);
}
