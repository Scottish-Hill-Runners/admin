import { EditorialShell } from "@/components/editorial-shell";
import { ClubItemPicker } from "@/components/club-item-picker";
import { ClubEditorForm } from "@/components/club-editor-form";
import { getClubDraft, listClubDrafts } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type ClubsEditPageProps = {
  searchParams?: Promise<{
    clubId?: string;
    clubQuery?: string;
  }>;
};

export default async function ClubsEditPage({ searchParams }: ClubsEditPageProps) {
  await requireEditorAccess();
  const params = await searchParams;
  const clubId = params?.clubId?.trim();
  const clubQuery = params?.clubQuery?.trim() ?? "";

  const [initialValues, clubItems] = await Promise.all([
    clubId ? getClubDraft(clubId) : Promise.resolve(null),
    listClubDrafts(),
  ]);

  return (
    <EditorialShell
      eyebrow="Edit"
      title="Edit club details"
      description="Select a club to load it into the editor, then update its details or description."
    >
      <section>
        <ClubItemPicker
          clubItems={clubItems}
          initialClubQuery={clubQuery}
          selectedClubId={clubId}
        />
      </section>
      {clubId ? (
        <ClubEditorForm
          key={initialValues?.clubId ?? clubId}
          initialValues={initialValues}
        />
      ) : null}
    </EditorialShell>
  );
}
