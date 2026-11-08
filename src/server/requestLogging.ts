import { maskOperatorLinks } from "../lib/operatorAccess.ts";

const HIDDEN = "[hidden]";

function maskHeaders(headers: Record<string, unknown>, names: string[]) {
  const masked = { ...headers };
  for (const name of Object.keys(masked)) {
    if (names.includes(name.toLowerCase())) masked[name] = HIDDEN;
  }
  return masked;
}

/**
 * pino-http request serializer that keeps credentials out of the logs. The owner's ID
 * token and any cookie are masked on every route. An operator link is part of the route
 * path, so the URL, the referer and any route params are masked too.
 *
 * pino-http passes in pino's own serialized form, not the request. That form shares its
 * headers object with the live request, so it's cloned before anything is masked.
 */
export function serializeRequest(req: any) {
  const serialized: any = { ...req };
  if (typeof serialized.url === "string") serialized.url = maskOperatorLinks(serialized.url);
  if (serialized.headers) {
    serialized.headers = maskHeaders(serialized.headers, ["authorization", "cookie"]);
    for (const name of ["referer", "referrer"]) {
      const value = serialized.headers[name];
      if (typeof value === "string") serialized.headers[name] = maskOperatorLinks(value);
    }
  }
  if (serialized.params && typeof serialized.params === "object" && "operatorId" in serialized.params) {
    serialized.params = { ...serialized.params, operatorId: HIDDEN };
  }
  if (typeof serialized.query === "object" && serialized.query) {
    // Query strings never carry a link, but a copy of the URL in one would.
    serialized.query = JSON.parse(maskOperatorLinks(JSON.stringify(serialized.query)));
  }
  return serialized;
}

/** pino-http logs the response headers on every completed request, including any `set-cookie`. */
export function serializeResponse(res: any) {
  return res.headers ? { ...res, headers: maskHeaders(res.headers, ["set-cookie"]) } : res;
}

export const requestLogSerializers = { req: serializeRequest, res: serializeResponse };
