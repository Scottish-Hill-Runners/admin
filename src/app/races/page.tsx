import { EditorialShell } from "@/components/editorial-shell";
import { RaceItemPicker } from "@/components/race-item-picker";
import { RaceEditorForm } from "@/components/race-editor-form";
import { getRaceDraft, listRaceDrafts } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type RacesPageProps = {
  searchParams?: Promise<{
    raceId?: string;
    raceQuery?: string;
  }>;
};

export default async function RacesPage({ searchParams }: RacesPageProps) {
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
      eyebrow="MVP Flow"
      title="Race Editing"
      description="The race workspace will combine metadata editing and CSV imports so editors can manage one event from a single screen."
    >
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <RaceItemPicker
          raceItems={raceItems}
          initialRaceQuery={raceQuery}
        />
      </section>
      <RaceEditorForm
        key={initialValues?.raceId ?? raceId ?? "new"}
        initialValues={initialValues}
      />
    </EditorialShell>
  );
}
