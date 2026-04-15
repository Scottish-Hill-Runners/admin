"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { NewsListItem } from "@/lib/content-types";

type NewsItemPickerProps = {
  newsItems: NewsListItem[];
  initialQuery: string;
  selectedSlug?: string;
};

export function NewsItemPicker({ newsItems, initialQuery, selectedSlug }: NewsItemPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  useEffect(() => {
    const currentQuery = searchParams.get("q") ?? "";
    if (currentQuery === query) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    if (query) {
      nextParams.set("q", query);
    } else {
      nextParams.delete("q");
    }

    const nextQuery = nextParams.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [pathname, query, router, searchParams]);

  const filteredNewsItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return newsItems;
    }

    return newsItems.filter((item) => {
      return item.title.toLowerCase().includes(normalizedQuery) ||
       item.date.includes(normalizedQuery);
    });
  }, [newsItems, query]);

  const selectedNewsItem = useMemo(() => {
    if (!selectedSlug) {
      return null;
    }

    return newsItems.find((item) => item.slug === selectedSlug) ?? null;
  }, [newsItems, selectedSlug]);

  const isExpanded = !selectedSlug || expandedSlug === selectedSlug;

  return (
    <article className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
            Open existing news
          </h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Choose an existing news item to preload it into the editor, or stay on this page to create a new draft.
          </p>
        </div>
        {selectedSlug ? (
          <button
            type="button"
            onClick={() => {
              setExpandedSlug((value) => (value === selectedSlug ? null : selectedSlug));
            }}
            className="rounded-full border border-stone-900/15 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-900/30 hover:bg-stone-100"
          >
            {isExpanded ? "Hide list" : "Show list"}
          </button>
        ) : null}
      </div>

      {selectedNewsItem ? (
        <div className="mt-5 rounded-2xl border border-stone-900/10 bg-stone-100/70 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
            Editing now
          </p>
          <p className="mt-1 font-semibold text-stone-900">{selectedNewsItem.title}</p>
          {selectedNewsItem.date ? <p className="text-sm text-stone-600">{selectedNewsItem.date}</p> : null}
        </div>
      ) : null}

      {isExpanded ? (
        <>
          <div className="mt-5">
            <input
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by title or date"
              className="w-full rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-900/30"
            />
          </div>

          <div className="mt-5 grid max-h-[20rem] gap-3 overflow-y-auto pr-1">
            {filteredNewsItems.length > 0 ? (
              filteredNewsItems.map((item) => (
                <Link
                  key={item.slug}
                  href={`/news/edit?slug=${encodeURIComponent(item.slug)}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                  className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 transition hover:border-stone-900/25 hover:bg-stone-100"
                >
                  <p className="font-semibold text-stone-900">{item.title}</p>
                  {item.date ? <p className="text-sm text-stone-500">{item.date}</p> : null}
                </Link>
              ))
            ) : (
              <p className="text-sm text-stone-600">No news items matched the current filter.</p>
            )}
          </div>
        </>
      ) : null}
    </article>
  );
}
