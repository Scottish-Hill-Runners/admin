import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { NewsEditorForm } from "@/components/news-editor-form";
import { getNewsDraft, toSafeGitRef } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type NewsEditPageProps = {
  params: Promise<{ year: string; slug: string }>;
  searchParams?: Promise<{ ref?: string }>;
};

export default async function NewsEditPage({ params, searchParams }: NewsEditPageProps) {
  const { year, slug } = await params;
  const rawSearch = await searchParams;
  const ref = toSafeGitRef(rawSearch?.ref);
  const fullSlug = `${year}/${slug}`;
  await requireEditorAccess({ callbackUrl: `/news/${year}/${slug}` });

  const initialValues = await getNewsDraft(fullSlug, { ref });

  return (
    <EditorialShell
      eyebrow="Edit post"
      title={initialValues?.data.title ?? slug}
      description={`Edit news post ${fullSlug}.`}
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link href="/news" className="hover:text-stone-900 hover:underline underline-offset-4">
          News
        </Link>
        <span aria-hidden="true">›</span>
        <span className="text-stone-600">{year}</span>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">{slug}</span>
      </nav>
      <NewsEditorForm
        key={initialValues?.slug ?? fullSlug}
        initialValues={initialValues ?? null}
        suggestedDate={initialValues?.data.date ?? new Date().toISOString().slice(0, 10)}
        suggestedSlugSuffix={slug}
      />
    </EditorialShell>
  );
}
