"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ChampionshipListItem } from "@/lib/content-types";

type ChampionshipItemPickerProps = {
  championshipItems: ChampionshipListItem[];
  initialQuery: string;
  selectedChampionshipId?: string;
  basePath?: string;
};

export function ChampionshipItemPicker({
  championshipItems,
  initialQuery,
  selectedChampionshipId,
  basePath = "/championships/edit",
}: ChampionshipItemPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const currentQuery = searchParams.get("championshipQuery") ?? "";
    if (currentQuery === query) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    if (query) {
      nextParams.set("championshipQuery", query);
    } else {
      nextParams.delete("championshipQuery");
    }
    const nextUrl = nextParams.toString() ? `${pathname}?${nextParams}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [pathname, query, router, searchParams]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return championshipItems;
    return championshipItems.filter((item) =>
      item.championshipId.toLowerCase().includes(normalized)
    );
  }, [championshipItems, query]);

  const selectedItem = useMemo(
    () =>
      selectedChampionshipId
        ? (championshipItems.find((item) => item.championshipId === selectedChampionshipId) ?? null)
        : null,
    [championshipItems, selectedChampionshipId]
  );

  const isExpanded = !selectedChampionshipId || expandedId === selectedChampionshipId;

  return (
    <article className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
            Open existing championship
          </h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Load an existing championship page into the editor, then update its year entries or
            description.
          </p>
        </div>
        {selectedChampionshipId ? (
          <button
            type="button"
            onClick={() =>
              setExpandedId((v) => (v === selectedChampionshipId ? null : selectedChampionshipId))
            }
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
          <p className="mt-1 font-semibold text-stone-900">{selectedItem.championshipId}</p>
        </div>
      ) : null}

      {isExpanded ? (
        <>
          <div className="mt-5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by championship ID"
              className="w-full rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-900/30"
            />
          </div>
          <div className="mt-5 grid max-h-[20rem] gap-3 overflow-y-auto pr-1">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <Link
                  key={item.championshipId}
                  href={`${basePath}?championshipId=${encodeURIComponent(item.championshipId)}${query ? `&championshipQuery=${encodeURIComponent(query)}` : ""}`}
                  className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 transition hover:border-stone-900/25 hover:bg-stone-100"
                >
                  <p className="font-semibold text-stone-900">{item.championshipId}</p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-stone-600">No championships matched the current filter.</p>
            )}
          </div>
        </>
      ) : null}
    </article>
  );
}
