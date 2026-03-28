"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef } from "react";

type MarkdownEditorFieldProps = {
  id: string;
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  errors?: string[];
};

const MdxEditorClient = dynamic(
  () => import("@/components/mdx-editor-client").then((module) => module.MdxEditorClient),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[22rem] rounded-xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-stone-300">
        Loading markdown editor...
      </div>
    ),
  }
);

export function MarkdownEditorField({
  id,
  name,
  label,
  placeholder,
  defaultValue,
  errors,
}: MarkdownEditorFieldProps) {
  const labelId = `${id}-label`;
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback((newValue: string) => {
    // Sync directly to the hidden input ref, bypassing React state
    if (inputRef.current) {
      inputRef.current.value = newValue;
    }
  }, []);

  return (
    <div className="block space-y-2" aria-labelledby={labelId}>
      <span id={labelId} className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
        {label}
      </span>

      <MdxEditorClient markdown={defaultValue ?? ""} onChange={handleChange} placeholder={placeholder} />

      <input
        ref={inputRef}
        type="hidden"
        id={id}
        name={name}
        defaultValue={defaultValue}
        readOnly
      />

      {errors?.map((error) => (
        <p key={error} className="text-sm text-red-200">
          {error}
        </p>
      ))}
    </div>
  );
}