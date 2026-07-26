"use server";

import { z } from "zod";
import { buildPrAuthor } from "@/lib/auth-session";
import { contentConfig } from "@/lib/content-config";
import {
  getRaceResultsDraft,
  isGitHubAccessError,
  listAllClubNameSet,
  upsertContentPullRequest,
} from "@/lib/github";
import {
  applyMinorCorrectionToCsv,
  getResultsInboxCandidateKind,
  getResultsInboxCandidate,
  markResultsInboxCandidateDraftCreated,
  markResultsInboxCandidateError,
  markResultsInboxCandidateRejected,
} from "@/lib/results-inbox";
import { validateRaceResultsCsv } from "@/lib/results-csv";
import { requirePublisherAccess } from "@/lib/route-protection";

const createResultsInboxDraftSchema = z.object({
  candidateId: z.string().min(1, "Missing candidate reference."),
  raceId: z
    .string()
    .trim()
    .min(1, "Race ID is required.")
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers, and hyphens only."),
  year: z
    .string()
    .trim()
    .min(1, "Year is required.")
    .regex(/^\d{4}\*?$/, "Use a four-digit year (optional * for shortened routes)."),
});

type CreateResultsInboxDraftValues = z.infer<typeof createResultsInboxDraftSchema>;

export type ResultsInboxActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof CreateResultsInboxDraftValues, string[]>>;
};

function toBranchSafeSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createResultsInboxDraftAction(
  _previousState: ResultsInboxActionState,
  formData: FormData
): Promise<ResultsInboxActionState> {
  const session = await requirePublisherAccess();
  const author = buildPrAuthor(session);

  const parsed = createResultsInboxDraftSchema.safeParse({
    candidateId: formData.get("candidateId"),
    raceId: formData.get("raceId"),
    year: formData.get("year"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields before continuing.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const values = parsed.data;
  const candidate = await getResultsInboxCandidate(values.candidateId);
  if (!candidate) {
    return {
      status: "error",
      message: "This queued item no longer exists.",
    };
  }

  if (getResultsInboxCandidateKind(candidate) !== "results-upload" || !candidate.csvText) {
    return {
      status: "error",
      message: "This queued item is not a results file upload.",
    };
  }

  if (candidate.status === "draft-created") {
    return {
      status: "success",
      message: candidate.submissionUrl
        ? `Draft already created: ${candidate.submissionUrl}`
        : "Draft already created for this queued item.",
    };
  }

  const knownClubNames = await listAllClubNameSet();
  const issues = validateRaceResultsCsv(candidate.csvText, { knownClubNames });
  const blockingIssues = issues.filter((issue) => issue.level === "error");

  if (blockingIssues.length > 0) {
    const issueMessage = blockingIssues
      .slice(0, 3)
      .map((issue) => (issue.row ? `row ${issue.row}: ${issue.message}` : issue.message))
      .join("; ");

    await markResultsInboxCandidateError(values.candidateId, issueMessage);

    return {
      status: "error",
      message: "CSV checks failed. Resolve the file contents before creating a draft.",
    };
  }

  const warnings = issues.filter((issue) => issue.level === "warning");
  const warningsSection =
    warnings.length === 0
      ? "No validation warnings."
      : [
          `### Validation warnings (${warnings.length})`,
          ...warnings.map((issue) =>
            issue.row ? `- Row ${issue.row}: ${issue.message}` : `- ${issue.message}`
          ),
        ].join("\n");

  const raceIdBranchSegment = toBranchSafeSegment(values.raceId) || "race";
  const yearBranchSegment = toBranchSafeSegment(values.year) || "year";

  try {
    const result = await upsertContentPullRequest({
      title: `${values.raceId} ${values.year} results`,
      path: `races/${values.raceId}/${values.year}.csv`,
      content: candidate.csvText.trimEnd() + "\n",
      commitMessage: `Upload results: ${values.raceId} ${values.year}`,
      prTitle: `Results: ${values.raceId} ${values.year}`,
      prBody:
        `Added from the results inbox queue by ${session.email ?? "an administrator"}.\n\n` +
        `- Content repo: ${contentConfig.repo}\n` +
        `- Path: races/${values.raceId}/${values.year}.csv\n` +
        `- Source sender: ${candidate.sender}\n` +
        `- Source subject: ${candidate.subject}\n\n` +
        warningsSection,
      branchName: `shr-admin/results-${raceIdBranchSegment}-${yearBranchSegment}`,
      author,
    });

    await markResultsInboxCandidateDraftCreated({
      id: values.candidateId,
      submissionNumber: result.prNumber,
      submissionUrl: result.prUrl,
    });

    return {
      status: "success",
      message: `Saved draft #${result.prNumber}: ${result.prUrl}`,
    };
  } catch (error) {
    const message =
      isGitHubAccessError(error)
        ? "Publishing is not set up yet. Please contact an administrator."
        : error instanceof Error
          ? error.message
          : "Failed to create this draft from the queue.";

    await markResultsInboxCandidateError(values.candidateId, message);

    return {
      status: "error",
      message,
    };
  }
}

export async function createResultsInboxCorrectionDraftAction(
  _previousState: ResultsInboxActionState,
  formData: FormData
): Promise<ResultsInboxActionState> {
  const session = await requirePublisherAccess();
  const author = buildPrAuthor(session);

  const parsed = createResultsInboxDraftSchema.safeParse({
    candidateId: formData.get("candidateId"),
    raceId: formData.get("raceId"),
    year: formData.get("year"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields before continuing.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const values = parsed.data;
  const candidate = await getResultsInboxCandidate(values.candidateId);
  if (!candidate) {
    return {
      status: "error",
      message: "This queued item no longer exists.",
    };
  }

  if (candidate.status === "draft-created") {
    return {
      status: "success",
      message: candidate.submissionUrl
        ? `Draft already created: ${candidate.submissionUrl}`
        : "Draft already created for this queued item.",
    };
  }

  if (
    getResultsInboxCandidateKind(candidate) !== "minor-correction" ||
    !candidate.correctionRequest
  ) {
    return {
      status: "error",
      message: "This queued item is not a correction email.",
    };
  }

  const effectiveCorrection = {
    ...candidate.correctionRequest,
    raceId: values.raceId,
    year: values.year,
  };

  const existingDraft =
    (await getRaceResultsDraft(values.raceId, values.year, {
      ref: contentConfig.stagingBranch,
    })) ?? (await getRaceResultsDraft(values.raceId, values.year));

  if (!existingDraft) {
    const message = "No results file was found for this race and year.";
    await markResultsInboxCandidateError(values.candidateId, message);
    return {
      status: "error",
      message,
    };
  }

  const applied = applyMinorCorrectionToCsv(existingDraft.csvText, effectiveCorrection);
  if (applied.status !== "matched") {
    await markResultsInboxCandidateError(values.candidateId, applied.message);
    return {
      status: "error",
      message: applied.message,
    };
  }

  const knownClubNames = await listAllClubNameSet();
  const issues = validateRaceResultsCsv(applied.csvText, { knownClubNames });
  const blockingIssues = issues.filter((issue) => issue.level === "error");
  if (blockingIssues.length > 0) {
    const issueMessage = blockingIssues
      .slice(0, 3)
      .map((issue) => (issue.row ? `row ${issue.row}: ${issue.message}` : issue.message))
      .join("; ");

    await markResultsInboxCandidateError(values.candidateId, issueMessage);
    return {
      status: "error",
      message: "The corrected CSV failed checks and was not saved as a draft.",
    };
  }

  const warnings = issues.filter((issue) => issue.level === "warning");
  const warningsSection =
    warnings.length === 0
      ? "No validation warnings."
      : [
          `### Validation warnings (${warnings.length})`,
          ...warnings.map((issue) =>
            issue.row ? `- Row ${issue.row}: ${issue.message}` : `- ${issue.message}`
          ),
        ].join("\n");

  const raceIdBranchSegment = toBranchSafeSegment(values.raceId) || "race";
  const yearBranchSegment = toBranchSafeSegment(values.year) || "year";

  try {
    const result = await upsertContentPullRequest({
      title: `${values.raceId} ${values.year} results correction`,
      path: `races/${values.raceId}/${values.year}.csv`,
      content: applied.csvText,
      commitMessage: `Apply results correction: ${values.raceId} ${values.year}`,
      prTitle: `Results correction: ${values.raceId} ${values.year}`,
      prBody:
        `Applied from the results inbox correction queue by ${session.email ?? "an administrator"}.\n\n` +
        `- Content repo: ${contentConfig.repo}\n` +
        `- Path: races/${values.raceId}/${values.year}.csv\n` +
        `- Source sender: ${candidate.sender}\n` +
        `- Source subject: ${candidate.subject}\n` +
        `- Applied change: ${applied.summary}\n` +
        `- Matched row: ${applied.matchedRow.rowNumber}\n\n` +
        warningsSection,
      branchName: `shr-admin/results-correction-${raceIdBranchSegment}-${yearBranchSegment}`,
      author,
    });

    await markResultsInboxCandidateDraftCreated({
      id: values.candidateId,
      submissionNumber: result.prNumber,
      submissionUrl: result.prUrl,
    });

    return {
      status: "success",
      message: `Saved draft #${result.prNumber}: ${result.prUrl}`,
    };
  } catch (error) {
    const message =
      isGitHubAccessError(error)
        ? "Publishing is not set up yet. Please contact an administrator."
        : error instanceof Error
          ? error.message
          : "Failed to create this correction draft from the queue.";

    await markResultsInboxCandidateError(values.candidateId, message);

    return {
      status: "error",
      message,
    };
  }
}

export async function rejectResultsInboxCandidateAction(
  _previousState: ResultsInboxActionState,
  formData: FormData
): Promise<ResultsInboxActionState> {
  await requirePublisherAccess();

  const candidateId = String(formData.get("candidateId") ?? "").trim();
  if (!candidateId) {
    return { status: "error", message: "Invalid queued item reference." };
  }

  const candidate = await markResultsInboxCandidateRejected(candidateId);
  if (!candidate) {
    return { status: "error", message: "This queued item no longer exists." };
  }

  return {
    status: "success",
    message: "Queued item dismissed.",
  };
}
