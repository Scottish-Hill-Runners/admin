"use client";

import { useId, useState } from "react";
import { useActionState } from "react";
import { saveInfoDraft, type InfoActionState } from "@/app/info/actions";
import { MarkdownEditorField } from "@/components/markdown-editor-field";
import type { InfoFormData } from "@/lib/content-types";

const initialState: InfoActionState = { status: "idle" };

type InfoEditorFormProps = {
  initialValues?: InfoFormData | null;
};

export function InfoEditorForm({ initialValues }: InfoEditorFormProps) {
  const [state, formAction, isPending] = useActionState(saveInfoDraft, initialState);
  const formId = useId();
  const [filePath, setFilePath] = useState(initialValues?.filePath ?? "index.md");
  const displayPath = filePath.trim() ? `info/${filePath.trim()}` : "info/index.md";

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <label className="block space-y-2">
          <span className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
            Page file path
          </span>
          <input
            name="filePath"
            placeholder="(e.g. joining/index.md or joining/juniors.md)"
            defaultValue={initialValues?.filePath ?? "index.md"}
            onInput={(event) => setFilePath((event.target as HTMLInputElement).value)}
            className="w-full rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-base text-stone-900 outline-none transition focus:border-stone-900/40"
          />
          {state.fieldErrors?.filePath?.map((error) => (
            <p key={error} className="text-sm text-red-700">
              {error}
            </p>
          ))}
        </label>

        <div className="mt-4 rounded-2xl border border-stone-900/10 bg-stone-100/70 px-4 py-3 text-sm leading-6 text-stone-700">
          <p className="font-semibold text-stone-900">Create new folders/pages</p>
          <p>
            Enter a new path and save. Your submission will include that new page file path
            under info/.
          </p>
          <p>Examples: <span className="font-semibold">about/history.md</span>, <span className="font-semibold">membership/index.md</span></p>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-[#172119] p-6 text-stone-50 shadow-[0_22px_55px_rgba(23,33,25,0.24)]">
        <div className="mb-5 rounded-2xl border border-white/10 bg-black/15 p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
            Draft summary
          </p>
          <p className="mt-3 text-sm leading-6 text-stone-200">
            Target path: <span className="font-semibold text-white">{displayPath}</span>
          </p>
          <p className="text-sm leading-6 text-stone-300">Format: body text only (no extra metadata block)</p>
          <p className="text-sm leading-6 text-stone-300">Use index.md for directory default routes.</p>
        </div>

        <MarkdownEditorField
          id={`${formId}-content`}
          name="content"
          label="Page content"
          placeholder="Write the page content."
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
              Minor correction — publish automatically
            </label>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-lime-300 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-stone-500"
            >
              {isPending ? "Saving..." : "Save info draft"}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}
