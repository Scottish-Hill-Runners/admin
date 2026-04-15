import { EditorialShell } from "@/components/editorial-shell";
import { NewsEditorForm } from "@/components/news-editor-form";
import { NewsItemPicker } from "@/components/news-item-picker";
import { getNewsDraft, listNewsDrafts } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type NewsEditPageProps = {
  searchParams?: Promise<{ slug?: string; q?: string }>;
};

export default async function NewsEditPage({ searchParams }: NewsEditPageProps) {
  await requireEditorAccess();
  const params = await searchParams;
  const slug = params?.slug?.trim();
  const query = params?.q?.trim() ?? "";

  const [initialValues, newsItems] = await Promise.all([
    slug ? getNewsDraft(slug) : Promise.resolve(null),
    listNewsDrafts(),
  ]);

  return (
    <EditorialShell
      eyebrow="Edit"
      title="Edit news post"
      description="Select an existing news item to load it into the editor."
    >
      <section>
        <NewsItemPicker newsItems={newsItems} initialQuery={query} selectedSlug={slug} />
      </section>
      {slug ? (
        <NewsEditorForm
          key={initialValues?.slug ?? slug}
          initialValues={initialValues}
        />
      ) : null}
    </EditorialShell>
  );
}
