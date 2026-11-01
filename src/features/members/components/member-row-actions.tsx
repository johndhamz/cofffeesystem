"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MailIcon, PowerIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/permissions/policy";
import { changeMemberRoleAction, resendInviteAction, setMemberActiveAction } from "../actions";

interface Props {
  memberId: string;
  role: Role;
  isActive: boolean;
  accepted: boolean;
  isSelf: boolean;
  name: string;
}

export function MemberRowActions({ memberId, role, isActive, accepted, isSelf, name }: Props) {
  const router = useRouter();
  return (
    <div className="flex items-center justify-end gap-2" data-testid="member-actions">
      <NativeSelect
        aria-label={`Role for ${name}`}
        data-testid="select-member-role"
        value={role}
        disabled={!isActive}
        className="w-40"
        onChange={async (e) => {
          const r = await changeMemberRoleAction(memberId, { role: e.target.value });
          if (!r.ok) {
            toast.error(r.error.message);
            router.refresh();
            return;
          }
          toast.success(`${name} is now ${ROLE_LABELS[e.target.value as Role]}`);
          router.refresh();
        }}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </NativeSelect>
      {!accepted && isActive ? (
        <Button
          variant="outline"
          size="sm"
          data-testid="resend-invite"
          onClick={async () => {
            const r = await resendInviteAction(memberId);
            if (!r.ok) return toast.error(r.error.message);
            toast.success("Invitation resent");
          }}
        >
          <MailIcon /> Resend
        </Button>
      ) : null}
      {!isSelf ? (
        <ConfirmDialog
          title={isActive ? `Deactivate ${name}?` : `Reactivate ${name}?`}
          description={
            isActive
              ? "They lose access immediately. Their history and audit entries are kept."
              : "They regain access with their current role."
          }
          confirmLabel={isActive ? "Deactivate" : "Reactivate"}
          destructive={isActive}
          testId="member-active-dialog"
          onConfirm={async () => {
            const r = await setMemberActiveAction(memberId, !isActive);
            if (!r.ok) {
              toast.error(r.error.message);
              throw new Error(r.error.message);
            }
            toast.success(isActive ? "Member deactivated" : "Member reactivated");
            router.refresh();
          }}
          trigger={
            <Button variant="ghost" size="sm" data-testid="toggle-member-active">
              <PowerIcon /> {isActive ? "Deactivate" : "Reactivate"}
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
