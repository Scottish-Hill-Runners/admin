"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type NewYearInputProps = {
  raceId: string;
};

export function NewYearInput({ raceId }: NewYearInputProps) {
  const router = useRouter();
  const [year, setYear] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = year.trim();
    if (!trimmed) {
      return;
    }
    router.push(`/results/${encodeURIComponent(raceId)}/${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <label className="block flex-1 space-y-2">
        <span className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
          Add a new year
        </span>
        <input
          type="text"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder="e.g. 2024 or 2024-B"
          className="w-full rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-base text-stone-900 outline-none transition focus:border-stone-900/40"
        />
      </label>
      <button
        type="submit"
        disabled={!year.trim()}
        className="rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
      >
        Go
      </button>
    </form>
  );
}
