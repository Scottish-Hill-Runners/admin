import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { InfoEditorForm } from "@/components/info-editor-form";
import { listInfoDrafts } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function InfoPage() {
  await requireEditorAccess({ callbackUrl: "/info" });
  const items = await listInfoDrafts();

  return (
    <EditorialShell
      eyebrow="Info"
      title="Info pages"
      description="Select a markdown file to edit, or create a new one."
    >
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
          All info files
        </h2>
        {items.length > 0 ? (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const encodedPath = item.filePath.split("/").map(encodeURIComponent).join("/");
              return (
                <li key={item.filePath}>
                  <Link
                    href={`/info/${encodedPath}`}
                    className="block rounded-2xl border border-stone-900/10 bg-stone-50 px-5 py-4 text-sm font-semibold text-stone-900 transition hover:border-stone-900/25 hover:bg-white"
                  >
                    {item.filePath}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-5 text-sm text-stone-500">No info files found.</p>
        )}
      </section>

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-6">
          Add new file
        </h2>
        <InfoEditorForm initialValues={null} />
      </section>
    </EditorialShell>
  );
}
