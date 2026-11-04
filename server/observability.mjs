import "./env.mjs";
let sentry;
if (
  process.env.SENTRY_DSN &&
  ["production", "staging"].includes(process.env.NODE_ENV)
) {
  sentry = await import("@sentry/node");
  sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    release: process.env.APP_RELEASE,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      delete event.request;
      delete event.user;
      delete event.extra;
      return event;
    },
  });
}
export function captureServerError(error, requestId) {
  if (sentry) sentry.captureException(error, { tags: { requestId } });
}
export async function flushMonitoring() {
  if (sentry) await sentry.flush(2000);
}
