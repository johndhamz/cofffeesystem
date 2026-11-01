import type { Metadata } from "next";
import { WifiOffIcon } from "lucide-react";
import { OfflineRetry } from "@/components/pwa/offline-retry";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main
      className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center"
      data-testid="offline-page"
    >
      <span className="bg-muted flex size-14 items-center justify-center rounded-full">
        <WifiOffIcon className="size-7" />
      </span>
      <h1 className="text-xl font-semibold">You are offline</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        Coffee Roastery OS needs a connection to read and record stock, roasts and sales so that
        nothing is lost or double-counted. Reconnect and try again.
      </p>
      <OfflineRetry />
    </main>
  );
}
