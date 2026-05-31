"use client";

import Link from "next/link";
import { useState } from "react";
import type { RaceListItem } from "@/lib/content-types";

type RaceSearchListProps = {
  raceItems: RaceListItem[];
  hrefPrefix: string;
  hrefSuffix?: string;
  emptyMessage?: string;
};

export function RaceSearchList({
  raceItems,
  hrefPrefix,
  hrefSuffix = "",
  emptyMessage = "No races found.",
}: RaceSearchListProps) {
  const [query, setQuery] = useState("");

  const filtered =
    query.trim() === ""
      ? raceItems
      : raceItems.filter((item) =>
          item.raceId.toLowerCase().includes(query.toLowerCase().trim()),
        );

  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter races…"
          aria-label="Filter races by ID"
          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2 pl-9 text-sm text-stone-900 shadow-sm placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
        />
        <svg
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>
      </div>

      {filtered.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <li key={item.raceId}>
              <Link
                href={`${hrefPrefix}/${encodeURIComponent(item.raceId)}${hrefSuffix}`}
                className="block rounded-2xl border border-stone-900/10 bg-stone-50 px-5 py-4 text-sm font-semibold text-stone-900 transition hover:border-stone-900/25 hover:bg-white"
              >
                {item.raceId}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-500">
          {query.trim() !== "" ? `No races match "${query}".` : emptyMessage}
        </p>
      )}
    </div>
  );
}
