"use client";

import { useActionState } from "react";
import {
  createResultsInboxCorrectionDraftAction,
  createResultsInboxDraftAction,
  rejectResultsInboxCandidateAction,
  type ResultsInboxActionState,
} from "@/app/results-inbox/actions";
import {
  getResultsInboxCandidateKind,
  type ResultsInboxCandidate,
} from "@/lib/results-inbox";

const idleState: ResultsInboxActionState = { status: "idle" };

function formatStatusLabel(status: ResultsInboxCandidate["status"]): string {
  if (status === "queued") {
    return "Queued for review";
  }

  if (status === "draft-created") {
    return "Draft already created";
  }

  if (status === "rejected") {
    return "Dismissed";
  }

  return "Needs attention";
}

function formatInferenceLabel(candidate: ResultsInboxCandidate): string | null {
  if (!candidate.inferenceSource || candidate.inferenceSource === "none") {
    return null;
  }

  if (candidate.inferenceSource === "explicit-pattern") {
    return "Detected directly from message details";
  }

  if (candidate.inferenceSource === "calendar-match") {
    return "Detected from calendar match";
  }

  return "Suggested from calendar match";
}

export function ResultsInboxReviewCard({
  candidate,
}: {
  candidate: ResultsInboxCandidate;
}) {
  const kind = getResultsInboxCandidateKind(candidate);
  const [uploadCreateState, uploadCreateAction, isUploadCreatePending] = useActionState<
    ResultsInboxActionState,
    FormData
  >(createResultsInboxDraftAction, idleState);
  const [correctionCreateState, correctionCreateAction, isCorrectionCreatePending] = useActionState<
    ResultsInboxActionState,
    FormData
  >(createResultsInboxCorrectionDraftAction, idleState);
  const [rejectState, rejectAction, isRejectPending] = useActionState<
    ResultsInboxActionState,
    FormData
  >(rejectResultsInboxCandidateAction, idleState);

  const createState = kind === "minor-correction" ? correctionCreateState : uploadCreateState;
  const createAction = kind === "minor-correction" ? correctionCreateAction : uploadCreateAction;
  const isCreatePending =
    kind === "minor-correction" ? isCorrectionCreatePending : isUploadCreatePending;
  const isPending = isCreatePending || isRejectPending;
  const currentState =
    createState.status !== "idle"
      ? createState
      : rejectState;
  const correctionRequest = candidate.correctionRequest;
  const createButtonLabel =
    kind === "minor-correction"
      ? isCreatePending
        ? "Creating correction draft..."
        : "Create correction draft"
      : isCreatePending
        ? "Creating draft..."
        : "Create draft";

  return (
    <article className="rounded-2xl border border-stone-900/10 bg-stone-50/90 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-stone-500">
            {formatStatusLabel(candidate.status)}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-stone-900">{candidate.subject}</h3>
          <p className="mt-2 text-sm text-stone-700">From {candidate.sender}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-stone-500">
            Received {new Date(candidate.receivedAt).toLocaleString("en-GB")}
          </p>
          <p className="mt-1 text-xs text-stone-600">
            Source file: {candidate.fileName}
            {kind === "minor-correction"
              ? " (correction email)"
              : candidate.sourceType === "xlsx"
                ? " (XLSX converted to CSV)"
                : " (CSV)"}
            {candidate.selectedWorksheet ? `, sheet: ${candidate.selectedWorksheet}` : ""}
          </p>
        </div>
        {candidate.submissionUrl ? (
          <a
            href={candidate.submissionUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-lime-700/30 bg-lime-50 px-4 py-2 text-sm font-semibold text-lime-800 transition hover:bg-lime-100"
          >
            View draft #{candidate.submissionNumber}
          </a>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <form action={createAction} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="candidateId" value={candidate.id} />

          <label className="space-y-1 text-sm text-stone-800">
            <span className="font-semibold">Race ID</span>
            <input
              name="raceId"
              defaultValue={candidate.raceId}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
              disabled={isPending || candidate.status === "draft-created"}
            />
            {createState.fieldErrors?.raceId?.map((error) => (
              <p key={error} className="text-xs text-red-700">
                {error}
              </p>
            ))}
          </label>

          <label className="space-y-1 text-sm text-stone-800">
            <span className="font-semibold">Year</span>
            <input
              name="year"
              defaultValue={candidate.year}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
              disabled={isPending || candidate.status === "draft-created"}
            />
            {createState.fieldErrors?.year?.map((error) => (
              <p key={error} className="text-xs text-red-700">
                {error}
              </p>
            ))}
          </label>

          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isPending || candidate.status === "draft-created"}
              className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
            >
              {createButtonLabel}
            </button>
          </div>

          {kind === "minor-correction" && correctionRequest ? (
            <div className="sm:col-span-2 rounded-lg border border-stone-300 bg-white p-3 text-xs text-stone-700">
              <p className="font-semibold uppercase tracking-[0.12em] text-stone-500">
                Requested correction
              </p>
              <p className="mt-2 text-stone-700">
                {correctionRequest.changes.map((change) => `${change.field} -> ${change.value}`).join(", ")}
              </p>
              <dl className="mt-3 grid gap-1 sm:grid-cols-2">
                {correctionRequest.runnerName ? (
                  <div>
                    <dt className="font-semibold text-stone-500">Runner</dt>
                    <dd>{correctionRequest.runnerName}</dd>
                  </div>
                ) : null}
                {correctionRequest.runnerPosition ? (
                  <div>
                    <dt className="font-semibold text-stone-500">Position</dt>
                    <dd>{correctionRequest.runnerPosition}</dd>
                  </div>
                ) : null}
                {correctionRequest.runnerCategory ? (
                  <div>
                    <dt className="font-semibold text-stone-500">Category</dt>
                    <dd>{correctionRequest.runnerCategory}</dd>
                  </div>
                ) : null}
                {correctionRequest.runnerClub ? (
                  <div>
                    <dt className="font-semibold text-stone-500">Club</dt>
                    <dd>{correctionRequest.runnerClub}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : null}

          {candidate.raceMatchCandidates && candidate.raceMatchCandidates.length > 0 ? (
            <div className="sm:col-span-2 rounded-lg border border-stone-300 bg-white p-3 text-xs text-stone-700">
              <p className="font-semibold uppercase tracking-[0.12em] text-stone-500">
                Race suggestion confidence: {candidate.inferenceConfidence ?? "none"}
              </p>
              {formatInferenceLabel(candidate) ? (
                <p className="mt-1 text-stone-600">{formatInferenceLabel(candidate)}</p>
              ) : null}
              <ul className="mt-2 space-y-2">
                {candidate.raceMatchCandidates.slice(0, 3).map((match) => (
                  <li key={`${candidate.id}-${match.raceId}`}>
                    <p className="font-semibold text-stone-800">
                      {match.raceId} ({match.raceName}) - {match.score.toFixed(1)}
                    </p>
                    {match.reasons.length > 0 ? (
                      <p className="text-stone-600">{match.reasons.join(" ")}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </form>

        <form action={rejectAction}>
          <input type="hidden" name="candidateId" value={candidate.id} />
          <button
            type="submit"
            disabled={isPending || candidate.status === "draft-created" || candidate.status === "rejected"}
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:text-stone-400"
          >
            {isRejectPending ? "Dismissing..." : "Dismiss"}
          </button>
        </form>
      </div>

      {currentState.status !== "idle" ? (
        <p
          className={`mt-3 text-sm ${
            currentState.status === "success" ? "text-lime-800" : "text-red-700"
          }`}
        >
          {currentState.message}
        </p>
      ) : null}

      {candidate.errorMessage ? (
        <p className="mt-2 text-sm text-red-700">{candidate.errorMessage}</p>
      ) : null}

      {kind === "results-upload" && candidate.csvText ? (
        <details className="mt-4 rounded-lg border border-stone-300 bg-white/70 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-stone-800">
            Preview CSV ({candidate.fileName})
          </summary>
          {candidate.worksheetScores && candidate.worksheetScores.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-xs text-stone-700">
                <thead>
                  <tr className="border-b border-stone-300">
                    <th className="px-2 py-1 font-semibold">Sheet</th>
                    <th className="px-2 py-1 font-semibold">Score</th>
                    <th className="px-2 py-1 font-semibold">Errors</th>
                    <th className="px-2 py-1 font-semibold">Warnings</th>
                    <th className="px-2 py-1 font-semibold">Recognized headers</th>
                    <th className="px-2 py-1 font-semibold">Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {candidate.worksheetScores.map((sheet) => (
                    <tr key={sheet.sheetName} className="border-b border-stone-200/70">
                      <td className="px-2 py-1">{sheet.sheetName}</td>
                      <td className="px-2 py-1">{sheet.score.toFixed(2)}</td>
                      <td className="px-2 py-1">{sheet.errorCount}</td>
                      <td className="px-2 py-1">{sheet.warningCount}</td>
                      <td className="px-2 py-1">{sheet.recognizedHeaderCount}</td>
                      <td className="px-2 py-1">{sheet.dataRowCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded bg-stone-900 p-3 text-xs text-stone-100">
            {candidate.csvText}
          </pre>
        </details>
      ) : null}
    </article>
  );
}
