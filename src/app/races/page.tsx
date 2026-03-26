import { EditorialShell } from "@/components/editorial-shell";
import { RaceEditorForm } from "@/components/race-editor-form";
import { ResultsUploadForm } from "@/components/results-upload-form";
import Link from "next/link";
import {
  getRaceDraft,
  getRaceResultsDraft,
  listRaceDrafts,
  listRaceResultsDrafts,
} from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

const workflows = [
  "Edit race metadata and descriptive copy.",
  "Upload a CSV for a selected race and year.",
  "Preview validation issues before a pull request is created.",
];

type RacesPageProps = {
  searchParams?: Promise<{
    raceId?: string;
    resultsYear?: string;
    raceQuery?: string;
    resultsQuery?: string;
  }>;
};

export default async function RacesPage({ searchParams }: RacesPageProps) {
  const { email } = await requireEditorAccess();
  const params = await searchParams;
  const raceId = params?.raceId?.trim();
  const resultsYear = params?.resultsYear?.trim();
  const raceQuery = params?.raceQuery?.trim() ?? "";
  const resultsQuery = params?.resultsQuery?.trim() ?? "";
  const [initialValues, raceItems, resultInitialValues, resultItems] = await Promise.all([
    raceId ? getRaceDraft(raceId) : Promise.resolve(null),
    listRaceDrafts(),
    raceId && resultsYear
      ? getRaceResultsDraft(raceId, resultsYear)
      : Promise.resolve(null),
    raceId ? listRaceResultsDrafts(raceId) : Promise.resolve([]),
  ]);
  const normalizedRaceQuery = raceQuery.toLowerCase();
  const filteredRaceItems = normalizedRaceQuery
    ? raceItems.filter((item) => {
        const haystack = `${item.title} ${item.raceId} ${item.venue}`.toLowerCase();
        return haystack.includes(normalizedRaceQuery);
      })
    : raceItems;
  const normalizedResultsQuery = resultsQuery.toLowerCase();
  const filteredResultItems = normalizedResultsQuery
    ? resultItems.filter((item) => item.year.toLowerCase().includes(normalizedResultsQuery))
    : resultItems;

  return (
    <EditorialShell
      eyebrow="MVP Flow"
      title="Race Editing"
      description="The race workspace will combine metadata editing and CSV imports so editors can manage one event from a single screen."
    >
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/80 px-6 py-4 text-sm text-stone-700 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        Signed in as {email}
      </section>
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
          <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
            Open existing race
          </h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Load an existing race page into the editor, then update metadata or descriptive copy from one place.
          </p>
          <form className="mt-5">
            <input
              name="raceQuery"
              defaultValue={raceQuery}
              placeholder="Filter by race title, ID, or venue"
              className="w-full rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-900/30"
            />
            {resultsYear ? <input type="hidden" name="resultsYear" value={resultsYear} /> : null}
            {resultsQuery ? <input type="hidden" name="resultsQuery" value={resultsQuery} /> : null}
          </form>
          <div className="mt-5 grid gap-3 max-h-[28rem] overflow-y-auto pr-1">
            {filteredRaceItems.length > 0 ? (
              filteredRaceItems.map((item) => (
                <Link
                  key={item.raceId}
                  href={`/races?raceId=${encodeURIComponent(item.raceId)}${resultsYear ? `&resultsYear=${encodeURIComponent(resultsYear)}` : ""}${raceQuery ? `&raceQuery=${encodeURIComponent(raceQuery)}` : ""}${resultsQuery ? `&resultsQuery=${encodeURIComponent(resultsQuery)}` : ""}`}
                  className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 transition hover:border-stone-900/25 hover:bg-stone-100"
                >
                  <p className="font-semibold text-stone-900">{item.title}</p>
                  <p className="mt-1 text-sm text-stone-600">{item.raceId}</p>
                  {item.venue ? <p className="text-sm text-stone-500">{item.venue}</p> : null}
                </Link>
              ))
            ) : (
              <p className="text-sm text-stone-600">No races matched the current filter.</p>
            )}
          </div>
        </article>

        <article className="rounded-[1.5rem] border border-stone-900/10 bg-stone-900 p-6 text-stone-50 shadow-[0_22px_55px_rgba(28,25,23,0.28)]">
          <h2 className="font-[family:var(--font-heading)] text-2xl">Workspace mode</h2>
          <p className="mt-4 text-base leading-7 text-stone-200">
            {initialValues
              ? `Editing existing race: ${initialValues.title}`
              : "Creating a new race draft. Use the list to load an existing race page."}
          </p>
        </article>
      </section>
      <RaceEditorForm initialValues={initialValues} />
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
          <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
            Open existing results
          </h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            {raceId
              ? "Choose an existing CSV result file for this race and load it into the editor."
              : "Select a race first to browse existing result CSV files."}
          </p>
          <form className="mt-5">
            <input
              name="resultsQuery"
              defaultValue={resultsQuery}
              placeholder="Filter by year"
              className="w-full rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-900/30"
            />
            {raceId ? <input type="hidden" name="raceId" value={raceId} /> : null}
            {raceQuery ? <input type="hidden" name="raceQuery" value={raceQuery} /> : null}
          </form>
          <div className="mt-5 grid gap-3">
            {raceId ? (
              filteredResultItems.length > 0 ? (
                filteredResultItems.map((item) => (
                  <Link
                    key={item.path}
                    href={`/races?raceId=${encodeURIComponent(item.raceId)}&resultsYear=${encodeURIComponent(item.year)}${raceQuery ? `&raceQuery=${encodeURIComponent(raceQuery)}` : ""}${resultsQuery ? `&resultsQuery=${encodeURIComponent(resultsQuery)}` : ""}`}
                    className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 transition hover:border-stone-900/25 hover:bg-stone-100"
                  >
                    <p className="font-semibold text-stone-900">{item.year}</p>
                    <p className="mt-1 text-sm text-stone-600">{item.path}</p>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-stone-600">No results files matched the current filter.</p>
              )
            ) : (
              <p className="text-sm text-stone-600">Load a race page to enable results browsing.</p>
            )}
          </div>
        </article>

        <article className="rounded-[1.5rem] border border-stone-900/10 bg-stone-900 p-6 text-stone-50 shadow-[0_22px_55px_rgba(28,25,23,0.28)]">
          <h2 className="font-[family:var(--font-heading)] text-2xl">Results mode</h2>
          <p className="mt-4 text-base leading-7 text-stone-200">
            {resultInitialValues
              ? `Editing existing results file: ${resultInitialValues.year}.csv`
              : "Creating a new results draft, or load an existing CSV file for the selected race."}
          </p>
        </article>
      </section>
      <ResultsUploadForm initialValues={resultInitialValues} />
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
          <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
            Editorial workflows
          </h2>
          <ul className="mt-4 space-y-3 text-base leading-7 text-stone-700">
            {workflows.map((workflow) => (
              <li key={workflow}>{workflow}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-[1.5rem] border border-stone-900/10 bg-stone-900 p-6 text-stone-50 shadow-[0_22px_55px_rgba(28,25,23,0.28)]">
          <h2 className="font-[family:var(--font-heading)] text-2xl">
            Validation focus
          </h2>
          <p className="mt-4 text-base leading-7 text-stone-200">
            CSV uploads will reuse the existing SHR validation logic for headers, time
            formats, and allowed runner categories before writing into the content repo.
          </p>
        </article>
      </section>
    </EditorialShell>
  );
}
