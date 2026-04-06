import { EditorialShell } from "@/components/editorial-shell";
import { NewsEditorForm } from "@/components/news-editor-form";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function NewsPage() {
  await requireEditorAccess();

  return (
    <EditorialShell
      eyebrow="New"
      title="Create news post"
      description="Write a new news article with title, date, excerpt, and markdown content."
    >
      <NewsEditorForm initialValues={null} />
    </EditorialShell>
  );
}
