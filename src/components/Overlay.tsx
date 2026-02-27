import { useEffect, useState } from "react";
import { useStore } from "../store";

export default function Overlay() {
  const { gameState, connect } = useStore();
  const [displayTime, setDisplayTime] = useState("20:00");

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (!gameState) return;
    
    let animationFrameId: number;
    const updateDisplay = () => {
      let currentRemaining = gameState.clock.timeRemaining;
      if (gameState.clock.isRunning) {
        const elapsed = Date.now() - gameState.clock.lastUpdate;
        currentRemaining = Math.max(0, gameState.clock.timeRemaining - elapsed);
      }
      
      const totalSeconds = Math.ceil(currentRemaining / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      
      if (currentRemaining <= 60000 && currentRemaining > 0) {
        const tenths = Math.floor((currentRemaining % 1000) / 100);
        setDisplayTime(`${seconds}.${tenths}`);
      } else {
        setDisplayTime(`${minutes}:${seconds.toString().padStart(2, "0")}`);
      }
      
      if (gameState.clock.isRunning) {
        animationFrameId = requestAnimationFrame(updateDisplay);
      }
    };

    updateDisplay();
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState?.clock.isRunning, gameState?.clock.timeRemaining, gameState?.clock.lastUpdate]);

  if (!gameState) return null;

  const { homeTeam, awayTeam, period } = gameState;

  return (
    <div className="w-screen h-screen overflow-hidden bg-transparent font-sans text-white">
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-stretch gap-1">
        <div className="px-4 py-1 rounded-md border border-white/10 bg-black/75 backdrop-blur-md flex items-center gap-4">
          <span className="w-10 text-right font-mono text-lg font-bold">{homeTeam.shots}</span>
          <span className="flex-1 text-center text-xs font-bold tracking-[0.2em] uppercase text-zinc-300">Shots</span>
          <span className="w-10 text-left font-mono text-lg font-bold">{awayTeam.shots}</span>
        </div>

        {/* Scoreboard Bug - Top Center */}
        <div className="flex items-stretch shadow-2xl rounded-lg overflow-hidden border border-white/10 backdrop-blur-md bg-black/80">
          
          {/* Home Team */}
          <div className="flex flex-col">
            <div className="flex items-center h-14">
              <div 
                className="w-2 h-full" 
                style={{ backgroundColor: homeTeam.color }} 
              />
              {homeTeam.logo && (
                <div className="pl-3 flex items-center justify-center">
                  <img src={homeTeam.logo} alt={homeTeam.abbreviation} className="h-8 w-8 object-contain" />
                </div>
              )}
              <div className="px-4 font-bold text-2xl tracking-wider w-24 text-center">
                {homeTeam.abbreviation}
              </div>
              <div className="px-4 bg-white/10 h-full flex items-center justify-center font-mono text-3xl font-bold w-16">
                {homeTeam.score}
              </div>
            </div>
            
            {/* Home Penalties */}
            {homeTeam.penalties.length > 0 && (
              <div className="flex flex-col bg-red-600/90 text-xs font-mono font-bold">
                {homeTeam.penalties.map((p) => (
                  <PenaltyTimer key={p.id} penalty={p} clock={gameState.clock} />
                ))}
              </div>
            )}
          </div>

          {/* Center Clock & Period */}
          <div className="flex flex-col items-center justify-center px-6 bg-black/50 min-w-35 border-x border-white/10">
            <div className="text-3xl font-mono font-bold tracking-tighter text-yellow-400">
              {displayTime}
            </div>
            <div className="text-xs font-bold tracking-widest text-zinc-400 uppercase mt-1">
              {period}
            </div>
          </div>

          {/* Away Team */}
          <div className="flex flex-col">
            <div className="flex items-center h-14">
              <div className="px-4 bg-white/10 h-full flex items-center justify-center font-mono text-3xl font-bold w-16">
                {awayTeam.score}
              </div>
              <div className="px-4 font-bold text-2xl tracking-wider w-24 text-center">
                {awayTeam.abbreviation}
              </div>
              {awayTeam.logo && (
                <div className="pr-3 flex items-center justify-center">
                  <img src={awayTeam.logo} alt={awayTeam.abbreviation} className="h-8 w-8 object-contain" />
                </div>
              )}
              <div 
                className="w-2 h-full" 
                style={{ backgroundColor: awayTeam.color }} 
              />
            </div>
            
            {/* Away Penalties */}
            {awayTeam.penalties.length > 0 && (
              <div className="flex flex-col bg-red-600/90 text-xs font-mono font-bold">
                {awayTeam.penalties.map((p) => (
                  <PenaltyTimer key={p.id} penalty={p} clock={gameState.clock} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PenaltyTimer({ penalty }: any) {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    const totalSeconds = Math.ceil(Math.max(0, penalty.timeRemaining) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const timeDisplay = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    let playerNumber = String(penalty.playerNumber ?? "").trim();
    playerNumber = playerNumber == "00" ? "" : playerNumber;
    setDisplay(playerNumber ? `${playerNumber} - ${timeDisplay}` : timeDisplay);
  }, [penalty.timeRemaining, penalty.playerNumber]);

  return (
    <div className="px-3 py-1 border-t border-white/20 flex justify-center items-center">
      <span>{display}</span>
    </div>
  );
}
