import { EditorialShell } from "@/components/editorial-shell";
import { NewsEditorForm } from "@/components/news-editor-form";
import { suggestNewsSlugSuffixForDate } from "@/lib/github";
import { isIsoNewsDate } from "@/lib/news-slug";
import { requireEditorAccess } from "@/lib/route-protection";

type NewsPageProps = {
  searchParams?: Promise<{
    fromResults?: string;
    prefillDate?: string;
    prefillTitle?: string;
    prefillExcerpt?: string;
    prefillContent?: string;
  }>;
};

export default async function NewsPage({ searchParams }: NewsPageProps) {
  await requireEditorAccess();
  const params = await searchParams;
  const requestedDate = String(params?.prefillDate ?? "").trim();
  const suggestedDate = isIsoNewsDate(requestedDate)
    ? requestedDate
    : new Date().toISOString().slice(0, 10);
  const suggestedSlugSuffix = await suggestNewsSlugSuffixForDate(suggestedDate);
  const fromResults = params?.fromResults === "1";
  const prefill = {
    title: String(params?.prefillTitle ?? "").trim(),
    excerpt: String(params?.prefillExcerpt ?? "").trim(),
    content: String(params?.prefillContent ?? "").trim(),
    fromResults,
  };

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
        prefillValues={prefill}
      />
    </EditorialShell>
  );
}
