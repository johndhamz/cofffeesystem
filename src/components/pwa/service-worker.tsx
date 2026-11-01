"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/** Registers the service worker in production builds and surfaces connectivity changes. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ENABLE_SW !== "true")
      return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* registration failures are non-fatal: the app works without offline support */
    });
  }, []);

  useEffect(() => {
    const offline = () =>
      toast.warning("You are offline. Changes cannot be saved until the connection returns.", {
        id: "net",
      });
    const online = () => toast.success("Back online", { id: "net" });
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);
  return null;
}
