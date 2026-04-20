"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { InfoListItem } from "@/lib/content-types";

type InfoItemPickerProps = {
  items: InfoListItem[];
  initialQuery: string;
  selectedFilePath?: string;
};

function displayFilePath(filePath: string): string {
  return filePath;
}

export function InfoItemPicker({ items, initialQuery, selectedFilePath }: InfoItemPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [expanded, setExpanded] = useState<boolean>(!selectedFilePath);

  useEffect(() => {
    const currentQuery = searchParams.get("infoQuery") ?? "";
    if (currentQuery === query) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    if (query) {
      nextParams.set("infoQuery", query);
    } else {
      nextParams.delete("infoQuery");
    }
    const nextUrl = nextParams.toString() ? `${pathname}?${nextParams}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [pathname, query, router, searchParams]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => displayFilePath(item.filePath).toLowerCase().includes(normalized));
  }, [items, query]);

  const selectedItem = useMemo(
    () =>
      selectedFilePath !== undefined
        ? (items.find((item) => item.filePath === selectedFilePath) ?? null)
        : null,
    [items, selectedFilePath]
  );

  return (
    <article className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
            Open existing info markdown
          </h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Select an info/*.md file to edit its markdown content.
          </p>
        </div>
        {selectedItem ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded-full border border-stone-900/15 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-900/30 hover:bg-stone-100"
          >
            {expanded ? "Hide list" : "Show list"}
          </button>
        ) : null}
      </div>

      {selectedItem ? (
        <div className="mt-5 rounded-2xl border border-stone-900/10 bg-stone-100/70 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Editing now</p>
          <p className="mt-1 font-semibold text-stone-900">{displayFilePath(selectedItem.filePath)}</p>
        </div>
      ) : null}

      {expanded ? (
        <>
          <div className="mt-5">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by file path"
              className="w-full rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-900/30"
            />
          </div>
          <div className="mt-5 grid max-h-[20rem] gap-3 overflow-y-auto pr-1">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <Link
                  key={item.filePath}
                  href={`/info/edit?filePath=${encodeURIComponent(item.filePath)}${query ? `&infoQuery=${encodeURIComponent(query)}` : ""}`}
                  className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 transition hover:border-stone-900/25 hover:bg-stone-100"
                >
                  <p className="font-semibold text-stone-900">{displayFilePath(item.filePath)}</p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-stone-600">No pages matched the current filter.</p>
            )}
          </div>
        </>
      ) : null}
    </article>
  );
}
