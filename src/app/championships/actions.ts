"use server";

import { z } from "zod";
import matter from "gray-matter";
import {
  championshipFormSchema,
  type ChampionshipFormValues,
} from "@/lib/championship-schema";
import { contentConfig } from "@/lib/content-config";
import { createContentPullRequest, isGitHubAccessError } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";
import { buildPrAuthor } from "@/lib/auth-session";

export type ChampionshipActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof ChampionshipFormValues, string[]>>;
};

function buildChampionshipMarkdown(values: ChampionshipFormValues): string {
  const frontmatter: Record<string, string> = { title: values.title };
  for (const { year, races } of values.yearEntries) {
    frontmatter[year] = races;
  }
  return matter.stringify(values.content.trim(), frontmatter);
}

export async function saveChampionshipDraft(
  _previousState: ChampionshipActionState,
  formData: FormData
): Promise<ChampionshipActionState> {
  const editorSession = await requireEditorAccess();
  const author = buildPrAuthor(editorSession);

  const parsed = championshipFormSchema.safeParse({
    championshipId: formData.get("championshipId"),
    title: formData.get("title"),
    yearEntries: formData.get("yearEntries"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields before continuing.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const values = parsed.data;

  try {
    const autoMerge = formData.get("autoMerge") === "on";

    const result = await createContentPullRequest({
      title: values.title,
      path: `championships/${values.championshipId}.md`,
      content: buildChampionshipMarkdown(values),
      commitMessage: `Update championship info: ${values.title}`,
      prTitle: `Championship: ${values.title}`,
      prBody:
        `Automated championship draft created by ${author ? `${author.name} <${author.email}>` : "unknown"}.\n\n` +
        `- Content repo: ${contentConfig.repo}\n` +
        `- Path: championships/${values.championshipId}.md\n` +
        `- Title: ${values.title}`,
      branchName: `shr-admin/championship-${values.championshipId}`,
      author,
      labels: autoMerge ? ["auto-merge"] : undefined,
    });

    return {
      status: "success",
      message: `Saved draft #${result.prNumber}: ${result.prUrl}`,
    };
  } catch (error) {
    if (isGitHubAccessError(error)) {
      return {
        status: "error",
        message: "Publishing is not set up yet. Please contact an administrator.",
      };
    }

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to save this draft.",
    };
  }
}
