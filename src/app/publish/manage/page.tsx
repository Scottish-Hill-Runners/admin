import { EditorialShell } from "@/components/editorial-shell";
import { PublishManageForm } from "@/components/publish-manage-form";
import { getStagingStatus, listOpenStagingPullRequests } from "@/lib/github";
import { requirePublisherAccess } from "@/lib/route-protection";

export default async function PublishManagePage() {
  await requirePublisherAccess();

  const [stagingStatus, pendingSubmissions] = await Promise.all([
    getStagingStatus(),
    listOpenStagingPullRequests(),
  ]);

  return (
    <EditorialShell
      eyebrow="Scottish Hill Runners"
      title="Manage publishing"
      description="Accept pending editor submissions and publish all draft updates to the live site."
    >
      <PublishManageForm
        pendingSubmissions={pendingSubmissions}
        stagingStatus={stagingStatus}
      />
    </EditorialShell>
  );
}
