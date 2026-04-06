import { EditorialShell } from "@/components/editorial-shell";
import { RaceItemPicker } from "@/components/race-item-picker";
import { ResultsItemPicker } from "@/components/results-item-picker";
import { ResultsEditForm } from "@/components/results-edit-form";
import {
  getRaceResultsDraft,
  listRaceDrafts,
  listRaceResultsDrafts,
} from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type ResultsEditPageProps = {
  searchParams?: Promise<{
    raceId?: string;
    resultsYear?: string;
    raceQuery?: string;
  }>;
};

export default async function ResultsEditPage({ searchParams }: ResultsEditPageProps) {
  await requireEditorAccess();
  const params = await searchParams;
  const raceId = params?.raceId?.trim();
  const resultsYear = params?.resultsYear?.trim();
  const raceQuery = params?.raceQuery?.trim() ?? "";

  const [raceItems, resultInitialValues, resultItems] = await Promise.all([
    listRaceDrafts(),
    raceId && resultsYear
      ? getRaceResultsDraft(raceId, resultsYear)
      : Promise.resolve(null),
    raceId ? listRaceResultsDrafts(raceId) : Promise.resolve([]),
  ]);

  return (
    <EditorialShell
      eyebrow="Edit"
      title="Edit race results"
      description="Select a race and year to load existing results into the editor."
    >
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <RaceItemPicker
          raceItems={raceItems}
          initialRaceQuery={raceQuery}
          resultsYear={resultsYear}
          basePath="/results/edit"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <ResultsItemPicker
          raceId={raceId}
          resultItems={resultItems}
          raceQuery={raceQuery}
          basePath="/results/edit"
        />
      </section>

      {raceId && resultsYear && resultInitialValues ? (
        <ResultsEditForm
          key={`${raceId}:${resultsYear}`}
          raceId={raceId}
          year={resultsYear}
          csvText={resultInitialValues.csvText}
        />
      ) : null}
    </EditorialShell>
  );
}
