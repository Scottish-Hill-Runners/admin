import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { NewsEditorForm } from "@/components/news-editor-form";
import { listNewsDrafts, suggestNewsSlugSuffixForDate } from "@/lib/github";
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
  await requireEditorAccess({ callbackUrl: "/news" });
  const [newsItems, params] = await Promise.all([listNewsDrafts(), searchParams]);
  const requestedDate = String(params?.prefillDate ?? "").trim();
  const suggestedDate = isIsoNewsDate(requestedDate)
    ? requestedDate
    : new Date().toISOString().slice(0, 10);
  const suggestedSlugSuffix = await suggestNewsSlugSuffixForDate(suggestedDate);
  const prefill = {
    slug: `${suggestedDate}-${suggestedSlugSuffix}`,
    data: {
      date: suggestedDate,
      title: String(params?.prefillTitle ?? "").trim(),
      excerpt: String(params?.prefillExcerpt ?? "").trim()
    },
    content: String(params?.prefillContent ?? "").trim(),
    fromResults: params?.fromResults === "1"
  };

  return (
    <EditorialShell
      eyebrow="News"
      title="News posts"
      description="Select a news post to edit, or create a new one."
    >
      <details className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
          <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
            Recent posts
          </h2>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-600">
            Expand or collapse
          </span>
        </summary>
        {newsItems.length > 0 ? (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {newsItems.map((item) => {
              const [year, ...rest] = item.slug.split("/");
              const slugTail = rest.join("/");
              return (
                <li key={item.slug}>
                  <Link
                    href={`/news/${encodeURIComponent(year)}/${encodeURIComponent(slugTail)}`}
                    className="block rounded-2xl border border-stone-900/10 bg-stone-50 px-5 py-4 transition hover:border-stone-900/25 hover:bg-white"
                  >
                    <p className="text-xs text-stone-500">{year}</p>
                    <p className="mt-0.5 text-sm font-semibold text-stone-900">{slugTail}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-5 text-sm text-stone-500">No news posts found.</p>
        )}
      </details>
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-6">
          Add new post
        </h2>
        <NewsEditorForm
          initialValues={prefill}
          suggestedDate={suggestedDate}
          suggestedSlugSuffix={suggestedSlugSuffix}
        />
      </section>
    </EditorialShell>
  );
}
