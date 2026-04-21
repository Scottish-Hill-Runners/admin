"use server";

import matter from "gray-matter";
import {
  championshipFormSchema,
  type ChampionshipFormValues,
} from "@/lib/championship-schema";
import { contentConfig } from "@/lib/content-config";
import { createContentPullRequest } from "@/lib/github";
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
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const values = parsed.data;

  try {
    const result = await createContentPullRequest({
      title: values.title,
      path: `championships/${values.championshipId}.md`,
      content: buildChampionshipMarkdown(values),
      commitMessage: `Update championship info: ${values.title}`,
      prTitle: `Championship: ${values.title}`,
      prBody:
        `Automated championship draft created by SHR Admin.\n\n` +
        `- Content repo: ${contentConfig.repo}\n` +
        `- Path: championships/${values.championshipId}.md\n` +
        `- Title: ${values.title}`,
      branchName: `shr-admin/championship-${values.championshipId.toLowerCase()}`,
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
