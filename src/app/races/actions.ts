"use server";

import matter from "gray-matter";
import { contentConfig } from "@/lib/content-config";
import { createContentPullRequest } from "@/lib/github";
import { raceFormSchema, type RaceFormValues } from "@/lib/race-schema";
import { getEditorSession, buildPrAuthor } from "@/lib/auth-session";

export type RaceActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof RaceFormValues, string[]>>;
};

function buildRaceMarkdown(values: RaceFormValues): string {
  return matter.stringify(values.content.trim(), {
    title: values.title,
    venue: values.venue,
    distance: values.distance,
    climb: values.climb || undefined,
    maleRecord: values.maleRecord || undefined,
    femaleRecord: values.femaleRecord || undefined,
    nonBinaryRecord: values.nonBinaryRecord || undefined,
    web: values.web || undefined,
    organiser: values.organiser || undefined,
  });
}

export async function saveRaceDraft(
  _previousState: RaceActionState,
  formData: FormData
): Promise<RaceActionState> {
  const parsed = raceFormSchema.safeParse({
    raceId: formData.get("raceId"),
    title: formData.get("title"),
    venue: formData.get("venue"),
    distance: formData.get("distance"),
    climb: formData.get("climb"),
    maleRecord: formData.get("maleRecord"),
    femaleRecord: formData.get("femaleRecord"),
    nonBinaryRecord: formData.get("nonBinaryRecord"),
    web: formData.get("web"),
    organiser: formData.get("organiser"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields before continuing.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const values = parsed.data;

  const editorSession = await getEditorSession();
  const author = buildPrAuthor(editorSession);

  try {
    const result = await createContentPullRequest({
      title: values.title,
      path: `races/${values.raceId}/index.md`,
      content: buildRaceMarkdown(values),
      commitMessage: `Update race info: ${values.title}`,
      prTitle: `Race info: ${values.title}`,
      prBody:
        `Automated race metadata draft created by SHR Admin.\n\n` +
        `- Content repo: ${contentConfig.repo}\n` +
        `- Path: races/${values.raceId}/index.md\n` +
        `- Venue: ${values.venue}`,
      branchName: `shr-admin/race-${values.raceId.toLowerCase()}`,
      author,
    });

    return {
      status: "success",
      message: `Opened PR #${result.prNumber}: ${result.prUrl}`,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to create the GitHub pull request.",
    };
  }
}
