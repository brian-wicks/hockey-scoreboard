import { describe, expect, it } from "vitest";
import { makeTransform } from "../../components/control-panel/PdfLayoutCanvas";
import { getDefaultGamesheetPdfLayout } from "../../utils/gamesheetPdf";

const PAGE_HEIGHT = 792; // US Letter, portrait.

function layoutWith(overrides: { scale?: number; offsetX?: number; offsetY?: number }) {
  return { ...getDefaultGamesheetPdfLayout(), ...overrides };
}

describe("PdfLayoutCanvas coordinate transform", () => {
  it("maps the page's top-left corner to the canvas origin", () => {
    const t = makeTransform(PAGE_HEIGHT, 1, layoutWith({}));
    expect(t.toScreen(0, 0)).toEqual({ left: 0, top: 0 });
  });

  it("measures Y downward from the top of the page", () => {
    const t = makeTransform(PAGE_HEIGHT, 1, layoutWith({}));
    expect(t.toScreen(0, 100).top).toBe(100);
    expect(t.toScreen(0, 700).top).toBe(700);
  });

  it("scales layout points into display pixels", () => {
    const t = makeTransform(PAGE_HEIGHT, 0.5, layoutWith({}));
    expect(t.toScreen(200, 400)).toEqual({ left: 100, top: 200 });
  });

  it("round-trips a position back to the same layout coordinates", () => {
    const t = makeTransform(PAGE_HEIGHT, 0.75, layoutWith({}));
    const screen = t.toScreen(123, 456);
    const back = t.toLayout(screen.left, screen.top);
    expect(back.x).toBeCloseTo(123, 6);
    expect(back.yFromTop).toBeCloseTo(456, 6);
  });

  it("round-trips under the layout's own scale and offsets", () => {
    // A handle must land where the text actually rendered, which means applying
    // the same scale/offset the PDF renderer uses — not just the display scale.
    const t = makeTransform(PAGE_HEIGHT, 0.6, layoutWith({ scale: 1.2, offsetX: 15, offsetY: -8 }));
    const screen = t.toScreen(240, 310);
    const back = t.toLayout(screen.left, screen.top);
    expect(back.x).toBeCloseTo(240, 6);
    expect(back.yFromTop).toBeCloseTo(310, 6);
  });

  it("shifts the drawn position when the layout offset changes", () => {
    const plain = makeTransform(PAGE_HEIGHT, 1, layoutWith({}));
    const offset = makeTransform(PAGE_HEIGHT, 1, layoutWith({ offsetX: 20 }));
    expect(offset.toScreen(100, 100).left - plain.toScreen(100, 100).left).toBe(20);
  });

  it("treats a missing scale as 1 rather than collapsing to zero", () => {
    const t = makeTransform(PAGE_HEIGHT, 1, { ...getDefaultGamesheetPdfLayout(), scale: 0 });
    expect(t.toScreen(100, 100)).toEqual({ left: 100, top: 100 });
    const back = t.toLayout(100, 100);
    expect(back.x).toBeCloseTo(100, 6);
    expect(back.yFromTop).toBeCloseTo(100, 6);
  });
});
