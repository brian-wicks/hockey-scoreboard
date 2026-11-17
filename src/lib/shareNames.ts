/** Rules for a custom name in a share link, used by both the share sheet and the server. */
export const normalizeShareName = (name: string): string => name.trim().toLowerCase();

export const isValidShareName = (name: unknown): name is string =>
  typeof name === "string" && /^[a-z0-9-]{4,40}$/.test(name);

/** The server turns a viewer's connection down with this when the share link doesn't exist. */
export const INVALID_SHARE_LINK_ERROR = "Authentication error: Invalid share link";
