"use server";

import { contentConfig } from "@/lib/content-config";
import { createContentPullRequest } from "@/lib/github";
import { validateRaceResultsCsv } from "@/lib/results-csv";
import {
  resultsUploadSchema,
  type ResultsUploadValues,
} from "@/lib/results-upload-schema";

export type ResultsUploadState = {
  status: "idle" | "success" | "error";
  message?: string;
  issues?: string[];
  fieldErrors?: Partial<Record<keyof ResultsUploadValues, string[]>>;
};

export async function saveResultsDraft(
  _previousState: ResultsUploadState,
  formData: FormData
): Promise<ResultsUploadState> {
  const parsed = resultsUploadSchema.safeParse({
    raceId: formData.get("resultsRaceId"),
    year: formData.get("resultsYear"),
    csvText: formData.get("csvText"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields before continuing.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const values = parsed.data;
  const issues = validateRaceResultsCsv(values.csvText);
  const blockingIssues = issues.filter((issue) => issue.level === "error");
  const issueMessages = issues.map((issue) =>
    issue.row ? `${issue.level.toUpperCase()} row ${issue.row}: ${issue.message}` : `${issue.level.toUpperCase()}: ${issue.message}`
  );

  if (blockingIssues.length > 0) {
    return {
      status: "error",
      message: "CSV validation failed. Fix the blocking issues before creating a draft PR.",
      issues: issueMessages,
    };
  }

  try {
    const result = await createContentPullRequest({
      title: `${values.raceId} ${values.year} results`,
      path: `races/${values.raceId}/${values.year}.csv`,
      content: values.csvText.trimEnd() + "\n",
      commitMessage: `Upload results: ${values.raceId} ${values.year}`,
      prTitle: `Results: ${values.raceId} ${values.year}`,
      prBody:
        `Automated results draft created by SHR Admin.\n\n` +
        `- Content repo: ${contentConfig.repo}\n` +
        `- Path: races/${values.raceId}/${values.year}.csv\n` +
        `- Validation warnings: ${issues.filter((issue) => issue.level === "warning").length}`,
      branchName: `shr-admin/results-${values.raceId.toLowerCase()}-${values.year.toLowerCase()}`,
    });

    return {
      status: "success",
      message: `Opened PR #${result.prNumber}: ${result.prUrl}`,
      issues: issueMessages,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to create the GitHub pull request.",
      issues: issueMessages,
    };
  }
}
