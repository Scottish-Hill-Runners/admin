"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { RaceResultListItem } from "@/lib/content-types";

type ResultsItemPickerProps = {
  raceId?: string;
  resultItems: RaceResultListItem[];
  raceQuery?: string;
  basePath?: string;
};

export function ResultsItemPicker({
  raceId,
  resultItems,
  raceQuery,
  basePath = "/results/edit",
}: ResultsItemPickerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filteredResultItems = useMemo(() => resultItems, [resultItems]);
  const selectedYear = searchParams.get("resultsYear") ?? "";

  function buildResultsHref(year: string, itemRaceId: string): string {
    return `${basePath}?raceId=${encodeURIComponent(itemRaceId)}&resultsYear=${encodeURIComponent(year)}${raceQuery ? `&raceQuery=${encodeURIComponent(raceQuery)}` : ""}`;
  }

  return (
    <article className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
      <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
        Open existing results
      </h2>
      <p className="mt-3 text-sm leading-6 text-stone-600">
        {raceId
          ? "Choose an existing CSV result file for this race and load it into the editor."
          : "Select a race first to browse existing result CSV files."}
      </p>
      <div className="mt-5 grid gap-3">
        {raceId ? (
          filteredResultItems.length > 0 ? (
            <label className="block space-y-2">
              <span className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
                Results year
              </span>
              <select
                value={selectedYear}
                onChange={(event) => {
                  const nextYear = event.target.value;
                  if (!nextYear) {
                    return;
                  }

                  const selectedItem = filteredResultItems.find((item) => item.year === nextYear);
                  if (!selectedItem) {
                    return;
                  }

                  router.push(buildResultsHref(selectedItem.year, selectedItem.raceId));
                }}
                className="w-full rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-900/30"
              >
                <option value="">Select a results file...</option>
                {filteredResultItems.map((item) => (
                  <option key={item.path} value={item.year}>
                    {item.year} ({item.path})
                  </option>
                ))}
              </select>
              {selectedYear ? (
                <div>
                  {filteredResultItems
                    .filter((item) => item.year === selectedYear)
                    .map((item) => (
                      <Link
                        key={item.path}
                        href={buildResultsHref(item.year, item.raceId)}
                        className="inline-flex text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
                      >
                        Open {item.path}
                      </Link>
                    ))}
                </div>
              ) : null}
            </label>
          ) : (
            <p className="text-sm text-stone-600">No results files matched the current filter.</p>
          )
        ) : (
          <p className="text-sm text-stone-600">Load a race page to enable results browsing.</p>
        )}
      </div>
    </article>
  );
}
