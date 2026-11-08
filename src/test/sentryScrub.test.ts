// @vitest-environment node
import { describe, expect, it } from "vitest";
import { scrubBreadcrumb, scrubEvent } from "../../instrument";

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
});
