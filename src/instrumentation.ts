import type { Instrumentation } from "next";

/**
 * Server-side error reporting hook (Next.js instrumentation). Every unhandled server error is
 * logged as one structured JSON line (picked up by Vercel logs / log drains). If
 * ERROR_WEBHOOK_URL is set, the same payload is POSTed there (Slack/Discord/Sentry-compatible
 * webhook), so monitoring works without bundling a vendor SDK. Never includes request bodies.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const payload = {
    level: "error",
    at: new Date().toISOString(),
    message: error instanceof Error ? error.message : String(error),
    digest: (error as { digest?: string })?.digest,
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
  };
  console.error(JSON.stringify(payload));
  const webhook = process.env.ERROR_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `[Coffee Roastery OS] ${payload.message} (${payload.path})`,
          ...payload,
        }),
      });
    } catch {
      // never let monitoring break the request
    }
  }
};
