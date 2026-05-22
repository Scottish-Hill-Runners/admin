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

function formatTime(time: string): string {
  return time.replace(/^00:/, "");
}

function formatWinnerLine(label: string, alsoWon: string[], winner: { name: string; club: string; time: string }) {
  const clubPart = winner.club ? ` (${winner.club})` : "";
  const alsoWonPart =
    alsoWon.length === 0
      ? ""
      : alsoWon.length === 1
        ? ` (also first ${alsoWon[0]})`
        : ` (also first ${alsoWon.slice(0, -1).join(", ")} and ${alsoWon[alsoWon.length - 1]})`;
  return `- ${label}${alsoWonPart}: [${winner.name}](/runner?name=${encodeURIComponent(winner.name)})${clubPart} - ${formatTime(winner.time)}`;
}

function formatWinnerInline(winner: { name: string; club: string; time: string }) {
  const clubPart = winner.club ? ` (${winner.club})` : "";
  return `${winner.name}${clubPart} in ${formatTime(winner.time)}`;
}

function toRaceTitle(raceId: string): string {
  return raceId
    .split(/[-_]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
    `## [${raceTitle} ${year} results](/races/${encodeURIComponent(raceId)}?year=${encodeURIComponent(year)})`,
    "",
    excerpt,
    winners.nonBinary
      ? `Top non-binary finisher: ${formatWinnerInline(winners.nonBinary)}.`
      : "",
    "",
    "### Highlights",
    ...winners.categoryWinners.map((cw) => formatWinnerLine(cw.label, cw.alsoWon, cw.winner)),
    `- ${winners.nEntrants} entrants in total.`,
    "",
    `Full results can be found [on the race results page](/races/${encodeURIComponent(raceId)}?year=${encodeURIComponent(year)}).`,
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
      branchName: `shr-admin/results-${raceIdBranchSegment}-${yearBranchSegment}`,
      author,
      labels: autoMerge ? ["auto-merge"] : undefined,
    });

    return {
      status: "success",
      message: shouldPrepareNewsTemplate
        ? `Saved draft #${result.prNumber}: ${result.prUrl}. Redirecting to a prefilled news template.`
        : `Saved draft #${result.prNumber}: ${result.prUrl}`,
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
          : "Failed to save this draft.",
      issues: issueMessages,
    };
  }
}
