import { EditorialShell } from "@/components/editorial-shell";
import { NewsEditorForm } from "@/components/news-editor-form";
import { NewsItemPicker } from "@/components/news-item-picker";
import { getNewsDraft, listNewsDrafts } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type NewsPageProps = {
  searchParams?: Promise<{ slug?: string; q?: string; mode?: string }>;
};

export default async function NewsPage({ searchParams }: NewsPageProps) {
  await requireEditorAccess();
  const params = await searchParams;
  const slug = params?.slug?.trim();
  const query = params?.q?.trim() ?? "";
  const mode = params?.mode?.trim();
  const isEditMode = mode === "edit" || Boolean(slug);
  const [initialValues, newsItems] = await Promise.all([
    slug ? getNewsDraft(slug) : Promise.resolve(null),
    listNewsDrafts(),
  ]);

  return (
    <EditorialShell
      eyebrow="MVP Flow"
      title="News Editor"
      description="Editors will create and revise news items through a structured form that writes markdown and frontmatter into the content repository."
    >
      <section className={`grid gap-6 ${isEditMode ? "lg:grid-cols-[0.85fr_1.15fr]" : ""}`}>
        {isEditMode ? (
          <NewsItemPicker
            newsItems={newsItems}
            initialQuery={query}
          />
        ) : null}
      </section>
      <NewsEditorForm
        key={initialValues?.slug ?? slug ?? "new"}
        initialValues={initialValues}
      />
    </EditorialShell>
  );
}
