import { CoffeeIcon } from "lucide-react";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="bg-muted/40 flex min-h-svh flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-md">
          <CoffeeIcon className="size-5" />
        </span>
        <span className="text-lg font-semibold">Coffee Roastery OS</span>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
