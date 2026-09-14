import { TeamPlayer } from "../store";

/** Numeric jersey numbers first (ascending), blank/non-numeric ones last, alphabetically. */
export function sortPlayersByJersey(players: TeamPlayer[]): TeamPlayer[] {
  return players.slice().sort((a, b) => {
    const aNumber = Number.parseInt(a.jerseyNumber, 10);
    const bNumber = Number.parseInt(b.jerseyNumber, 10);
    const aValid = Number.isFinite(aNumber);
    const bValid = Number.isFinite(bNumber);
    if (aValid && bValid) return aNumber - bNumber;
    if (aValid) return -1;
    if (bValid) return 1;
    return a.jerseyNumber.localeCompare(b.jerseyNumber);
  });
}

export function toSkaterLabel(player: TeamPlayer) {
  const number = player.jerseyNumber.trim();
  const name = player.name.trim();
  const position = player.position && player.position !== "NM" ? ` (${player.position})` : "";
  if (number && name) return `${number} ${name}${position}`;
  if (name) return `${name}${position}`;
  return number;
}
