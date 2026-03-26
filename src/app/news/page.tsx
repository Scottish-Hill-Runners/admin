import { EditorialShell } from "@/components/editorial-shell";
import { NewsEditorForm } from "@/components/news-editor-form";
import Link from "next/link";
import { getNewsDraft, listNewsDrafts } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type NewsPageProps = {
  searchParams?: Promise<{ slug?: string; q?: string }>;
};

export default async function NewsPage({ searchParams }: NewsPageProps) {
  const { email } = await requireEditorAccess();
  const params = await searchParams;
  const slug = params?.slug?.trim();
  const query = params?.q?.trim() ?? "";
  const [initialValues, newsItems] = await Promise.all([
    slug ? getNewsDraft(slug) : Promise.resolve(null),
    listNewsDrafts(),
  ]);
  const normalizedQuery = query.toLowerCase();
  const filteredNewsItems = normalizedQuery
    ? newsItems.filter((item) => {
        const haystack = `${item.title} ${item.slug} ${item.date}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : newsItems;

  return (
    <EditorialShell
      eyebrow="MVP Flow"
      title="News Editor"
      description="Editors will create and revise news items through a structured form that writes markdown and frontmatter into the content repository."
    >
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/80 px-6 py-4 text-sm text-stone-700 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        Signed in as {email}
      </section>
      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <article className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
          <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
            Open existing news
          </h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Choose an existing news item to preload it into the editor, or stay on this page to create a new draft.
          </p>
          <form className="mt-5">
            <input
              name="q"
              defaultValue={query}
              placeholder="Filter by title, slug, or date"
              className="w-full rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-900/30"
            />
            {slug ? <input type="hidden" name="slug" value={slug} /> : null}
          </form>
          <div className="mt-5 grid gap-3 max-h-[28rem] overflow-y-auto pr-1">
            {filteredNewsItems.length > 0 ? (
              filteredNewsItems.map((item) => (
                <Link
                  key={item.slug}
                  href={`/news?slug=${encodeURIComponent(item.slug)}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                  className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 transition hover:border-stone-900/25 hover:bg-stone-100"
                >
                  <p className="font-semibold text-stone-900">{item.title}</p>
                  <p className="mt-1 text-sm text-stone-600">{item.slug}</p>
                  {item.date ? <p className="text-sm text-stone-500">{item.date}</p> : null}
                </Link>
              ))
            ) : (
              <p className="text-sm text-stone-600">No news items matched the current filter.</p>
            )}
          </div>
        </article>

        <article className="rounded-[1.5rem] border border-stone-900/10 bg-stone-900 p-6 text-stone-50 shadow-[0_22px_55px_rgba(28,25,23,0.28)]">
          <h2 className="font-[family:var(--font-heading)] text-2xl">Editor mode</h2>
          <p className="mt-4 text-base leading-7 text-stone-200">
            {initialValues
              ? `Editing existing item: ${initialValues.data.title}`
              : "Creating a new news draft. Use the list to load an existing item."}
          </p>
        </article>
      </section>
      <NewsEditorForm initialValues={initialValues} />
    </EditorialShell>
  );
}
