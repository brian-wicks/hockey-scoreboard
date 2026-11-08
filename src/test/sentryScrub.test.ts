// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { scrubBreadcrumb, scrubEvent } from "../../instrument";
import { captureFromPosts, closeCapture } from "./sentryCapture";

const id = "3f2b8c1e-9a47-4d21-8f6e-0c1d2e3f4a5b";

describe("Sentry scrubbing", () => {
  it("masks the link in events", () => {
    const event: any = scrubEvent({
      type: undefined,
      transaction: `POST /api/operator/${id}/session`,
      request: { url: `http://h/operate/${id}`, headers: { referer: `http://h/operate/${id}` } },
      breadcrumbs: [{ message: `GET /operate/${id}`, data: { url: `http://h/api/operator/${id}/session` } }],
    } as any);
    expect(JSON.stringify(event)).not.toContain(id);
    expect(event.transaction).toBe("POST /api/operator/[hidden]/session");
  });

  it("masks the link in breadcrumbs", () => {
    const crumb = scrubBreadcrumb({ message: `x /operate/${id}`, data: { url: `/api/operator/${id}/session` } });
    expect(JSON.stringify(crumb)).not.toContain(id);
  });

  it("drops the body of a request to an operator route", () => {
    const event: any = scrubEvent({
      type: undefined,
      request: { url: `http://h/api/operator/${id}/session`, data: JSON.stringify({ pin: "123456" }) },
    } as any);
    expect(event.request.data).toBeUndefined();
    expect(JSON.stringify(event)).not.toContain("123456");
  });

  it("drops the body when the URL is already masked or differs in case", () => {
    for (const url of ["http://h/api/operator/[hidden]/session", `http://h/API/Operator/${id}/session`]) {
      const event: any = scrubEvent({ type: undefined, request: { url, data: "{}" } } as any);
      expect(event.request.data).toBeUndefined();
    }
  });

  it("drops the body when only the transaction names the operator route", () => {
    const event: any = scrubEvent({
      type: undefined,
      transaction: "POST /api/operator/:operatorId/session",
      request: { data: "{}" },
    } as any);
    expect(event.request.data).toBeUndefined();
  });

  it("keeps the body of other requests", () => {
    for (const url of ["http://h/api/shortcuts", "http://h/api/operator-access"]) {
      const event: any = scrubEvent({ type: undefined, request: { url, data: "[1]" } } as any);
      expect(event.request.data).toBe("[1]");
    }
  });

  it("masks the link in the query string", () => {
    const event: any = scrubEvent({
      type: undefined,
      request: { url: "http://h/api/shortcuts", query_string: `next=/operate/${id}` },
    } as any);
    expect(event.request.query_string).toBe("next=/operate/[hidden]");
  });

  it("leaves a referer that isn't a string alone", () => {
    const referer = ["http://h/a", "http://h/b"];
    const event: any = scrubEvent({ type: undefined, request: { headers: { referer } } } as any);
    expect(event.request.headers.referer).toBe(referer);
  });

  it("masks sign-in headers on every route, in any case, and leaves other headers", () => {
    const event: any = scrubEvent({
      type: undefined,
      request: {
        url: "http://h/api/shortcuts",
        headers: {
          authorization: "Bearer lower-token",
          Authorization: "Bearer title-token",
          COOKIE: "session=upper-cookie",
          "Set-Cookie": "session=issued-cookie",
          accept: "application/json",
        },
      },
    } as any);
    expect(event.request.headers).toEqual({
      authorization: "[hidden]",
      Authorization: "[hidden]",
      COOKIE: "[hidden]",
      "Set-Cookie": "[hidden]",
      accept: "application/json",
    });
  });

  it("masks the value of every parsed cookie", () => {
    const event: any = scrubEvent({
      type: undefined,
      request: { cookies: { session: "cookie-one", theme: "cookie-two" } },
    } as any);
    expect(event.request.cookies).toEqual({ session: "[hidden]", theme: "[hidden]" });
  });

  it("masks cookies that aren't a parsed object", () => {
    const event: any = scrubEvent({ type: undefined, request: { cookies: "session=raw-cookie" } } as any);
    expect(event.request.cookies).toBe("[hidden]");
  });

  it("handles an event with no headers or cookies", () => {
    expect(scrubEvent({ type: undefined, request: { url: "http://h/a" } } as any).request).toEqual({ url: "http://h/a" });
    expect(scrubEvent({ type: undefined } as any).request).toBeUndefined();
  });

  describe("with the real SDK capturing a request", () => {
    afterEach(closeCapture);

    const signedIn = { Authorization: "Bearer sdk-id-token", Cookie: "session=sdk-cookie-value" };

    it("sends sign-in headers and cookies by default, which is what the masking guards against", async () => {
      const sent = await captureFromPosts(id, {}, signedIn);
      expect(sent.join()).toContain("sdk-id-token");
      expect(sent.join()).toContain("sdk-cookie-value");
    });

    it("sends neither the ID token nor the cookie once scrubbed", async () => {
      const sent = await captureFromPosts(id, { beforeSend: scrubEvent, beforeBreadcrumb: scrubBreadcrumb }, signedIn);
      expect(sent).toHaveLength(2);
      expect(sent.join()).not.toContain("sdk-id-token");
      expect(sent.join()).not.toContain("sdk-cookie-value");
      expect(sent.join()).toContain("[hidden]");
    });

    it("captures bodies by default, which is what the scrubbing guards against", async () => {
      const sent = await captureFromPosts(id, {});
      expect(sent.join()).toContain("123456");
    });

    it("sends neither the PIN nor the link, and keeps other bodies", async () => {
      const sent = await captureFromPosts(id, { beforeSend: scrubEvent, beforeBreadcrumb: scrubBreadcrumb });
      expect(sent).toHaveLength(2);
      expect(sent.join()).not.toContain("123456");
      expect(sent.join()).not.toContain(id);
      expect(sent.join()).toContain("kept-body");
    });
  });
});
