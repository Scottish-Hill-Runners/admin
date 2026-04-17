"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { RaceListItem } from "@/lib/content-types";

type RaceItemPickerProps = {
  raceItems: RaceListItem[];
  initialRaceQuery: string;
  selectedRaceId?: string;
  resultsYear?: string;
  basePath?: string;
};

export function RaceItemPicker({
  raceItems,
  initialRaceQuery,
  selectedRaceId,
  resultsYear,
  basePath = "/races",
}: RaceItemPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [raceQuery, setRaceQuery] = useState(initialRaceQuery);
  const [expandedRaceId, setExpandedRaceId] = useState<string | null>(null);

  useEffect(() => {
    const currentQuery = searchParams.get("raceQuery") ?? "";
    if (currentQuery === raceQuery) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    if (raceQuery) {
      nextParams.set("raceQuery", raceQuery);
    } else {
      nextParams.delete("raceQuery");
    }

    const nextQuery = nextParams.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [pathname, raceQuery, router, searchParams]);

  const filteredRaceItems = useMemo(() => {
    const normalizedRaceQuery = raceQuery.trim().toLowerCase();
    if (!normalizedRaceQuery) {
      return raceItems;
    }

    return raceItems.filter((item) =>
      item.raceId.toLowerCase().includes(normalizedRaceQuery)
    );
  }, [raceItems, raceQuery]);

  const selectedRaceItem = useMemo(() => {
    if (!selectedRaceId) {
      return null;
    }

    return raceItems.find((item) => item.raceId === selectedRaceId) ?? null;
  }, [raceItems, selectedRaceId]);

  const isExpanded = !selectedRaceId || expandedRaceId === selectedRaceId;

  return (
    <article className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
            Open existing race
          </h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Load an existing race page into the editor, then update metadata or descriptive copy from one place.
          </p>
        </div>
        {selectedRaceId ? (
          <button
            type="button"
            onClick={() => {
              setExpandedRaceId((value) => (value === selectedRaceId ? null : selectedRaceId));
            }}
            className="rounded-full border border-stone-900/15 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-900/30 hover:bg-stone-100"
          >
            {isExpanded ? "Hide list" : "Show list"}
          </button>
        ) : null}
      </div>

      {selectedRaceItem ? (
        <div className="mt-5 rounded-2xl border border-stone-900/10 bg-stone-100/70 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
            Editing now
          </p>
          <p className="mt-1 font-semibold text-stone-900">{selectedRaceItem.raceId}</p>
        </div>
      ) : null}

      {isExpanded ? (
        <>
          <div className="mt-5">
            <input
              name="raceQuery"
              value={raceQuery}
              onChange={(event) => setRaceQuery(event.target.value)}
              placeholder="Filter by race ID"
              className="w-full rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-900/30"
            />
          </div>
          <div className="mt-5 grid max-h-[20rem] gap-3 overflow-y-auto pr-1">
            {filteredRaceItems.length > 0 ? (
              filteredRaceItems.map((item) => (
                <Link
                  key={item.raceId}
                  href={`${basePath}?raceId=${encodeURIComponent(item.raceId)}${resultsYear ? `&year=${encodeURIComponent(resultsYear)}` : ""}${raceQuery ? `&raceQuery=${encodeURIComponent(raceQuery)}` : ""}`}
                  className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 transition hover:border-stone-900/25 hover:bg-stone-100"
                >
                  <p className="font-semibold text-stone-900">{item.raceId}</p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-stone-600">No races matched the current filter.</p>
            )}
          </div>
        </>
      ) : null}
    </article>
  );
}
