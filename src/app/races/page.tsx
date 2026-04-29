import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { RaceEditorForm } from "@/components/race-editor-form";
import { listRaceDrafts } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function RacesPage() {
  await requireEditorAccess({ callbackUrl: "/races" });
  const raceItems = await listRaceDrafts();

  return (
    <EditorialShell
      eyebrow="Races"
      title="Race catalogue"
      description="Select a race to edit its metadata and route description, or create a new entry."
    >
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
          All races
        </h2>
        {raceItems.length > 0 ? (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {raceItems.map((item) => (
              <li key={item.raceId}>
                <Link
                  href={`/races/${encodeURIComponent(item.raceId)}`}
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

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-6">
          Add new race
        </h2>
        <RaceEditorForm initialValues={null} />
      </section>
    </EditorialShell>
  );
}
