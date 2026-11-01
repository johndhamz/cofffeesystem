import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatManilaDate } from "@/lib/units/time";
import { ROLE_LABELS } from "@/lib/permissions/policy";
import { getSessionContext, can } from "@/lib/auth/session";
import { listMembers } from "@/server/services/members.service";
import { InviteMemberDialog } from "@/features/members/components/invite-member-dialog";
import { MemberRowActions } from "@/features/members/components/member-row-actions";

export const metadata: Metadata = { title: "Team members" };

export default async function MembersPage() {
  const [ctx, { members, currentUserId }] = await Promise.all([getSessionContext(), listMembers()]);
  const canManage = can(ctx, "members.manage");
  return (
    <div className="space-y-5">
      <PageHeader
        title="Team members"
        description="Who can sign in and what they can do. Deactivate instead of deleting to keep history."
        breadcrumb={
          <Link href="/settings" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeftIcon className="size-3" /> Settings
          </Link>
        }
        actions={canManage ? <InviteMemberDialog /> : null}
      />
      <div className="overflow-x-auto rounded-lg border">
        <Table data-testid="members-table">
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Invited</TableHead>
              <TableHead>Joined</TableHead>
              {canManage ? <TableHead /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id} data-testid="member-row" data-email={m.email}>
                <TableCell>
                  <span className="block font-medium">
                    {m.full_name ?? m.email}
                    {m.user_id === currentUserId ? (
                      <span className="text-muted-foreground ml-2 text-xs">(you)</span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground block text-xs">{m.email}</span>
                </TableCell>
                <TableCell data-testid="member-role">{ROLE_LABELS[m.role]}</TableCell>
                <TableCell>
                  {!m.is_active ? (
                    <StatusBadge status="inactive" />
                  ) : m.accepted_at ? (
                    <StatusBadge status="active" />
                  ) : (
                    <StatusBadge status="draft" label="Invited" tone="warning" />
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {m.invited_at
                    ? `${formatManilaDate(m.invited_at)}${m.invited_by_name ? ` by ${m.invited_by_name}` : ""}`
                    : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {formatManilaDate(m.accepted_at ?? (m.invited_at ? null : m.created_at))}
                </TableCell>
                {canManage ? (
                  <TableCell>
                    <MemberRowActions
                      memberId={m.id}
                      role={m.role}
                      isActive={m.is_active}
                      accepted={!!m.accepted_at}
                      isSelf={m.user_id === currentUserId}
                      name={m.full_name ?? m.email}
                    />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-muted-foreground text-xs">
        A business always keeps at least one active owner. Role changes and deactivations are
        recorded in the audit trail.
      </p>
    </div>
  );
}
