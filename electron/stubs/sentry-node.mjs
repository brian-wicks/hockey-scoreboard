// Offline build stub. Sentry reports to a hosted service, which is by definition
// unreachable in the offline build, so these are no-ops rather than throwing —
// logError() calls captureException on every handled error and must not fail.
export const init = () => {};
export const captureException = () => {};
export const setupExpressErrorHandler = () => {};
export const onUncaughtExceptionIntegration = () => ({ name: "OnUncaughtException" });
