import { ConstructionIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

/** Clearly-labelled placeholder for modules scheduled in later phases. */
export function PlaceholderPage({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <div className="space-y-5">
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={<ConstructionIcon className="size-5" />}
        title={`${title} is planned for ${phase}`}
        description="This is placeholder content. No business logic for this module has been implemented yet — see docs/DEVELOPMENT_ROADMAP.md."
      />
    </div>
  );
}
