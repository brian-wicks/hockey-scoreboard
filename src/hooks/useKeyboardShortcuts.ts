import { useEffect } from "react";
import { useStore } from "../store";

export function useKeyboardShortcuts(isActive: boolean) {
  const { gameState, startClock, stopClock, clockIncrease, clockDecrease, updateState, keyboardShortcuts } = useStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger shortcuts when the controls tab is active
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

          switch (shortcut.action) {
            case "toggleClock":
              if (gameState.clock.isRunning) {
                stopClock();
              } else {
                startClock();
              }
              break;
            case "clockIncrease":
              clockIncrease();
              break;
            case "clockDecrease":
              clockDecrease();
              break;
            case "homeScoreUp":
              updateState({
                homeTeam: { ...gameState.homeTeam, score: gameState.homeTeam.score + 1 },
              });
              break;
            case "awayScoreUp":
              updateState({
                awayTeam: { ...gameState.awayTeam, score: gameState.awayTeam.score + 1 },
              });
              break;
            case "homeShotsUp":
              updateState({
                homeTeam: { ...gameState.homeTeam, shots: gameState.homeTeam.shots + 1 },
              });
              break;
            case "awayShotsUp":
              updateState({
                awayTeam: { ...gameState.awayTeam, shots: gameState.awayTeam.shots + 1 },
              });
              break;
            case "homeScoreDown":
              updateState({
                homeTeam: { ...gameState.homeTeam, score: Math.max(0, gameState.homeTeam.score - 1) },
              });
              break;
            case "awayScoreDown":
              updateState({
                awayTeam: { ...gameState.awayTeam, score: Math.max(0, gameState.awayTeam.score - 1) },
              });
              break;
            case "homeShotsDown":
              updateState({
                homeTeam: { ...gameState.homeTeam, shots: Math.max(0, gameState.homeTeam.shots - 1) },
              });
              break;
            case "awayShotsDown":
              updateState({
                awayTeam: { ...gameState.awayTeam, shots: Math.max(0, gameState.awayTeam.shots - 1) },
              });
              break;
          }

          break; // Only trigger the first matching shortcut
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, gameState, startClock, stopClock, updateState, keyboardShortcuts]);
}
