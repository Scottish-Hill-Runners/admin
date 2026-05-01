import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { RaceEditorForm } from "@/components/race-editor-form";
import { getRaceDraft, listRaceResultsDrafts } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type RaceEditPageProps = {
  params: Promise<{ raceId: string }>;
};

export default async function RaceEditPage({ params }: RaceEditPageProps) {
  const { raceId } = await params;
  await requireEditorAccess({ callbackUrl: `/races/${raceId}` });

  const [initialValues, resultItems] = await Promise.all([
    getRaceDraft(raceId),
    listRaceResultsDrafts(raceId),
  ]);

  return (
    <EditorialShell
      eyebrow="Edit race"
      title={initialValues?.title ?? raceId}
      description={`Edit metadata and route description for ${initialValues?.title ?? raceId}.`}
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link href="/races" className="hover:text-stone-900 hover:underline underline-offset-4">
          Races
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">{raceId}</span>
      </nav>

      {/* ── Race management panel ──────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Results card */}
        <div className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
          <h2 className="font-[family:var(--font-heading)] text-xl text-stone-900">
            Results
          </h2>
          {resultItems.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {resultItems.map((item) => (
                <li key={item.year}>
                  <Link
                    href={`/results/${encodeURIComponent(raceId)}/${item.year}`}
                    className="inline-block rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:bg-white"
                  >
                    {item.year}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-stone-400">No results yet.</p>
          )}
          <Link
            href={`/results/${encodeURIComponent(raceId)}`}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-800 hover:underline underline-offset-4"
          >
            <span>Manage results</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        {/* Assets card */}
        <div className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
          <h2 className="font-[family:var(--font-heading)] text-xl text-stone-900">
            Map &amp; Route
          </h2>
          <p className="mt-3 text-sm text-stone-500">
            Upload a map image or GPX route file for this race.
          </p>
          <Link
            href={`/race-assets/${encodeURIComponent(raceId)}`}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-800 hover:underline underline-offset-4"
          >
            <span>Upload assets</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      <RaceEditorForm
        key={initialValues?.raceId ?? raceId}
        initialValues={initialValues}
      />
    </EditorialShell>
  );
}

