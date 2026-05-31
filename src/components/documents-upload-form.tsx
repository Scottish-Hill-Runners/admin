"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  submitDocumentsDraft,
  type DocumentsSubmitState,
} from "@/app/collections/actions";

type DocumentsUploadFormProps = {
  currentCount?: number;
  loadError?: string | null;
  returnToWorkflowUrl?: string;
};

type DocumentCard = {
  fileName: string;
  title: string;
  description: string;
  tags: string;
};

const initialState: DocumentsSubmitState = { status: "idle" };

export function DocumentsUploadForm({
  currentCount,
  loadError,
  returnToWorkflowUrl,
}: DocumentsUploadFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(submitDocumentsDraft, initialState);
  const [cards, setCards] = useState<DocumentCard[]>([]);

  useEffect(() => {
    if (state.status !== "success" || !state.redirectToWorkflowUrl) {
      return;
    }

    router.push(state.redirectToWorkflowUrl);
  }, [router, state.redirectToWorkflowUrl, state.status]);

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setCards(
      files.map((file) => ({
        fileName: file.name,
        title: file.name.replace(/\.[^.]+$/, ""),
        description: "",
        tags: "",
      }))
    );
  }

  function updateCard(index: number, update: Partial<DocumentCard>) {
    setCards((previous) => previous.map((card, i) => (i === index ? { ...card, ...update } : card)));
  }

  const documentsMetadata = useMemo(
    () =>
      JSON.stringify(
        cards.map((card) => ({
          title: card.title,
          description: card.description.trim() || undefined,
          tags: card.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }))
      ),
    [cards]
  );

  const hasMissingTitles = cards.some((card) => card.title.trim().length === 0);

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      {returnToWorkflowUrl ? (
        <input type="hidden" name="returnToWorkflowUrl" value={returnToWorkflowUrl} />
      ) : null}
      <input type="hidden" name="documentsMetadata" value={documentsMetadata} readOnly />

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <h2 className="font-[family:var(--font-heading)] text-xl text-stone-900">
          Upload document files
        </h2>
        <p className="mt-1 mb-5 text-sm text-stone-500">
          Choose files and fill in a title for each one. Paths are generated automatically from each filename.
        </p>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-stone-800">Files</span>
          <input
            type="file"
            name="assetFiles"
            multiple
            onChange={handleFilesChange}
            className="w-full rounded-2xl border border-dashed border-stone-900/20 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none transition focus:border-stone-900/40"
          />
        </label>

        {cards.length > 0 ? (
          <div className="mt-5 grid gap-4">
            {cards.map((card, index) => (
              <article
                key={`${card.fileName}-${index}`}
                className="rounded-2xl border border-stone-900/10 bg-stone-50/80 p-4"
              >
                <div className="mt-3 grid gap-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-600">
                      Title <span className="text-red-600">*</span>
                    </span>
                    <input
                      value={card.title}
                      onChange={(event) => updateCard(index, { title: event.target.value })}
                      className="w-full rounded-xl border border-stone-900/15 bg-white px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-stone-900/40"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-600">
                      Description
                    </span>
                    <textarea
                      value={card.description}
                      onChange={(event) => updateCard(index, { description: event.target.value })}
                      rows={2}
                      className="w-full rounded-xl border border-stone-900/15 bg-white px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-stone-900/40"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-600">
                      Tags
                    </span>
                    <input
                      value={card.tags}
                      onChange={(event) => updateCard(index, { tags: event.target.value })}
                      placeholder="document, archive"
                      className="w-full rounded-xl border border-stone-900/15 bg-white px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-stone-900/40"
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {state.fieldErrors?.assetFiles?.map((error) => (
          <p key={error} className="mt-3 text-sm text-red-700">
            {error}
          </p>
        ))}
        {state.fieldErrors?.documentsMetadata?.map((error) => (
          <p key={error} className="mt-2 text-sm text-red-700">
            {error}
          </p>
        ))}
      </section>

      <section className="rounded-[1.5rem] bg-[#172119] p-6 text-stone-100 shadow-[0_22px_55px_rgba(23,33,25,0.24)]">
        <h2 className="font-[family:var(--font-heading)] text-xl text-stone-50">Submission</h2>

        {typeof currentCount === "number" ? (
          <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-200">
            Current documents: {currentCount}
          </p>
        ) : null}

        {loadError ? (
          <p className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-900/20 px-4 py-3 text-sm text-amber-200">
            {loadError}
          </p>
        ) : null}

        <div className="mt-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
            Check status
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-200">
            {state.status === "success" || state.status === "error"
              ? state.message
              : "Nothing submitted yet."}
          </p>
        </div>

        <div className="mt-6 flex flex-col items-end gap-3">
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-stone-400">
            <input type="checkbox" name="autoMerge" className="h-4 w-4 accent-lime-500" />
            Skip review
          </label>
          <button
            type="submit"
            disabled={isPending || Boolean(loadError) || cards.length === 0 || hasMissingTitles}
            className="rounded-full bg-lime-300 px-5 py-2.5 text-sm font-semibold text-stone-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? "Uploading…" : "Upload and save"}
          </button>
        </div>
      </section>
    </form>
  );
}
