"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LongDistanceListItem } from "@/lib/content-types";

type LongDistanceItemPickerProps = {
  items: LongDistanceListItem[];
  initialQuery: string;
  selectedSlug?: string;
  basePath?: string;
};

export function LongDistanceItemPicker({
  items,
  initialQuery,
  selectedSlug,
  basePath = "/long-distance/edit",
}: LongDistanceItemPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  useEffect(() => {
    const currentQuery = searchParams.get("ldQuery") ?? "";
    if (currentQuery === query) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    if (query) {
      nextParams.set("ldQuery", query);
    } else {
      nextParams.delete("ldQuery");
    }
    const nextUrl = nextParams.toString() ? `${pathname}?${nextParams}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [pathname, query, router, searchParams]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => item.slug.toLowerCase().includes(normalized));
  }, [items, query]);

  const selectedItem = useMemo(
    () => (selectedSlug ? (items.find((item) => item.slug === selectedSlug) ?? null) : null),
    [items, selectedSlug]
  );

  const isExpanded = !selectedSlug || expandedSlug === selectedSlug;

  return (
    <article className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
            Open existing report
          </h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Load an existing long-distance report into the editor, then update its content.
          </p>
        </div>
        {selectedSlug ? (
          <button
            type="button"
            onClick={() => setExpandedSlug((v) => (v === selectedSlug ? null : selectedSlug))}
            className="rounded-full border border-stone-900/15 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-900/30 hover:bg-stone-100"
          >
            {isExpanded ? "Hide list" : "Show list"}
          </button>
        ) : null}
      </div>

      {selectedItem ? (
        <div className="mt-5 rounded-2xl border border-stone-900/10 bg-stone-100/70 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
            Editing now
          </p>
          <p className="mt-1 font-semibold text-stone-900">{selectedItem.slug}</p>
        </div>
      ) : null}

      {isExpanded ? (
        <>
          <div className="mt-5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by slug"
              className="w-full rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-900/30"
            />
          </div>
          <div className="mt-5 grid max-h-[20rem] gap-3 overflow-y-auto pr-1">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <Link
                  key={item.slug}
                  href={`${basePath}?slug=${encodeURIComponent(item.slug)}${query ? `&ldQuery=${encodeURIComponent(query)}` : ""}`}
                  className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 transition hover:border-stone-900/25 hover:bg-stone-100"
                >
                  <p className="font-semibold text-stone-900">{item.slug}</p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-stone-600">No reports matched the current filter.</p>
            )}
          </div>
        </>
      ) : null}
    </article>
  );
}
