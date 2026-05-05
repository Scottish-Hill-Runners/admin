"use client";

import { useEffect, useId, useState } from "react";
import { useActionState } from "react";
import { saveClubDraft, type ClubActionState } from "@/app/clubs/actions";
import { MarkdownEditorField } from "@/components/markdown-editor-field";
import { useFormDraft } from "@/lib/use-form-draft";
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
  const storageKey = initialValues ? `draft:club:${initialValues.clubId}` : "draft:club:new";
  const { formRef, restoredDraft, onFormInput, onMarkdownChange, clearDraft } =
    useFormDraft(storageKey);
  const [clubIdValue, setClubIdValue] = useState(
    restoredDraft?.clubId?.trim() || initialValues?.clubId || "ClubId",
  );

  useEffect(() => {
    if (state.status === "success") clearDraft();
  }, [state.status, clearDraft]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]"
      onInput={(event) => {
        onFormInput();
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
            defaultValue={restoredDraft?.clubId ?? initialValues?.clubId}
            errors={state.fieldErrors?.clubId}
          />
          <InputField
            label="Full name"
            name="name"
            placeholder="(e.g. 'Carnethy Hill Running Club')"
            defaultValue={restoredDraft?.name ?? initialValues?.name}
            errors={state.fieldErrors?.name}
          />
          <InputField
            label="Also known as"
            name="aka"
            placeholder="(comma-separated aliases, e.g. 'Carnethy, CHRC')"
            defaultValue={restoredDraft?.aka ?? initialValues?.aka.join(", ")}
            errors={state.fieldErrors?.aka}
          />
          <InputField
            label="Website"
            name="web"
            placeholder="https://example.com"
            defaultValue={restoredDraft?.web ?? initialValues?.web}
            errors={state.fieldErrors?.web}
          />
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-[#172119] p-6 text-stone-50 shadow-[0_22px_55px_rgba(23,33,25,0.24)]">
        {restoredDraft && (
          <div className="mb-4 rounded-2xl border border-lime-400/30 bg-lime-900/30 px-4 py-3">
            <p className="text-sm text-lime-200">
              Your unsaved changes have been restored.{" "}
              <button
                type="button"
                onClick={() => {
                  clearDraft();
                  window.location.reload();
                }}
                className="underline hover:text-white"
              >
                Start fresh
              </button>
            </p>
          </div>
        )}
        <div className="mb-5 rounded-2xl border border-white/10 bg-black/15 p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
            Draft summary
          </p>
          <p className="mt-3 text-sm leading-6 text-stone-200">
            Target path:{" "}
            <span className="font-semibold text-white">clubs/{clubIdValue}.md</span>
          </p>
          <p className="text-sm leading-6 text-stone-300">
            Saved fields: name, aka, web
          </p>
          <p className="text-sm leading-6 text-stone-300">
            Body format: club description text formatting
          </p>
        </div>
        <MarkdownEditorField
          id={`${formId}-content`}
          name="content"
          label="Club description"
          placeholder="Describe the club — its history, ethos, location, and how to get in touch."
          defaultValue={restoredDraft?.content ?? initialValues?.content}
          onChange={onMarkdownChange("content")}
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
              <input type="checkbox" name="autoMerge" defaultChecked={restoredDraft?.autoMerge === "on"} className="h-4 w-4 accent-lime-400" />
              Minor correction — skip review
            </label>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-lime-300 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-stone-500"
            >
              {isPending ? "Saving..." : "Save club draft"}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}
