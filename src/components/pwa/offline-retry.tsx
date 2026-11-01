"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function OfflineRetry() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return (
    <div className="flex flex-col items-center gap-2">
      <Button onClick={() => window.location.replace("/dashboard")} data-testid="offline-retry">
        Try again
      </Button>
      <span className="text-muted-foreground text-xs" data-testid="offline-status">
        {online ? "Connection detected" : "Still offline"}
      </span>
    </div>
  );
}
