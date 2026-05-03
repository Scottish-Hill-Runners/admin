"use client";

import { useActionState } from "react";
import {
  acceptSubmissionAction,
  publishLiveAction,
  type ManageActionState,
} from "@/app/publish/manage/actions";
import type { StagingPullRequest } from "@/lib/github";
import type { StagingStatus } from "@/lib/github";

const idle: ManageActionState = { status: "idle" };

function AcceptSubmissionForm({ pr }: { pr: StagingPullRequest }) {
  const [state, formAction, isPending] = useActionState<ManageActionState, FormData>(
    acceptSubmissionAction,
    idle
  );

  return (
    <div className="flex flex-col gap-2 rounded-[1.25rem] border border-stone-900/10 bg-white/85 p-5 shadow-[0_4px_16px_rgba(47,39,29,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-900">{pr.title}</p>
          <p className="mt-0.5 text-xs text-stone-500">
            {pr.submitterName
              ? `${pr.submitterName}${pr.submitterEmail ? ` · ${pr.submitterEmail}` : ""}`
              : "Unknown editor"}
            {" · "}
            {new Date(pr.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <a
          href={pr.htmlUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-xs font-medium text-amber-700 underline hover:text-amber-900"
        >
          View details
        </a>
      </div>

      {state.status !== "idle" ? (
        <p
          className={`text-xs ${state.status === "success" ? "text-green-700" : "text-red-700"}`}
        >
          {state.message}
        </p>
      ) : null}

      {state.status !== "success" ? (
        <form action={formAction}>
          <input type="hidden" name="pullNumber" value={pr.number} />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-stone-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {isPending ? "Accepting…" : "Accept submission"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function PublishLiveForm({ stagingStatus }: { stagingStatus: StagingStatus }) {
  const [state, formAction, isPending] = useActionState<ManageActionState, FormData>(
    publishLiveAction,
    idle
  );

  const canPublish = stagingStatus.state === "ahead" && state.status !== "success";

  return (
    <section className="rounded-[1.5rem] border border-stone-900/10 bg-[#172119] p-6 text-stone-50 shadow-[0_22px_55px_rgba(23,33,25,0.24)]">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
        Go live
      </p>

      <div className="mt-3 space-y-1 text-sm leading-6 text-stone-300">
        {stagingStatus.state === "error" ? (
          <p className="text-red-400">{stagingStatus.message}</p>
        ) : stagingStatus.state === "up-to-date" ? (
          <p>Draft updates are already in sync with the live site. Nothing to publish.</p>
        ) : (
          <>
            <p>
              <span className="font-semibold text-white">
                {stagingStatus.aheadBy} update{stagingStatus.aheadBy === 1 ? "" : "s"}
              </span>{" "}
              ready to go live.
            </p>
            {stagingStatus.behindBy > 0 ? (
              <p className="text-amber-300">
                The live site also has {stagingStatus.behindBy} newer update
                {stagingStatus.behindBy === 1 ? "" : "s"}. Review for conflicts before publishing.
              </p>
            ) : null}
          </>
        )}
      </div>

      {state.status !== "idle" ? (
        <p
          className={`mt-3 text-sm ${state.status === "success" ? "text-lime-300" : "text-red-400"}`}
        >
          {state.message}
        </p>
      ) : null}

      <form action={formAction} className="mt-5">
        <button
          type="submit"
          disabled={!canPublish || isPending}
          className="rounded-full bg-lime-300 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-stone-500 disabled:text-stone-300"
        >
          {isPending ? "Publishing…" : "Publish live now"}
        </button>
      </form>
    </section>
  );
}

export function PublishManageForm({
  pendingSubmissions,
  stagingStatus,
}: {
  pendingSubmissions: StagingPullRequest[];
  stagingStatus: StagingStatus;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="flex flex-col gap-4">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
          Pending submissions
        </p>
        {pendingSubmissions.length === 0 ? (
          <div className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
            <p className="text-sm leading-6 text-stone-600">
              No submissions are waiting. All editor saves have already been accepted or
              merged automatically.
            </p>
          </div>
        ) : (
          pendingSubmissions.map((pr) => <AcceptSubmissionForm key={pr.number} pr={pr} />)
        )}
      </section>

      <PublishLiveForm stagingStatus={stagingStatus} />
    </div>
  );
}
