"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { RaceListItem } from "@/lib/content-types";

type RaceItemPickerProps = {
  raceItems: RaceListItem[];
  initialRaceQuery: string;
  resultsYear?: string;
  basePath?: string;
};

export function RaceItemPicker({
  raceItems,
  initialRaceQuery,
  resultsYear,
  basePath = "/races",
}: RaceItemPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [raceQuery, setRaceQuery] = useState(initialRaceQuery);

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

    return raceItems.filter((item) => {
      const haystack = `${item.title} ${item.raceId} ${item.venue}`.toLowerCase();
      return haystack.includes(normalizedRaceQuery);
    });
  }, [raceItems, raceQuery]);

  return (
    <article className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
      <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
        Open existing race
      </h2>
      <p className="mt-3 text-sm leading-6 text-stone-600">
        Load an existing race page into the editor, then update metadata or descriptive copy from one place.
      </p>
      <div className="mt-5">
        <input
          name="raceQuery"
          value={raceQuery}
          onChange={(event) => setRaceQuery(event.target.value)}
          placeholder="Filter by race title, ID, or venue"
          className="w-full rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-900/30"
        />
      </div>
      <div className="mt-5 grid gap-3 max-h-[28rem] overflow-y-auto pr-1">
        {filteredRaceItems.length > 0 ? (
          filteredRaceItems.map((item) => (
            <Link
              key={item.raceId}
              href={`${basePath}?raceId=${encodeURIComponent(item.raceId)}${resultsYear ? `&resultsYear=${encodeURIComponent(resultsYear)}` : ""}${raceQuery ? `&raceQuery=${encodeURIComponent(raceQuery)}` : ""}`}
              className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 transition hover:border-stone-900/25 hover:bg-stone-100"
            >
              <p className="font-semibold text-stone-900">{item.title}</p>
              <p className="mt-1 text-sm text-stone-600">{item.raceId}</p>
              {item.venue ? <p className="text-sm text-stone-500">{item.venue}</p> : null}
            </Link>
          ))
        ) : (
          <p className="text-sm text-stone-600">No races matched the current filter.</p>
        )}
      </div>
    </article>
  );
}
