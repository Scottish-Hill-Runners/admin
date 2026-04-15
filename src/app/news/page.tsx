import { EditorialShell } from "@/components/editorial-shell";
import { NewsEditorForm } from "@/components/news-editor-form";
import { suggestNewsSlugSuffixForDate } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function NewsPage() {
  await requireEditorAccess();
  const suggestedDate = new Date().toISOString().slice(0, 10);
  const suggestedSlugSuffix = await suggestNewsSlugSuffixForDate(suggestedDate);

  return (
    <EditorialShell
      eyebrow="New"
      title="Create news post"
      description="Write a new news article with title, date, excerpt, and markdown content."
    >
      <NewsEditorForm
        initialValues={null}
        suggestedDate={suggestedDate}
        suggestedSlugSuffix={suggestedSlugSuffix}
      />
    </EditorialShell>
  );
}
