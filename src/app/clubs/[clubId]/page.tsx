import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { ClubEditorForm } from "@/components/club-editor-form";
import { getClubDraft } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type ClubEditPageProps = {
  params: Promise<{ clubId: string }>;
};

export default async function ClubEditPage({ params }: ClubEditPageProps) {
  const { clubId } = await params;
  await requireEditorAccess({ callbackUrl: `/clubs/${clubId}` });

  const initialValues = await getClubDraft(clubId);

  return (
    <EditorialShell
      eyebrow="Edit club"
      title={initialValues?.name ?? clubId}
      description={`Edit details and description for ${initialValues?.name ?? clubId}.`}
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link href="/clubs" className="hover:text-stone-900 hover:underline underline-offset-4">
          Clubs
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">{clubId}</span>
      </nav>
      <ClubEditorForm
        key={initialValues?.clubId ?? clubId}
        initialValues={initialValues}
      />
    </EditorialShell>
  );
}
