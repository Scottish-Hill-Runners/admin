"use client";

import { useId, useState } from "react";
import { useActionState } from "react";
import { saveNewsDraft, type NewsActionState } from "@/app/news/actions";
import type { NewsFrontmatter } from "@/lib/content-types";

const initialState: NewsActionState = {
  status: "idle",
};

type FieldProps = {
  label: string;
  name: string;
  type?: "text" | "date";
  placeholder?: string;
  defaultValue?: string;
  errors?: string[];
};

type NewsEditorFormProps = {
  initialValues?: {
    slug: string;
    data: NewsFrontmatter;
    content: string;
  } | null;
};

function InputField({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  errors,
}: FieldProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
        {label}
      </span>
      <input
        name={name}
        type={type}
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

export function NewsEditorForm({ initialValues }: NewsEditorFormProps) {
  const [state, formAction, isPending] = useActionState(saveNewsDraft, initialState);
  const buttonLabel = isPending ? "Creating PR..." : "Create draft PR";
  const formId = useId();
  const [slugValue, setSlugValue] = useState(initialValues?.slug ?? "new-item-slug");

  return (
    <form
      action={formAction}
      className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]"
      onInput={(event) => {
        const target = event.target as HTMLInputElement | HTMLTextAreaElement;
        if (target.name === "slug") {
          setSlugValue(target.value.trim() || "new-item-slug");
        }
      }}
    >
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <div className="grid gap-5">
          <InputField
            label="Title"
            name="title"
            placeholder="Scottish Championship fixtures announced"
            defaultValue={initialValues?.data.title}
            errors={state.fieldErrors?.title}
          />
          <InputField
            label="Slug"
            name="slug"
            placeholder="championship-fixtures-announced"
            defaultValue={initialValues?.slug}
            errors={state.fieldErrors?.slug}
          />
          <InputField
            label="Date"
            name="date"
            type="date"
            defaultValue={initialValues?.data.date}
            errors={state.fieldErrors?.date}
          />
          <label className="block space-y-2">
            <span className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
              Excerpt
            </span>
            <textarea
              name="excerpt"
              rows={4}
              className="w-full rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-base text-stone-900 outline-none transition focus:border-stone-900/40"
              placeholder="Short summary shown in listings and previews."
              defaultValue={initialValues?.data.excerpt}
            />
            {state.fieldErrors?.excerpt?.map((error) => (
              <p key={error} className="text-sm text-red-700">
                {error}
              </p>
            ))}
          </label>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-[#172119] p-6 text-stone-50 shadow-[0_22px_55px_rgba(23,33,25,0.24)]">
        <div className="mb-5 rounded-2xl border border-white/10 bg-black/15 p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
            Draft summary
          </p>
          <p className="mt-3 text-sm leading-6 text-stone-200">
            Target path: <span className="font-semibold text-white">news/{slugValue}.md</span>
          </p>
          <p className="text-sm leading-6 text-stone-300">
            Frontmatter fields: title, date, excerpt
          </p>
          <p className="text-sm leading-6 text-stone-300">
            Body format: markdown article content
          </p>
        </div>
        <label className="block space-y-2">
          <span className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
            Body
          </span>
          <textarea
            id={`${formId}-content`}
            name="content"
            rows={14}
            className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-base text-stone-50 outline-none transition focus:border-lime-200/40"
            placeholder="Write the article body in markdown. A richer editor can sit on top of this later."
            defaultValue={initialValues?.content}
          />
          {state.fieldErrors?.content?.map((error) => (
            <p key={error} className="text-sm text-red-200">
              {error}
            </p>
          ))}
        </label>

        <div className="mt-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
              Validation status
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
            {buttonLabel}
          </button>
        </div>
      </section>
    </form>
  );
}
