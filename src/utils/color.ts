/** Picks black or white text so it stays readable against an arbitrary hex background,
 * using the standard YIQ perceived-brightness formula. Falls back to white for anything
 * that doesn't parse as a hex color. */
export function getReadableTextColor(hexColor: string): "#000000" | "#ffffff" {
  const hex = hexColor.trim().replace(/^#/, "");
  const expanded = hex.length === 3 ? hex.replace(/(.)/g, "$1$1") : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return "#ffffff";

  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#000000" : "#ffffff";
}
