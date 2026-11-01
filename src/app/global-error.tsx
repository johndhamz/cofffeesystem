"use client";

import { useEffect } from "react";

/** Last-resort error boundary (root layout failures). Keeps the message generic; details go to the error log. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("global-error", { message: error.message, digest: error.digest });
  }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>
          Coffee Roastery OS is temporarily unavailable
        </h1>
        <p style={{ color: "#555" }}>
          An unexpected error occurred. Reference: {error.digest ?? "n/a"}
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: 16,
            padding: "8px 14px",
            border: "1px solid #ccc",
            borderRadius: 6,
            background: "white",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
