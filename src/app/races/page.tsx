import { EditorialShell } from "@/components/editorial-shell";
import { RaceEditorForm } from "@/components/race-editor-form";
import { RaceSearchList } from "@/components/race-search-list";
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
      <details
        open
        className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
          <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
            All races
          </h2>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-600">
            Expand or collapse
          </span>
        </summary>
        <div className="mt-5">
          <RaceSearchList
            raceItems={raceItems}
            hrefPrefix="/races"
          />
        </div>
      </details>

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-6">
          Add new race
        </h2>
        <RaceEditorForm initialValues={null} />
      </section>
    </EditorialShell>
  );
}
