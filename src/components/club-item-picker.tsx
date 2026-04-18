"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ClubListItem } from "@/lib/content-types";

type ClubItemPickerProps = {
  clubItems: ClubListItem[];
  initialClubQuery: string;
  selectedClubId?: string;
  basePath?: string;
};

export function ClubItemPicker({
  clubItems,
  initialClubQuery,
  selectedClubId,
  basePath = "/clubs/edit",
}: ClubItemPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [clubQuery, setClubQuery] = useState(initialClubQuery);
  const [expandedClubId, setExpandedClubId] = useState<string | null>(null);

  useEffect(() => {
    const currentQuery = searchParams.get("clubQuery") ?? "";
    if (currentQuery === clubQuery) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    if (clubQuery) {
      nextParams.set("clubQuery", clubQuery);
    } else {
      nextParams.delete("clubQuery");
    }

    const nextQuery = nextParams.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [pathname, clubQuery, router, searchParams]);

  const filteredClubItems = useMemo(() => {
    const normalizedQuery = clubQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return clubItems;
    }

    return clubItems.filter((item) =>
      item.clubId.toLowerCase().includes(normalizedQuery)
    );
  }, [clubItems, clubQuery]);

  const selectedClubItem = useMemo(() => {
    if (!selectedClubId) {
      return null;
    }

    return clubItems.find((item) => item.clubId === selectedClubId) ?? null;
  }, [clubItems, selectedClubId]);

  const isExpanded = !selectedClubId || expandedClubId === selectedClubId;

  return (
    <article className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
            Open existing club
          </h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Load an existing club page into the editor, then update its details or description.
          </p>
        </div>
        {selectedClubId ? (
          <button
            type="button"
            onClick={() => {
              setExpandedClubId((value) => (value === selectedClubId ? null : selectedClubId));
            }}
            className="rounded-full border border-stone-900/15 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-900/30 hover:bg-stone-100"
          >
            {isExpanded ? "Hide list" : "Show list"}
          </button>
        ) : null}
      </div>

      {selectedClubItem ? (
        <div className="mt-5 rounded-2xl border border-stone-900/10 bg-stone-100/70 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
            Editing now
          </p>
          <p className="mt-1 font-semibold text-stone-900">{selectedClubItem.clubId}</p>
        </div>
      ) : null}

      {isExpanded ? (
        <>
          <div className="mt-5">
            <input
              name="clubQuery"
              value={clubQuery}
              onChange={(event) => setClubQuery(event.target.value)}
              placeholder="Filter by club ID"
              className="w-full rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-900/30"
            />
          </div>
          <div className="mt-5 grid max-h-[20rem] gap-3 overflow-y-auto pr-1">
            {filteredClubItems.length > 0 ? (
              filteredClubItems.map((item) => (
                <Link
                  key={item.clubId}
                  href={`${basePath}?clubId=${encodeURIComponent(item.clubId)}${clubQuery ? `&clubQuery=${encodeURIComponent(clubQuery)}` : ""}`}
                  className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 transition hover:border-stone-900/25 hover:bg-stone-100"
                >
                  <p className="font-semibold text-stone-900">{item.clubId}</p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-stone-600">No clubs matched the current filter.</p>
            )}
          </div>
        </>
      ) : null}
    </article>
  );
}
