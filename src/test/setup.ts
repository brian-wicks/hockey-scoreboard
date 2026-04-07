import "@testing-library/jest-dom";
import { vi } from "vitest";

process.env.NODE_ENV = "test";

if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
    return globalThis.setTimeout(() => callback(Date.now()), 16) as unknown as number;
  };
}

if (!globalThis.cancelAnimationFrame) {
  globalThis.cancelAnimationFrame = (id: number) => {
    globalThis.clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
  };
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

vi.stubGlobal("scrollTo", () => {});
