"use server";

import { z } from "zod";
import { contentConfig } from "@/lib/content-config";
import { createContentPullRequest, listAllClubNameSet } from "@/lib/github";
import {
  extractRaceResultsWinnerSummary,
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
  redirectToNewsUrl?: string;
};

function formatWinnerLine(label: string, winner: { name: string; club: string; time: string } | null) {
  if (!winner) {
    return "";
  }

  const clubPart = winner.club ? ` (${winner.club})` : "";
  return `- ${label}: ${winner.name}${clubPart} - ${winner.time}`;
}

function formatWinnerInline(winner: { name: string; club: string; time: string }) {
  const clubPart = winner.club ? ` (${winner.club})` : "";
  return `${winner.name}${clubPart} in ${winner.time}`;
}

function toRaceTitle(raceId: string): string {
  return raceId
    .split(/[-_]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toOrdinal(day: number): string {
  const remainder100 = day % 100;
  if (remainder100 >= 11 && remainder100 <= 13) {
    return `${day}th`;
  }

  const remainder10 = day % 10;
  if (remainder10 === 1) {
    return `${day}st`;
  }

  if (remainder10 === 2) {
    return `${day}nd`;
  }

  if (remainder10 === 3) {
    return `${day}rd`;
  }

  return `${day}th`;
}

function formatLeadDate(dateIso: string): string {
  const parsed = new Date(`${dateIso}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return dateIso;
  }

  const weekday = parsed.toLocaleDateString("en-GB", {
    weekday: "long",
    timeZone: "UTC",
  });
  const month = parsed.toLocaleDateString("en-GB", {
    month: "long",
    timeZone: "UTC",
  });

  return `${weekday} ${toOrdinal(parsed.getUTCDate())} ${month}`;
}

function buildLeadSentence(
  raceTitle: string,
  leadDate: string,
  winners: ReturnType<typeof extractRaceResultsWinnerSummary>
): string {
  if (winners.male && winners.female) {
    return `Wins for ${formatWinnerInline(winners.male)} and ${formatWinnerInline(winners.female)} at the ${raceTitle} race on ${leadDate}.`;
  }

  if (winners.overall) {
    return `Win for ${formatWinnerInline(winners.overall)} at the ${raceTitle} race on ${leadDate}.`;
  }

  return `Results are now available for the ${raceTitle} race on ${leadDate}.`;
}

function buildNewsPrefillUrl(raceId: string, year: string, csvText: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const winners = extractRaceResultsWinnerSummary(csvText);
  const raceTitle = toRaceTitle(raceId);
  const leadDate = formatLeadDate(today);
  const title = `${raceTitle} ${year} results`;
  const excerpt = buildLeadSentence(raceTitle, leadDate, winners);
  const content = [
    `## ${raceTitle} ${year} results`,
    "",
    buildLeadSentence(raceTitle, leadDate, winners),
    winners.nonBinary
      ? `Top non-binary finisher: ${formatWinnerInline(winners.nonBinary)}.`
      : "",
    "",
    "### Winners",
    formatWinnerLine("Overall", winners.overall),
    formatWinnerLine("Men", winners.male),
    formatWinnerLine("Women", winners.female),
    formatWinnerLine("Non-binary", winners.nonBinary),
    "",
    "Congratulations to all runners and thanks to organisers and volunteers.",
  ].join("\n");

  const params = new URLSearchParams({
    fromResults: "1",
    prefillDate: today,
    prefillTitle: title,
    prefillExcerpt: excerpt,
    prefillContent: content,
  });

  return `/news?${params.toString()}`;
}

export async function saveResultsDraft(
  _previousState: ResultsUploadState,
  formData: FormData
): Promise<ResultsUploadState> {
  const shouldPrepareNewsTemplate = formData.get("prepareNewsTemplate") === "on";
  const parsed = resultsUploadSchema.safeParse({
    raceId: formData.get("resultsRaceId"),
    year: formData.get("resultsYear"),
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
      message: "CSV validation failed. Fix the blocking issues before creating a draft PR.",
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

    const result = await createContentPullRequest({
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
      branchName: `shr-admin/results-${values.raceId.toLowerCase()}-${values.year.toLowerCase()}`,
      author,
    });

    return {
      status: "success",
      message: shouldPrepareNewsTemplate
        ? `Opened PR #${result.prNumber}: ${result.prUrl}. Redirecting to a prefilled news template.`
        : `Opened PR #${result.prNumber}: ${result.prUrl}`,
      issues: issueMessages,
      redirectToNewsUrl: shouldPrepareNewsTemplate
        ? buildNewsPrefillUrl(values.raceId, values.year, values.csvText)
        : undefined,
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
