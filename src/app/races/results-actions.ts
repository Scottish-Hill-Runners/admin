"use server";

import { z } from "zod";
import { contentConfig } from "@/lib/content-config";
import {
  upsertContentPullRequest,
  isGitHubAccessError,
  listAllClubNameSet,
} from "@/lib/github";
import {
  validateRaceResultsCsv,
} from "@/lib/results-csv";
import {
  resultsUploadSchema,
  type ResultsUploadValues,
} from "@/lib/results-upload-schema";
import { getEditorSession, buildPrAuthor } from "@/lib/auth-session";

export type ResultsUploadState = {
  status: "idle" | "success" | "error";
  message?: string;
  issues?: string[];
  fieldErrors?: Partial<Record<keyof ResultsUploadValues, string[]>>;
  redirectToWorkflowUrl?: string;
  submissionNumber?: number;
  submissionUrl?: string;
};

function toSafeReturnPath(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return undefined;
  }

  return trimmed;
}

function applyShortenedRouteToYear(year: string, shortenedRoute: boolean): string {
  const baseYear = year.trim().replace(/\*+$/g, "");
  if (!baseYear) {
    return "";
  }

  return shortenedRoute ? `${baseYear}*` : baseYear;
}

function toBranchSafeSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function appendQueryParam(path: string, key: string, value: string): string {
  const [pathname, search = ""] = path.split("?", 2);
  const params = new URLSearchParams(search);
  params.set(key, value);
  const nextSearch = params.toString();
  return nextSearch ? `${pathname}?${nextSearch}` : pathname;
}

export async function saveResultsDraft(
  _previousState: ResultsUploadState,
  formData: FormData
): Promise<ResultsUploadState> {
  const returnToWorkflowUrl = toSafeReturnPath(formData.get("returnToWorkflowUrl"));
  const shortenedRoute = formData.get("shortenedRoute") === "on";
  const submittedYear = formData.get("resultsYear");
  const parsed = resultsUploadSchema.safeParse({
    raceId: formData.get("resultsRaceId"),
    year:
      typeof submittedYear === "string"
        ? applyShortenedRouteToYear(submittedYear, shortenedRoute)
        : submittedYear,
    csvText: formData.get("csvText"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields before continuing.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const values = parsed.data;
  const editorSession = await getEditorSession();
  const author = buildPrAuthor(editorSession);
  const knownClubNames = await listAllClubNameSet();
  const issues = validateRaceResultsCsv(values.csvText, { knownClubNames });
  const blockingIssues = issues.filter((issue) => issue.level === "error");
  const issueMessages = issues.map((issue) =>
    issue.row ? `${issue.level.toUpperCase()} row ${issue.row}: ${issue.message}` : `${issue.level.toUpperCase()}: ${issue.message}`
  );

  if (blockingIssues.length > 0) {
    return {
      status: "error",
      message: "CSV checks failed. Fix the blocking issues before saving this draft.",
      issues: issueMessages,
    };
  }

  try {
    const warnings = issues.filter((issue) => issue.level === "warning");
    const uploaderName = editorSession.session?.user?.name ?? editorSession.email ?? "unknown";
    const uploaderEmail = editorSession.email;
    const uploaderLine = uploaderEmail
      ? `Uploaded by ${uploaderName} (${uploaderEmail}).`
      : `Uploaded by ${uploaderName}.`;

    const warningsSection =
      warnings.length === 0
        ? "No validation warnings."
        : [
            `### Validation warnings (${warnings.length})`,
            ...warnings.map((issue) =>
              issue.row
                ? `- Row ${issue.row}: ${issue.message}`
                : `- ${issue.message}`
            ),
          ].join("\n");

    const autoMerge = formData.get("autoMerge") === "on";
    const raceIdBranchSegment = toBranchSafeSegment(values.raceId) || "race";
    const yearBranchSegment = toBranchSafeSegment(values.year) || "year";

    const result = await upsertContentPullRequest({
      title: `${values.raceId} ${values.year} results`,
      path: `races/${values.raceId}/${values.year}.csv`,
      content: values.csvText.trimEnd() + "\n",
      commitMessage: `Upload results: ${values.raceId} ${values.year}`,
      prTitle: `Results: ${values.raceId} ${values.year}`,
      prBody:
        `${uploaderLine}\n\n` +
        `- Content repo: ${contentConfig.repo}\n` +
        `- Path: races/${values.raceId}/${values.year}.csv\n\n` +
        warningsSection,
      branchName: `shr-admin/results-${raceIdBranchSegment}-${yearBranchSegment}`,
      author,
      labels: autoMerge ? ["auto-merge"] : undefined,
    });

    return {
      status: "success",
      message: returnToWorkflowUrl
        ? `Saved draft #${result.prNumber}: ${result.prUrl}. Returning to your workflow.`
        : `Saved draft #${result.prNumber}: ${result.prUrl}`,
      issues: issueMessages,
      redirectToWorkflowUrl: returnToWorkflowUrl
        ? appendQueryParam(returnToWorkflowUrl, "resultsSubmission", String(result.prNumber))
        : undefined,
      submissionNumber: result.prNumber,
      submissionUrl: result.prUrl,
    };
  } catch (error) {
    if (isGitHubAccessError(error)) {
      return {
        status: "error",
        message: "Publishing is not set up yet. Please contact an administrator.",
        issues: issueMessages,
      };
    }

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to save this draft.",
      issues: issueMessages,
    };
  }
}
