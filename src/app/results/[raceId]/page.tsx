import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { getRaceDraft, listRaceResultsDrafts } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";
import { NewYearInput } from "./new-year-input";

type RaceResultsHubPageProps = {
  params: Promise<{ raceId: string }>;
  searchParams?: Promise<{ returnToWorkflow?: string }>;
};

function toSafeReturnPath(value: string | undefined): string | undefined {
  const trimmed = String(value ?? "").trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return undefined;
  }

  return trimmed;
}

export default async function RaceResultsHubPage({ params, searchParams }: RaceResultsHubPageProps) {
  const { raceId } = await params;
  const rawSearch = await searchParams;
  const returnToWorkflow = toSafeReturnPath(rawSearch?.returnToWorkflow);
  const isRunnerWorkflow = returnToWorkflow?.startsWith("/workflows/runner") ?? false;
  const returnSuffix = returnToWorkflow
    ? `?returnToWorkflow=${encodeURIComponent(returnToWorkflow)}`
    : "";
  await requireEditorAccess({ callbackUrl: `/results/${raceId}` });

  const [raceDraft, resultItems] = await Promise.all([
    getRaceDraft(raceId),
    listRaceResultsDrafts(raceId),
  ]);

  return (
    <EditorialShell
      eyebrow="Results"
      title={raceDraft?.title ?? raceId}
      description={`Manage results files for ${raceDraft?.title ?? raceId}.`}
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link href="/results" className="hover:text-stone-900 hover:underline underline-offset-4">
          Results
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">{raceId}</span>
      </nav>

      {raceDraft ? (
        <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
                {raceDraft.title}
              </h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
                {raceDraft.venue ? (
                  <>
                    <dt className="font-semibold text-stone-600">Venue</dt>
                    <dd className="col-span-1 text-stone-900 sm:col-span-2">{raceDraft.venue}</dd>
                  </>
                ) : null}
                {raceDraft.distance ? (
                  <>
                    <dt className="font-semibold text-stone-600">Distance</dt>
                    <dd className="col-span-1 text-stone-900 sm:col-span-2">{raceDraft.distance}</dd>
                  </>
                ) : null}
                {raceDraft.climb ? (
                  <>
                    <dt className="font-semibold text-stone-600">Climb</dt>
                    <dd className="col-span-1 text-stone-900 sm:col-span-2">{raceDraft.climb}</dd>
                  </>
                ) : null}
                {raceDraft.organiser ? (
                  <>
                    <dt className="font-semibold text-stone-600">Organiser</dt>
                    <dd className="col-span-1 text-stone-900 sm:col-span-2">{raceDraft.organiser}</dd>
                  </>
                ) : null}
              </dl>
            </div>
            <Link
              href={`/races/edit?raceId=${encodeURIComponent(raceId)}`}
              className="rounded-full border border-stone-900/15 bg-stone-50 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-white hover:border-stone-900/30"
            >
              Edit race metadata
            </Link>
          </div>
        </section>
      ) : (
        <section className="rounded-[1.5rem] border border-amber-500/40 bg-amber-100/80 p-6 text-amber-900 shadow-[0_10px_30px_rgba(120,53,15,0.12)]">
          <p className="text-sm font-semibold uppercase tracking-[0.16em]">Race metadata not found</p>
          <p className="mt-2 text-sm leading-6">
            No metadata file exists for <span className="font-semibold">{raceId}</span>.{" "}
            <Link href="/races" className="underline underline-offset-4 hover:no-underline">
              Create race metadata
            </Link>{" "}
            to add venue, distance, and other details.
          </p>
        </section>
      )}

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
          Existing results
        </h2>
        {resultItems.length > 0 ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {resultItems.map((item) => (
              <li key={item.year}>
                <Link
                  href={`/results/${encodeURIComponent(raceId)}/${encodeURIComponent(item.year)}${returnSuffix}`}
                  className="block rounded-2xl border border-stone-900/10 bg-stone-50 px-5 py-4 text-sm font-semibold text-stone-900 transition hover:border-stone-900/25 hover:bg-white"
                >
                  {item.year}
                  <span className="mt-1 block text-xs font-normal text-stone-500">{item.path}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-stone-500">No results files found for this race.</p>
        )}
      </section>

      {!isRunnerWorkflow ? (
        <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
          <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
            Add new results
          </h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Enter the year (or a year suffix like <span className="font-mono">2024-B</span> for a second race) to create a new results file.
          </p>
          <div className="mt-5">
            <NewYearInput raceId={raceId} returnToWorkflowUrl={returnToWorkflow} />
          </div>
        </section>
      ) : null}
    </EditorialShell>
  );
}
