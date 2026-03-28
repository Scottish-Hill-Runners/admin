import { EditorialShell } from "@/components/editorial-shell";
import { RaceItemPicker } from "@/components/race-item-picker";
import { ResultsItemPicker } from "@/components/results-item-picker";
import { ResultsUploadForm } from "@/components/results-upload-form";
import {
  getRaceResultsDraft,
  listRaceDrafts,
  listRaceResultsDrafts,
} from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type ResultsPageProps = {
  searchParams?: Promise<{
    raceId?: string;
    resultsYear?: string;
    raceQuery?: string;
  }>;
};

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
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
      eyebrow="MVP Flow"
      title="Results Editing"
      description="Manage race results in a dedicated workspace for creating, validating, and editing CSV uploads."
    >
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <RaceItemPicker
          raceItems={raceItems}
          initialRaceQuery={raceQuery}
          resultsYear={resultsYear}
          basePath="/results"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <ResultsItemPicker
          raceId={raceId}
          resultItems={resultItems}
          raceQuery={raceQuery}
        />
      </section>

      <ResultsUploadForm
        key={`${resultInitialValues?.raceId ?? raceId ?? "new"}:${resultInitialValues?.year ?? resultsYear ?? "new"}`}
        initialValues={resultInitialValues}
      />
    </EditorialShell>
  );
}
