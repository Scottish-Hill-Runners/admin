import { EditorialShell } from "@/components/editorial-shell";
import { PublishManageForm } from "@/components/publish-manage-form";
import {
  getStagingStatus,
  listOpenStagingPullRequests,
  listPublishNewsCandidates,
} from "@/lib/github";
import { requirePublisherAccess } from "@/lib/route-protection";
import { env } from "@/lib/env";

export default async function PublishManagePage() {
  await requirePublisherAccess();

  const [stagingStatus, pendingSubmissions, publishNewsCandidates] = await Promise.all([
    getStagingStatus(),
    listOpenStagingPullRequests(),
    listPublishNewsCandidates(),
  ]);

  const socialPostingAvailable =
    Boolean(env.PUBLIC_SITE_BASE_URL) &&
    Boolean(env.FACEBOOK_PAGE_ID) &&
    Boolean(env.FACEBOOK_PAGE_ACCESS_TOKEN);
  const socialCandidates =
    socialPostingAvailable && env.PUBLIC_SITE_BASE_URL
      ? publishNewsCandidates
      : [];

  return (
    <EditorialShell
      eyebrow="Scottish Hill Runners"
      title="Manage publishing"
      description="Accept pending editor submissions and publish all draft updates to the live site."
    >
      <PublishManageForm
        pendingSubmissions={pendingSubmissions}
        stagingStatus={stagingStatus}
        socialCandidates={socialCandidates}
        socialPostingAvailable={socialPostingAvailable}
      />
    </EditorialShell>
  );
}
