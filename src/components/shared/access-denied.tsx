import Link from "next/link";
import { ShieldXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AccessDenied({ message }: { message?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-16 text-center"
      data-testid="access-denied"
    >
      <div className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
        <ShieldXIcon className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Access denied</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          {message ??
            "Your role does not allow you to view this page. Ask an owner if you need access."}
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
