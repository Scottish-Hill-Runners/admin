"use client";

import { useActionState, useMemo, useState } from "react";
import {
  acceptSubmissionAction,
  publishLiveAction,
  rejectSubmissionAction,
  updateSubmissionFileAction,
  type ManageActionState,
} from "@/app/publish/manage/actions";
import type { StagingPullRequest, UnlinkedDraftUpdate } from "@/lib/github";
import type { StagingStatus } from "@/lib/github";
import type { PublishNewsCandidate } from "@/lib/news-social";

const idle: ManageActionState = { status: "idle" };

function SubmissionFilePanel({
  pullNumber,
  file,
}: {
  pullNumber: number;
  file: StagingPullRequest["changedFiles"][number];
}) {
  const [editState, editFormAction, isEditPending] = useActionState<
    ManageActionState,
    FormData
  >(updateSubmissionFileAction, idle);

  const diffLength = file.patch?.length ?? 0;
  const contentLength = file.currentContent?.length ?? 0;
  const shouldHideDiffPreview =
    file.isEditableText &&
    Boolean(file.patch) &&
    contentLength > 0 &&
    diffLength / contentLength >= 0.8;

  return (
    <details className="rounded-lg border border-stone-300 bg-white/70 p-3">
      <summary className="cursor-pointer text-xs font-semibold text-stone-800">
        {file.path} · {file.changeType}
      </summary>

      <div className="mt-3 space-y-3">
        {!shouldHideDiffPreview ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">
              Diff preview
            </p>
            {file.patch ? (
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-stone-900 p-3 text-[11px] text-stone-100">
                {file.patch}
              </pre>
            ) : (
              <p className="mt-1 text-xs text-stone-500">No inline diff is available for this file.</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-stone-500">
            Diff preview hidden because it is nearly the same size as the file.
          </p>
        )}

        {file.isEditableText ? (
          <form action={editFormAction} className="space-y-2">
            <input type="hidden" name="pullNumber" value={pullNumber} />
            <input type="hidden" name="path" value={file.path} />
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">
              Quick edit
            </label>
            <textarea
              name="content"
              defaultValue={file.currentContent ?? ""}
              rows={10}
              disabled={isEditPending}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 font-mono text-xs text-stone-900 disabled:cursor-not-allowed disabled:bg-stone-100"
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isEditPending}
                className="rounded-full bg-stone-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
              >
                {isEditPending ? "Saving…" : "Save file update"}
              </button>
              {editState.status !== "idle" ? (
                <p
                  className={`text-xs ${
                    editState.status === "success" ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {editState.message}
                </p>
              ) : null}
            </div>
          </form>
        ) : (
          <p className="text-xs text-stone-500">
            Quick edit is only available for text files (.md and .csv).
          </p>
        )}
      </div>
    </details>
  );
}

function AcceptSubmissionForm({ pr }: { pr: StagingPullRequest }) {
  const [acceptState, acceptFormAction, isAcceptPending] = useActionState<
    ManageActionState,
    FormData
  >(
    acceptSubmissionAction,
    idle
  );
  const [rejectState, rejectFormAction, isRejectPending] = useActionState<
    ManageActionState,
    FormData
  >(
    rejectSubmissionAction,
    idle
  );
  const isPending = isAcceptPending || isRejectPending;
  const statusState = acceptState.status !== "idle" ? acceptState : rejectState;
  const statusTone =
    statusState.status === "success"
      ? "text-green-700"
      : statusState.status === "error"
        ? "text-red-700"
        : "";
  const isResolved = acceptState.status === "success" || rejectState.status === "success";

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
          View details on GitHub
        </a>
      </div>

      {statusState.status !== "idle" ? (
        <p className={`text-xs ${statusTone}`}>{statusState.message}</p>
      ) : null}

      {!isResolved ? (
        <div className="flex flex-wrap gap-2">
          <form action={acceptFormAction}>
            <input type="hidden" name="pullNumber" value={pr.number} />
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-stone-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
            >
              {isAcceptPending ? "Accepting…" : "Accept submission"}
            </button>
          </form>

          <form action={rejectFormAction}>
            <input type="hidden" name="pullNumber" value={pr.number} />
            <button
              type="submit"
              disabled={isPending}
              onClick={(event) => {
                const confirmed = window.confirm(
                  "Reject this submission? This will close it and remove it from pending submissions."
                );

                if (!confirmed) {
                  event.preventDefault();
                }
              }}
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
            >
              {isRejectPending ? "Rejecting…" : "Reject submission"}
            </button>
          </form>
        </div>
      ) : null}

      {pr.changedFiles.length > 0 ? (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">
            Changed files
          </p>
          {pr.changedFiles.map((file) => (
            <SubmissionFilePanel
              key={`${pr.number}:${file.path}`}
              pullNumber={pr.number}
              file={file}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PublishLiveForm({
  stagingStatus,
  socialCandidates,
  socialPostingAvailable,
}: {
  stagingStatus: StagingStatus;
  socialCandidates: PublishNewsCandidate[];
  socialPostingAvailable: boolean;
}) {
  const [state, formAction, isPending] = useActionState<ManageActionState, FormData>(
    publishLiveAction,
    idle
  );
  const [facebookPostingEnabled, setFacebookPostingEnabled] = useState(false);
  const [selectedSlugs, setSelectedSlugs] = useState<Record<string, boolean>>({});

  const canPublish = stagingStatus.state === "ahead" && state.status !== "success";
  const canUseFacebookPosting =
    canPublish && socialPostingAvailable && socialCandidates.length > 0 && !isPending;
  const selectedCount = useMemo(
    () => Object.values(selectedSlugs).filter(Boolean).length,
    [selectedSlugs]
  );

  function handleFacebookPostingEnabledChange(nextValue: boolean) {
    setFacebookPostingEnabled(nextValue);
    if (!nextValue) {
      setSelectedSlugs({});
    }
  }

  function handleSlugSelection(slug: string, selected: boolean) {
    setSelectedSlugs((current) => ({
      ...current,
      [slug]: selected,
    }));
  }

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
        <div className="mt-3 space-y-2">
          <p
            className={`text-sm ${state.status === "success" ? "text-lime-300" : "text-red-400"}`}
          >
            {state.message}
          </p>
          {state.socialResult?.failedItems.length ? (
            <ul className="space-y-1 text-xs text-red-200">
              {state.socialResult.failedItems.map((item) => (
                <li key={item.slug}>
                  {item.title}: {item.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <form action={formAction} className="mt-5">
        <div className="space-y-3 rounded-xl border border-lime-100/20 bg-black/10 p-4">
          <label className="flex items-start gap-3 text-sm text-stone-200">
            <input
              type="checkbox"
              name="facebookPostEnabled"
              className="mt-1 size-4 rounded"
              checked={facebookPostingEnabled}
              onChange={(event) => handleFacebookPostingEnabledChange(event.target.checked)}
              disabled={!canUseFacebookPosting}
            />
            <span>
              Post selected news updates to Facebook after publishing live.
            </span>
          </label>

          {!socialPostingAvailable ? (
            <p className="text-xs text-stone-400">
              Facebook posting is not set up yet. Please contact an administrator.
            </p>
          ) : socialCandidates.length === 0 ? (
            <p className="text-xs text-stone-400">
              No news updates are included in this publish batch.
            </p>
          ) : facebookPostingEnabled ? (
            <div className="space-y-3">
              <p className="text-xs text-lime-200/90">
                Choose the news updates to post and edit the text before publishing.
              </p>
              {socialCandidates.map((candidate) => {
                const isSelected = Boolean(selectedSlugs[candidate.slug]);
                return (
                  <div
                    key={candidate.slug}
                    className="space-y-2 rounded-lg border border-lime-100/15 bg-black/20 p-3"
                  >
                    <label className="flex items-start gap-3 text-sm text-stone-100">
                      <input
                        type="checkbox"
                        name="facebookSelectedSlugs"
                        value={candidate.slug}
                        className="mt-1 size-4 rounded"
                        checked={isSelected}
                        onChange={(event) =>
                          handleSlugSelection(candidate.slug, event.target.checked)
                        }
                        disabled={!facebookPostingEnabled || isPending}
                      />
                      <span className="flex flex-col">
                        <span className="font-semibold text-white">{candidate.title}</span>
                        <span className="text-xs text-stone-300">{candidate.date}</span>
                      </span>
                    </label>
                    <textarea
                      name={`facebookPostText:${candidate.slug}`}
                      defaultValue={candidate.excerpt}
                      rows={4}
                      disabled={!isSelected || isPending}
                      className="w-full rounded-md border border-lime-100/25 bg-black/30 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-400 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>
                );
              })}
              <p className="text-xs text-stone-300">
                {selectedCount} news update{selectedCount === 1 ? "" : "s"} selected.
              </p>
            </div>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={!canPublish || isPending}
          className="mt-4 rounded-full bg-lime-300 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-stone-500 disabled:text-stone-300"
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
  socialCandidates,
  socialPostingAvailable,
  unlinkedDraftUpdates,
}: {
  pendingSubmissions: StagingPullRequest[];
  stagingStatus: StagingStatus;
  socialCandidates: PublishNewsCandidate[];
  socialPostingAvailable: boolean;
  unlinkedDraftUpdates: UnlinkedDraftUpdate[];
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
            {unlinkedDraftUpdates.length > 0 ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
                <p className="font-semibold uppercase tracking-[0.14em] text-amber-800">
                  Needs checking
                </p>
                <p className="mt-1">
                  {unlinkedDraftUpdates.length} draft update
                  {unlinkedDraftUpdates.length === 1 ? " was" : "s were"} found in the
                  content store without an open submission.
                </p>
                <p className="mt-1">
                  These updates will not appear in this list until a submission is opened for
                  them.
                </p>
                <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-auto pl-4 font-mono text-[11px]">
                  {unlinkedDraftUpdates.slice(0, 20).map((item) => (
                    <li key={item.refName}>{item.refName}</li>
                  ))}
                </ul>
                {unlinkedDraftUpdates.length > 20 ? (
                  <p className="mt-1 text-[11px] text-amber-800">
                    Showing 20 of {unlinkedDraftUpdates.length} references.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          pendingSubmissions.map((pr) => <AcceptSubmissionForm key={pr.number} pr={pr} />)
        )}
      </section>

      <PublishLiveForm
        stagingStatus={stagingStatus}
        socialCandidates={socialCandidates}
        socialPostingAvailable={socialPostingAvailable}
      />
    </div>
  );
}
