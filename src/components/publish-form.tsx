"use client";

import { useActionState } from "react";
import Link from "next/link";
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
          Publishing status
        </p>

        {stagingStatus.state === "error" ? (
          <p className="mt-3 text-sm leading-6 text-red-700">{stagingStatus.message}</p>
        ) : stagingStatus.state === "up-to-date" ? (
          <p className="mt-3 text-sm leading-6 text-stone-700">
            Draft updates are already in sync with the live site. There is nothing to publish.
          </p>
        ) : (
          <div className="mt-3 space-y-2 text-sm leading-6 text-stone-700">
            <p>
              Draft updates are{" "}
              <span className="font-semibold text-stone-900">{stagingStatus.aheadBy} update{stagingStatus.aheadBy === 1 ? "" : "s"} ready</span>{" "}
              to publish.
            </p>
            {stagingStatus.behindBy > 0 ? (
              <p className="text-amber-800">
                The live site also has {stagingStatus.behindBy} newer update{stagingStatus.behindBy === 1 ? "" : "s"}.
                An admin will review and resolve this before publishing.
              </p>
            ) : null}
            {stagingStatus.prNumber ? (
              <p>
                A publication request is already open with reference{" "}
                <span className="font-semibold text-stone-900">#{stagingStatus.prNumber}</span>.
                Track progress in{" "}
                <Link
                  href={`/submissions/${stagingStatus.prNumber}`}
                  className="font-semibold text-amber-700 underline"
                >
                  My submissions
                </Link>
                .
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
            <li>Every save creates a review request for draft updates.</li>
            <li>&quot;Skip review&quot; requests can be approved without extra steps.</li>
            <li>This page sends one publication request for admin review and approval.</li>
            <li>Each approved request triggers one site rebuild.</li>
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
              {state.requestNumber ? (
                <p className="mt-1 text-sm font-semibold text-lime-300">
                  Request reference: #{state.requestNumber}
                  {" · "}
                  <Link href={`/submissions/${state.requestNumber}`} className="underline">
                    Check progress
                  </Link>
                </p>
              ) : null}
            </div>
            <button
              type="submit"
              disabled={isPending || stagingStatus.state !== "ahead"}
              className="rounded-full bg-lime-300 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-stone-500"
            >
              {isPending ? "Submitting request..." : "Submit publication request"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
