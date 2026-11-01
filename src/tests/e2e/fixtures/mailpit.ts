import type { APIRequestContext } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:55824";

/** Returns the first app link (http://localhost:3000/...) from the newest email sent to `to`. */
export async function latestAppLink(
  request: APIRequestContext,
  to: string,
  attempts = 20,
): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const search = await request.get(`${MAILPIT}/api/v1/search`, {
      params: { query: `to:${to}`, limit: 1 },
    });
    const body = (await search.json()) as { messages?: { ID: string }[] };
    const id = body.messages?.[0]?.ID;
    if (id) {
      const msg = await request.get(`${MAILPIT}/api/v1/message/${id}`);
      const { HTML, Text } = (await msg.json()) as { HTML?: string; Text?: string };
      const match = /https?:\/\/(?:localhost|127\.0\.0\.1):3000\/[^"'\s<]+/.exec(
        (HTML ?? "") + "\n" + (Text ?? ""),
      );
      if (match) return match[0].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email with an app link arrived for ${to}`);
}
