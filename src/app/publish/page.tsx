import { EditorialShell } from "@/components/editorial-shell";
import { PublishForm } from "@/components/publish-form";
import { getStagingStatus } from "@/lib/github";

export default async function PublishPage() {
  const stagingStatus = await getStagingStatus();

  return (
    <EditorialShell
      eyebrow="Scottish Hill Runners"
      title="Publish staged changes"
      description="When staged content is ready, open a single pull request to publish all changes to the live site. SHR officials approve one PR instead of many."
    >
      <PublishForm stagingStatus={stagingStatus} />
    </EditorialShell>
  );
}
