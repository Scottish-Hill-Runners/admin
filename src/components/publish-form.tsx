"use client";

import { useActionState } from "react";
import { publishStagingAction, type PublishActionState } from "@/app/publish/actions";
import type { StagingStatus } from "@/lib/github";

const initialState: PublishActionState = { status: "idle" };
type PublishFormProps = {
  stagingStatus: StagingStatus;
};

export function PublishForm({ stagingStatus }: PublishFormProps) {
  const [state, formAction, isPending] = useActionState<PublishActionState, FormData>(
    publishStagingAction,
    initialState
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
          Staging status
        </p>

        {stagingStatus.state === "error" ? (
          <p className="mt-3 text-sm leading-6 text-red-700">{stagingStatus.message}</p>
        ) : stagingStatus.state === "up-to-date" ? (
          <p className="mt-3 text-sm leading-6 text-stone-700">
            Staging is up to date with the live branch. There is nothing to publish.
          </p>
        ) : (
          <div className="mt-3 space-y-2 text-sm leading-6 text-stone-700">
            <p>
              Staging is{" "}
              <span className="font-semibold text-stone-900">{stagingStatus.aheadBy} commit{stagingStatus.aheadBy === 1 ? "" : "s"} ahead</span>{" "}
              of the live branch and ready to publish.
            </p>
            {stagingStatus.behindBy > 0 ? (
              <p className="text-amber-800">
                Staging is also {stagingStatus.behindBy} commit{stagingStatus.behindBy === 1 ? "" : "s"} behind the live branch.
                Officials should resolve the merge conflict when they review the PR.
              </p>
            ) : null}
            {stagingStatus.prUrl ? (
              <p>
                A publish PR is already open:{" "}
                <a
                  href={stagingStatus.prUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-amber-700 underline"
                >
                  view on GitHub
                </a>
              </p>
            ) : null}
          </div>
        )}
      </section>

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-[#172119] p-6 text-stone-50 shadow-[0_22px_55px_rgba(23,33,25,0.24)]">
        <div className="mb-5 rounded-2xl border border-white/10 bg-black/15 p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
            How it works
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-200">
            <li>Every form save creates a PR targeting the <strong className="text-white">staging</strong> branch.</li>
            <li>Auto-merge PRs land on staging automatically (via GitHub Actions).</li>
            <li>This page opens a single <strong className="text-white">staging → main</strong> PR for officials to review and approve.</li>
            <li>One merge triggers one site rebuild.</li>
          </ul>
        </div>

        <form action={formAction}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
                Publish status
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-200">
                {state.message ?? "Nothing submitted yet."}
              </p>
              {state.prUrl ? (
                <a
                  href={state.prUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-sm font-semibold text-lime-300 underline"
                >
                  View PR on GitHub
                </a>
              ) : null}
            </div>
            <button
              type="submit"
              disabled={isPending || stagingStatus.state !== "ahead"}
              className="rounded-full bg-lime-300 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-stone-500"
            >
              {isPending ? "Opening PR..." : "Open publish PR"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
