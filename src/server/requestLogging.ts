import pino from "pino";
import { maskOperatorLinks } from "../lib/operatorAccess.ts";

/**
 * pino-http request serializer that keeps operator links out of the logs. The link is
 * part of the route path, so the URL, the referer and any route params are masked.
 */
export function serializeRequest(req: any) {
  const serialized: any = pino.stdSerializers.req(req);
  if (typeof serialized.url === "string") serialized.url = maskOperatorLinks(serialized.url);
  if (serialized.headers) {
    for (const name of ["referer", "referrer"]) {
      const value = serialized.headers[name];
      if (typeof value === "string") serialized.headers[name] = maskOperatorLinks(value);
    }
  }
  if (serialized.params && typeof serialized.params === "object" && "operatorId" in serialized.params) {
    serialized.params = { ...serialized.params, operatorId: "[hidden]" };
  }
  if (typeof serialized.query === "object" && serialized.query) {
    // Query strings never carry a link, but a copy of the URL in one would.
    serialized.query = JSON.parse(maskOperatorLinks(JSON.stringify(serialized.query)));
  }
  return serialized;
}
