import { EditorialShell } from "@/components/editorial-shell";
import { RaceItemPicker } from "@/components/race-item-picker";
import { RaceEditorForm } from "@/components/race-editor-form";
import { getRaceDraft, listRaceDrafts } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type RacesEditPageProps = {
  searchParams?: Promise<{
    raceId?: string;
    raceQuery?: string;
  }>;
};

export default async function RacesEditPage({ searchParams }: RacesEditPageProps) {
  await requireEditorAccess();
  const params = await searchParams;
  const raceId = params?.raceId?.trim();
  const raceQuery = params?.raceQuery?.trim() ?? "";

  const [initialValues, raceItems] = await Promise.all([
    raceId ? getRaceDraft(raceId) : Promise.resolve(null),
    listRaceDrafts(),
  ]);

  return (
    <EditorialShell
      eyebrow="Edit"
      title="Edit race details"
      description="Select a race to load it into the editor, then update its metadata or route description."
    >
      <section>
        <RaceItemPicker
          raceItems={raceItems}
          initialRaceQuery={raceQuery}
          selectedRaceId={raceId}
          basePath="/races/edit"
        />
      </section>
      {raceId ? (
        <RaceEditorForm
          key={initialValues?.raceId ?? raceId}
          initialValues={initialValues}
        />
      ) : null}
    </EditorialShell>
  );
}
