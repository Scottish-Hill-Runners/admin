import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { listRaceDrafts } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function ResultsPage() {
  await requireEditorAccess({ callbackUrl: "/results" });
  const raceItems = await listRaceDrafts();

  return (
    <EditorialShell
      eyebrow="Results"
      title="Race results"
      description="Choose a race to view, edit, or add results files."
    >
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
