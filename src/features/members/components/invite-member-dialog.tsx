"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Loader2Icon, UserPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/shared/form-field";
import { ROLE_LABELS, ROLES } from "@/lib/permissions/policy";
import { inviteMemberSchema, type InviteMemberInput } from "../schemas";
import { inviteMemberAction } from "../actions";

type FormValues = z.input<typeof inviteMemberSchema>;

export function InviteMemberDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<FormValues, unknown, InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: "", full_name: "", role: "viewer" },
  });
  const errors = form.formState.errors;
  async function onSubmit(values: InviteMemberInput) {
    setFormError(null);
    const r = await inviteMemberAction(values);
    if (!r.ok) {
      for (const [name, messages] of Object.entries(r.error.fieldErrors ?? {}))
        form.setError(name as Path<FormValues>, { message: messages[0] });
      setFormError(r.error.message);
      toast.error(r.error.message);
      return;
    }
    toast.success(
      r.data.reactivated
        ? "Membership reactivated"
        : r.data.invited
          ? "Invitation sent"
          : "Member added",
    );
    setOpen(false);
    form.reset();
    router.refresh();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="invite-button">
          <UserPlusIcon /> Invite member
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="invite-dialog">
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>
            They receive an email with a link to set their password. There is no public sign-up.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
          data-testid="invite-form"
        >
          {formError ? (
            <Alert variant="destructive" data-testid="form-error">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}
          <FormField name="email" label="Email" error={errors.email?.message} required>
            <Input
              id="invite_email"
              type="email"
              data-testid="input-invite-email"
              {...form.register("email")}
            />
          </FormField>
          <FormField name="full_name" label="Full name" error={errors.full_name?.message}>
            <Input
              id="invite_name"
              data-testid="input-invite-name"
              {...form.register("full_name")}
            />
          </FormField>
          <FormField name="role" label="Role" error={errors.role?.message} required>
            <NativeSelect
              id="invite_role"
              data-testid="select-invite-role"
              {...form.register("role")}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              data-testid="invite-submit"
            >
              {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}Send
              invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
