import { EditorialShell } from "@/components/editorial-shell";
import { PublishForm } from "@/components/publish-form";
import { getStagingStatus } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function PublishPage() {
  await requireEditorAccess({ callbackUrl: "/publish" });
  const stagingStatus = await getStagingStatus();

  return (
    <EditorialShell
      eyebrow="Scottish Hill Runners"
      title="Publish draft updates"
      description="When draft updates are ready, submit a single publication request to send all changes live. SHR officials review one request instead of many."
    >
      <PublishForm stagingStatus={stagingStatus} />
    </EditorialShell>
  );
}
