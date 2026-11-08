/** Values both the client and server need. Hashing stays in src/server/operatorCredentials.ts. */
export const OPERATOR_PIN_LENGTH = 6;

/** Handshake failure text. The client uses it to tell a rejected token from a network failure. */
export const OPERATOR_SESSION_ENDED_ERROR = "Authentication error: Operator session ended";

export const isValidOperatorPin = (pin: unknown): pin is string =>
  typeof pin === "string" && /^\d{6}$/.test(pin);
