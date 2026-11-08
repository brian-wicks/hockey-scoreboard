// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { filterOperatorBodies } from "../../instrument";
import { captureFromPosts, closeCapture } from "./sentryCapture";

describe("Sentry request body capture", () => {
  afterEach(closeCapture);

  it("skips the body on operator routes before any scrubbing runs", async () => {
    const sent = await captureFromPosts("3f2b8c1e-9a47-4d21-8f6e-0c1d2e3f4a5b", { integrations: filterOperatorBodies });
    expect(sent).toHaveLength(2);
    expect(sent.join()).not.toContain("123456");
    expect(sent.join()).toContain("kept-body");
  });
});
