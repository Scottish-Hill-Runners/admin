import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { listChampionshipDrafts } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function ChampionshipsPage() {
  await requireEditorAccess({ callbackUrl: "/championships" });
  const items = await listChampionshipDrafts();

  return (
    <EditorialShell
      eyebrow="Championships"
      title="Championships"
      description="Select a championship to edit its race schedule and description."
    >
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
          All championships
        </h2>
        {items.length > 0 ? (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li key={item.championshipId}>
                <Link
                  href={`/championships/${encodeURIComponent(item.championshipId)}`}
                  className="block rounded-2xl border border-stone-900/10 bg-stone-50 px-5 py-4 text-sm font-semibold text-stone-900 transition hover:border-stone-900/25 hover:bg-white"
                >
                  {item.championshipId}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 text-sm text-stone-500">No championships found.</p>
        )}
      </section>
    </EditorialShell>
  );
}
