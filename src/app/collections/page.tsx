import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function CollectionsPage() {
  await requireEditorAccess();

  return (
    <EditorialShell
      eyebrow="Assets"
      title="Manage image and document lists"
      description="Choose an editor for homepage images, documents, or committee portraits. Race image galleries are managed from each race page."
    >
      <section className="grid gap-5 md:grid-cols-3">
        <Link
          href="/collections/homepage"
          className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/20 hover:bg-white"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
            Homepage
          </p>
          <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">
            Homepage images
          </h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Upload to blobs/homepage and add decorative images to the homepage list.
          </p>
        </Link>

        <Link
          href="/collections/documents"
          className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/20 hover:bg-white"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
            Documents
          </p>
          <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">
            Document list
          </h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Upload PDFs, DOCX files, and other assets to blobs/documents and add them to the document list.
          </p>
        </Link>

        <Link
          href="/collections/committee"
          className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/20 hover:bg-white"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
            Committee
          </p>
          <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">
            Committee portraits
          </h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Upload portraits to blobs/portraits and add them to the committee portrait list.
          </p>
        </Link>
      </section>
    </EditorialShell>
  );
}
