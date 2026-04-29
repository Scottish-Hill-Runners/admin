import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
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

  // Check results in parallel for each past race
  const resultsChecks = await Promise.all(
    pastThisYearRaceIds.map(async (raceId) => {
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
                <Link
                  href={`/results/${encodeURIComponent(raceId)}/${currentYear}`}
                  className="block rounded-2xl border border-amber-400/50 bg-white px-5 py-4 text-sm font-semibold text-stone-900 transition hover:border-amber-500 hover:bg-amber-50"
                >
                  {raceId}
                </Link>
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
        {raceItems.length > 0 ? (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {raceItems.map((item) => (
              <li key={item.raceId}>
                <Link
                  href={`/results/${encodeURIComponent(item.raceId)}`}
                  className="block rounded-2xl border border-stone-900/10 bg-stone-50 px-5 py-4 text-sm font-semibold text-stone-900 transition hover:border-stone-900/25 hover:bg-white"
                >
                  {item.raceId}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 text-sm text-stone-500">No races found.</p>
        )}
      </section>
    </EditorialShell>
  );
}
