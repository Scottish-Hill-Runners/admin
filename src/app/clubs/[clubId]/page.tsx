import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { ClubEditorForm } from "@/components/club-editor-form";
import { getClubDraft, toSafeGitRef } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type ClubEditPageProps = {
  params: Promise<{ clubId: string }>;
  searchParams?: Promise<{ ref?: string; returnToWorkflow?: string }>;
};

function toSafeReturnPath(value: string | undefined): string | undefined {
  const trimmed = String(value ?? "").trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return undefined;
  }

  return trimmed;
}

export default async function ClubEditPage({ params, searchParams }: ClubEditPageProps) {
  const { clubId } = await params;
  const rawSearch = await searchParams;
  const ref = toSafeGitRef(rawSearch?.ref);
  const returnToWorkflowUrl = toSafeReturnPath(rawSearch?.returnToWorkflow);
  const returnSuffix = returnToWorkflowUrl
    ? `?returnToWorkflow=${encodeURIComponent(returnToWorkflowUrl)}`
    : "";
  await requireEditorAccess({ callbackUrl: `/clubs/${clubId}` });

  const initialValues = await getClubDraft(clubId, { ref });

  return (
    <EditorialShell
      eyebrow="Edit club"
      title={initialValues?.name ?? clubId}
      description={`Edit details and description for ${initialValues?.name ?? clubId}.`}
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link href={`/clubs${returnSuffix}`} className="hover:text-stone-900 hover:underline underline-offset-4">
          Clubs
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">{clubId}</span>
      </nav>
      <ClubEditorForm
        key={initialValues?.clubId ?? clubId}
        initialValues={initialValues}
        returnToWorkflowUrl={returnToWorkflowUrl}
      />
    </EditorialShell>
  );
}
