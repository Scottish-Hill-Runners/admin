"use client";

import { useId, useMemo, useState } from "react";
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
  championshipId: string;
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

export function ChampionshipEditorForm({ championshipId, initialValues }: ChampionshipEditorFormProps) {
  const [state, formAction, isPending] = useActionState(
    saveChampionshipDraft,
    initialState
  );
  const formId = useId();

  const [yearEntries, setYearEntries] = useState<ChampionshipYearEntry[]>(
    () =>
      initialValues?.yearEntries.length
        ? initialValues.yearEntries
        : [{ year: String(new Date().getFullYear()), races: "" }]
  );

  const yearEntriesJson = useMemo(() => JSON.stringify(yearEntries), [yearEntries]);

  return (
    <form action={formAction} className="grid gap-6">
      <input type="hidden" name="championshipId" value={championshipId} />
      <input type="hidden" name="yearEntries" value={yearEntriesJson} />

      {/* Metadata */}
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <InputField
          label="Title"
          name="title"
          placeholder="(e.g. 'Bog 'n Burn')"
          defaultValue={initialValues?.title}
          errors={state.fieldErrors?.title}
        />
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
              championships/{championshipId}.md
            </span>
          </p>
          <p className="text-sm leading-6 text-stone-300">
            Frontmatter: title + existing race schedule preserved unchanged
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
          <div className="flex flex-col items-end gap-3">
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-stone-300">
              <input type="checkbox" name="autoMerge" className="h-4 w-4 accent-lime-400" />
              Minor correction — auto-merge
            </label>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-lime-300 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-stone-500"
            >
              {isPending ? "Creating PR..." : "Save championship draft PR"}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}
