"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { useActionState } from "react";
import {
  saveChampionshipDraft,
  type ChampionshipActionState,
} from "@/app/championships/actions";
import { MarkdownEditorField } from "@/components/markdown-editor-field";
import type { ChampionshipInfoFormData, ChampionshipYearEntry } from "@/lib/content-types";

const initialState: ChampionshipActionState = { status: "idle" };

type InputProps = {
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
  errors?: string[];
};

type ChampionshipEditorFormProps = {
  initialValues?: ChampionshipInfoFormData | null;
};

function InputField({ label, name, placeholder, defaultValue, errors }: InputProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
        {label}
      </span>
      <input
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-base text-stone-900 outline-none transition focus:border-stone-900/40"
      />
      {errors?.map((error) => (
        <p key={error} className="text-sm text-red-700">
          {error}
        </p>
      ))}
    </label>
  );
}

export function ChampionshipEditorForm({ initialValues }: ChampionshipEditorFormProps) {
  const [state, formAction, isPending] = useActionState(
    saveChampionshipDraft,
    initialState
  );
  const formId = useId();
  const [championshipIdValue, setChampionshipIdValue] = useState(
    initialValues?.championshipId ?? "ChampionshipId"
  );

  const [yearEntries, setYearEntries] = useState<ChampionshipYearEntry[]>(
    () =>
      initialValues?.yearEntries.length
        ? initialValues.yearEntries
        : [{ year: String(new Date().getFullYear()), races: "" }]
  );

  const yearEntriesJson = useMemo(() => JSON.stringify(yearEntries), [yearEntries]);

  const updateYear = useCallback((index: number, value: string) => {
    setYearEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], year: value };
      return next;
    });
  }, []);

  const updateRaces = useCallback((index: number, value: string) => {
    setYearEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], races: value };
      return next;
    });
  }, []);

  const addRow = useCallback(() => {
    setYearEntries((prev) => {
      const latestYear = prev[0]?.year ? parseInt(prev[0].year, 10) : new Date().getFullYear();
      const nextYear = isNaN(latestYear) ? new Date().getFullYear() : latestYear + 1;
      return [{ year: String(nextYear), races: "" }, ...prev];
    });
  }, []);

  const removeRow = useCallback((index: number) => {
    setYearEntries((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  return (
    <form
      action={formAction}
      className="grid gap-6"
      onInput={(event) => {
        const target = event.target as HTMLInputElement;
        if (target.name === "championshipId") {
          setChampionshipIdValue(target.value.trim() || "ChampionshipId");
        }
      }}
    >
      <input type="hidden" name="yearEntries" value={yearEntriesJson} />

      {/* Metadata + year entries */}
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <div className="grid gap-5 md:grid-cols-2">
          <InputField
            label="Championship ID"
            name="championshipId"
            placeholder="(letters, numbers, hyphens — e.g. 'BogAndBurn')"
            defaultValue={initialValues?.championshipId}
            errors={state.fieldErrors?.championshipId}
          />
          <InputField
            label="Title"
            name="title"
            placeholder="(e.g. 'Bog \'n Burn')"
            defaultValue={initialValues?.title}
            errors={state.fieldErrors?.title}
          />
        </div>

        {/* Year entries table */}
        <div className="mt-6">
          <div className="flex items-center justify-between gap-4 mb-3">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
              Race schedule by year
            </p>
            <button
              type="button"
              onClick={addRow}
              className="rounded-full border border-stone-900/15 px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:border-stone-900/30 hover:bg-stone-100"
            >
              + Add year
            </button>
          </div>
          {state.fieldErrors?.yearEntries?.map((error) => (
            <p key={error} className="mb-3 text-sm text-red-700">
              {error}
            </p>
          ))}
          <p className="mb-3 text-sm leading-6 text-stone-600">
            Race IDs separated by semicolons, e.g.{" "}
            <code className="rounded bg-stone-100 px-1 text-xs">Kaim; BeinnDubh; Dumyat</code>.
            Use <code className="rounded bg-stone-100 px-1 text-xs">n/a</code> for years without
            a series.
          </p>
          <div className="space-y-2">
            {yearEntries.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  aria-label="Year"
                  value={entry.year}
                  onChange={(e) => updateYear(index, e.target.value)}
                  placeholder="YYYY"
                  maxLength={4}
                  className="w-20 shrink-0 rounded-2xl border border-stone-900/10 bg-stone-50 px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-stone-900/40"
                />
                <input
                  aria-label="Races"
                  value={entry.races}
                  onChange={(e) => updateRaces(index, e.target.value)}
                  placeholder="RaceId1; RaceId2; ..."
                  className="min-w-0 flex-1 rounded-2xl border border-stone-900/10 bg-stone-50 px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-stone-900/40"
                />
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  disabled={yearEntries.length <= 1}
                  aria-label="Remove year"
                  className="shrink-0 rounded-full border border-stone-900/10 px-3 py-2 text-xs font-semibold text-stone-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Markdown content */}
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-[#172119] p-6 text-stone-50 shadow-[0_22px_55px_rgba(23,33,25,0.24)]">
        <div className="mb-5 rounded-2xl border border-white/10 bg-black/15 p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
            Draft summary
          </p>
          <p className="mt-3 text-sm leading-6 text-stone-200">
            Target path:{" "}
            <span className="font-semibold text-white">
              championships/{championshipIdValue}.md
            </span>
          </p>
          <p className="text-sm leading-6 text-stone-300">
            Frontmatter: title + one key per year containing semicolon-separated race IDs
          </p>
        </div>
        <MarkdownEditorField
          id={`${formId}-content`}
          name="content"
          label="Championship description"
          placeholder="Overview, rules, schedule, past winners, and contact details in markdown."
          defaultValue={initialValues?.content}
          errors={state.fieldErrors?.content}
        />

        <div className="mt-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
              Draft status
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-200">
              {state.message ?? "Nothing submitted yet."}
            </p>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-lime-300 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-stone-500"
          >
            {isPending ? "Creating PR..." : "Save championship draft PR"}
          </button>
        </div>
      </section>
    </form>
  );
}
