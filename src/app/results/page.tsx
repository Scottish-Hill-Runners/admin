import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { RaceSearchList } from "@/components/race-search-list";
import { getCalendarDraft, listRaceDrafts, listRaceResultsDrafts } from "@/lib/github";
import { parseCalendarCsvRows } from "@/lib/calendar-csv";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function ResultsPage() {
  await requireEditorAccess({ callbackUrl: "/results" });

  const today = new Date().toISOString().slice(0, 10);
  const currentYear = today.slice(0, 4);

  const [raceItems, calendarDraft] = await Promise.all([
    listRaceDrafts(),
    getCalendarDraft(),
  ]);

  const knownRaceIds = new Set(raceItems.map((item) => item.raceId));

  // Find races in the calendar that have passed this year but may lack results
  const calendarRows = calendarDraft ? parseCalendarCsvRows(calendarDraft.csvText) : [];
  const pastThisYearRaceIds = [
    ...new Set(
      calendarRows
        .filter(([date]) => date >= `${currentYear}-01-01` && date < today)
        .map(([, raceId]) => raceId)
        .filter(Boolean)
    ),
  ];

  // Only check results for race IDs that have a known race file — others can't be fetched
  const knownPastRaceIds = pastThisYearRaceIds.filter((raceId) => knownRaceIds.has(raceId));
  const resultsChecks = await Promise.all(
    knownPastRaceIds.map(async (raceId) => {
      const items = await listRaceResultsDrafts(raceId);
      const hasCurrentYear = items.some((item) => item.year === currentYear || item.year.startsWith(`${currentYear}-`));
      return { raceId, hasCurrentYear };
    })
  );
  const missingResultsRaceIds = resultsChecks
    .filter(({ hasCurrentYear }) => !hasCurrentYear)
    .map(({ raceId }) => raceId);

  return (
    <EditorialShell
      eyebrow="Results"
      title="Race results"
      description="Choose a race to view, edit, or add results files."
    >
      {missingResultsRaceIds.length > 0 && (
        <section className="rounded-[1.5rem] border border-amber-400/40 bg-amber-50/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
          <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
            Missing results — {currentYear}
          </h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            These races have already taken place this year but have no results file yet.
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {missingResultsRaceIds.map((raceId) => (
              <li key={raceId}>
                {knownRaceIds.has(raceId) ? (
                  <Link
                    href={`/results/${encodeURIComponent(raceId)}/${currentYear}`}
                    className="block rounded-2xl border border-amber-400/50 bg-white px-5 py-4 text-sm font-semibold text-stone-900 transition hover:border-amber-500 hover:bg-amber-50"
                  >
                    {raceId}
                  </Link>
                ) : (
                  <span
                    className="block rounded-2xl border border-amber-400/30 bg-white/50 px-5 py-4 text-sm font-semibold text-stone-400 cursor-not-allowed"
                    title="No race file found — add a race first"
                  >
                    {raceId}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
          All races
        </h2>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Select a race to manage its results files.
        </p>
        <div className="mt-5">
          <RaceSearchList
            raceItems={raceItems}
            hrefPrefix="/results"
          />
        </div>
      </section>
    </EditorialShell>
  );
}
