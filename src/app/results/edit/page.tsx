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
    year?: string;
    resultsYear?: string;
    raceQuery?: string;
  }>;
};

export default async function ResultsEditPage({ searchParams }: ResultsEditPageProps) {
  const params = await searchParams;
  const raceId = params?.raceId?.trim();
  const year = params?.year?.trim();
  const resultsYear = year || params?.resultsYear?.trim();
  const raceQuery = params?.raceQuery?.trim() ?? "";

  const callbackParams = new URLSearchParams();
  if (raceId) {
    callbackParams.set("raceId", raceId);
  }
  if (resultsYear) {
    callbackParams.set("year", resultsYear);
  }
  if (raceQuery) {
    callbackParams.set("raceQuery", raceQuery);
  }

  const callbackUrl = callbackParams.toString()
    ? `/results/edit?${callbackParams.toString()}`
    : "/results/edit";
  await requireEditorAccess({ callbackUrl });

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
          selectedRaceId={raceId}
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

      {raceId && resultsYear && !resultInitialValues ? (
        <section className="rounded-[1.5rem] border border-amber-500/40 bg-amber-100/80 p-6 text-amber-900 shadow-[0_10px_30px_rgba(120,53,15,0.12)]">
          <p className="text-sm font-semibold uppercase tracking-[0.16em]">
            Results file not found
          </p>
          <p className="mt-2 text-sm leading-6">
            Could not load races/{raceId}/{resultsYear}.csv. Check the race ID and year in the link, or choose an existing results file from the picker.
          </p>
        </section>
      ) : null}
    </EditorialShell>
  );
}
