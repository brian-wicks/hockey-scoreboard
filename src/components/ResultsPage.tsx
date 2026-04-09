import { type CSSProperties, useEffect } from "react";
import { useStore } from "../store";
const backgroundUrl = new URL("../assets/grunge-navy.jpg", import.meta.url).href;
const buihaLogoUrl = new URL("../assets/buiha-crest.png", import.meta.url).href;
const nuSportLogoUrl = new URL("../assets/team-newcastle.svg", import.meta.url).href;

export default function ResultsPage() {
  const { gameState, connect } = useStore();

  useEffect(() => {
    connect();
  }, [connect]);

  if (!gameState) {
    return <div className="flex items-center justify-center h-screen bg-slate-900 text-white">Connecting...</div>;
  }

  const { homeTeam, awayTeam } = gameState;

  return (
    <div className="results-page" style={{ "--results-bg": `url('${backgroundUrl}')` } as CSSProperties}>
      <div className="results-corner-logo left">
        <img src={buihaLogoUrl} alt="BUIHA" />
      </div>
      <div className="results-corner-logo right">
        <img src={nuSportLogoUrl} alt="Newcastle University Sport" />
      </div>
      <div className="results-header">
        <span className="results-title">Results</span>
      </div>

      <div className="results-body">
        <div className="results-team">
          <div className="results-logo">
            {homeTeam.logo ? <img src={homeTeam.logo} alt={homeTeam.name} /> : <div className="results-logo-fallback" />}
          </div>
          <div className="results-team-name">{homeTeam.name || homeTeam.abbreviation}</div>
        </div>

        <div className="results-center">
          <div className="results-vs">VS</div>
        </div>

        <div className="results-team">
          <div className="results-logo">
            {awayTeam.logo ? <img src={awayTeam.logo} alt={awayTeam.name} /> : <div className="results-logo-fallback" />}
          </div>
          <div className="results-team-name">{awayTeam.name || awayTeam.abbreviation}</div>
        </div>
      </div>

      <div className="results-scorebar">
        <div className="results-score-core">
          <div className="results-score home">
            <span className="label">HOME</span>
            <span className="value">{homeTeam.score}</span>
          </div>
          <div className="results-score away">
            <span className="value">{awayTeam.score}</span>
            <span className="label">AWAY</span>
          </div>
        </div>
        <div className="results-score-badge">
          <span>VS</span>
        </div>
      </div>
    </div>
  );
}
