import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { ClubEditorForm } from "@/components/club-editor-form";
import { listClubDrafts } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function ClubsPage() {
  await requireEditorAccess({ callbackUrl: "/clubs" });
  const clubItems = await listClubDrafts();

  return (
    <EditorialShell
      eyebrow="Clubs"
      title="Clubs"
      description="Select a club to edit its details, or add a new entry."
    >
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
          All clubs
        </h2>
        {clubItems.length > 0 ? (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clubItems.map((item) => (
              <li key={item.clubId}>
                <Link
                  href={`/clubs/${encodeURIComponent(item.clubId)}`}
                  className="block rounded-2xl border border-stone-900/10 bg-stone-50 px-5 py-4 text-sm font-semibold text-stone-900 transition hover:border-stone-900/25 hover:bg-white"
                >
                  {item.clubId}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 text-sm text-stone-500">No clubs found.</p>
        )}
      </section>

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-6">
          Add new club
        </h2>
        <ClubEditorForm initialValues={null} />
      </section>
    </EditorialShell>
  );
}
