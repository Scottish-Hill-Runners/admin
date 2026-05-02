"use server";

import { z } from "zod";
import { contentConfig } from "@/lib/content-config";
import { createContentPullRequest, listRaceDrafts } from "@/lib/github";
import { calendarSchema, type CalendarValues } from "@/lib/calendar-schema";
import { validateCalendarCsv } from "@/lib/calendar-csv";
import { getEditorSession, buildPrAuthor } from "@/lib/auth-session";

export type CalendarActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  issues?: string[];
  fieldErrors?: Partial<Record<keyof CalendarValues, string[]>>;
};

const initialMessage =
  "Calendar rows must use yyyy-mm-dd,RaceID with one race per row.";

export async function saveCalendarDraft(
  _previousState: CalendarActionState,
  formData: FormData
): Promise<CalendarActionState> {
  const parsed = calendarSchema.safeParse({
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
  const raceItems = await listRaceDrafts();
  const knownRaceIds = raceItems.map((item) => item.raceId);
  const issues = validateCalendarCsv(values.csvText, knownRaceIds);
  const blockingIssues = issues.filter((issue) => issue.level === "error");
  const issueMessages = issues.map((issue) =>
    issue.row
      ? `${issue.level.toUpperCase()} row ${issue.row}: ${issue.message}`
      : `${issue.level.toUpperCase()}: ${issue.message}`
  );

  if (blockingIssues.length > 0) {
    return {
      status: "error",
      message: "CSV checks failed. Fix blocking issues before saving this draft.",
      issues: issueMessages,
    };
  }

  try {
    const autoMerge = formData.get("autoMerge") === "on";

    const result = await createContentPullRequest({
      title: "Calendar update",
      path: "calendar.csv",
      content: values.csvText.trimEnd() + "\n",
      commitMessage: "Update calendar.csv",
      prTitle: "Calendar: update calendar.csv",
      prBody:
        `Automated calendar draft created by ${author ? `${author.name} <${author.email}>` : "unknown"}.\n\n` +
        `- Content repo: ${contentConfig.repo}\n` +
        "- Path: calendar.csv\n" +
        `- Validation warnings: ${issues.filter((issue) => issue.level === "warning").length}`,
      branchName: `shr-admin/calendar-${Date.now()}`,
      author,
      labels: autoMerge ? ["auto-merge"] : undefined,
    });

    return {
      status: "success",
      message: `Saved draft #${result.prNumber}: ${result.prUrl}`,
      issues: issueMessages,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to save this draft.",
      issues: issueMessages.length > 0 ? issueMessages : [initialMessage],
    };
  }
}
