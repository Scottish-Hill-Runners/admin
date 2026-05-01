"use client";

import { useId, useState } from "react";
import { useActionState } from "react";
import { saveClubDraft, type ClubActionState } from "@/app/clubs/actions";
import { MarkdownEditorField } from "@/components/markdown-editor-field";
import type { ClubInfoFormData } from "@/lib/content-types";

const initialState: ClubActionState = {
  status: "idle",
};

type InputProps = {
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
  errors?: string[];
};

type ClubEditorFormProps = {
  initialValues?: ClubInfoFormData | null;
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

export function ClubEditorForm({ initialValues }: ClubEditorFormProps) {
  const [state, formAction, isPending] = useActionState(saveClubDraft, initialState);
  const formId = useId();
  const [clubIdValue, setClubIdValue] = useState(initialValues?.clubId ?? "ClubId");

  return (
    <form
      action={formAction}
      className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]"
      onInput={(event) => {
        const target = event.target as HTMLInputElement | HTMLTextAreaElement;
        if (target.name === "clubId") {
          setClubIdValue(target.value.trim() || "ClubId");
        }
      }}
    >
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <div className="grid gap-5 md:grid-cols-2">
          <InputField
            label="Club ID"
            name="clubId"
            placeholder="(letters and numbers only, e.g. 'Carnethy')"
            defaultValue={initialValues?.clubId}
            errors={state.fieldErrors?.clubId}
          />
          <InputField
            label="Full name"
            name="name"
            placeholder="(e.g. 'Carnethy Hill Running Club')"
            defaultValue={initialValues?.name}
            errors={state.fieldErrors?.name}
          />
          <InputField
            label="Also known as"
            name="aka"
            placeholder="(comma-separated aliases, e.g. 'Carnethy, CHRC')"
            defaultValue={initialValues?.aka.join(", ")}
            errors={state.fieldErrors?.aka}
          />
          <InputField
            label="Website"
            name="web"
            placeholder="https://example.com"
            defaultValue={initialValues?.web}
            errors={state.fieldErrors?.web}
          />
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-[#172119] p-6 text-stone-50 shadow-[0_22px_55px_rgba(23,33,25,0.24)]">
        <div className="mb-5 rounded-2xl border border-white/10 bg-black/15 p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
            Draft summary
          </p>
          <p className="mt-3 text-sm leading-6 text-stone-200">
            Target path:{" "}
            <span className="font-semibold text-white">clubs/{clubIdValue}.md</span>
          </p>
          <p className="text-sm leading-6 text-stone-300">
            Frontmatter fields: name, aka, web
          </p>
          <p className="text-sm leading-6 text-stone-300">
            Body format: markdown club description
          </p>
        </div>
        <MarkdownEditorField
          id={`${formId}-content`}
          name="content"
          label="Club description"
          placeholder="Describe the club — its history, ethos, location, and how to get in touch."
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
              {isPending ? "Creating PR..." : "Save club draft PR"}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}
