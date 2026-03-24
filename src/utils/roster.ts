import { TeamPlayer } from "../store";

export function toSkaterLabel(player: TeamPlayer) {
  const number = player.jerseyNumber.trim();
  const name = player.name.trim();
  const position = player.position && player.position !== "NM" ? ` (${player.position})` : "";
  if (number && name) return `${number} ${name}${position}`;
  if (name) return `${name}${position}`;
  return number;
}
