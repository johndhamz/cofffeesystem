import { CoffeeIcon } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NoBusinessPage() {
  const ctx = await requireSession();
  return (
    <div className="bg-muted/40 flex min-h-svh items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="bg-primary text-primary-foreground mb-2 flex size-9 items-center justify-center rounded-md">
            <CoffeeIcon className="size-5" />
          </div>
          <CardTitle>No business assigned</CardTitle>
          <CardDescription>
            {ctx.profile.email} is signed in but is not a member of any business. Ask an owner to
            add you, or provision a business with the administrative script in docs/SECURITY.md.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
