"use server";

import { z } from "zod";
import matter from "gray-matter";
import { longDistanceFormSchema, type LongDistanceFormValues } from "@/lib/long-distance-schema";
import { contentConfig } from "@/lib/content-config";
import { createContentPullRequest, isGitHubAccessError } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";
import { buildPrAuthor } from "@/lib/auth-session";

export type LongDistanceActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof LongDistanceFormValues, string[]>>;
};

function buildLongDistanceMarkdown(values: LongDistanceFormValues): string {
  return matter.stringify(values.content.trim(), { title: values.title });
}

export async function saveLongDistanceDraft(
  _previousState: LongDistanceActionState,
  formData: FormData
): Promise<LongDistanceActionState> {
  const editorSession = await requireEditorAccess();
  const author = buildPrAuthor(editorSession);

  const parsed = longDistanceFormSchema.safeParse({
    slug: formData.get("slug"),
    title: formData.get("title"),
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
      path: `long-distance/${values.slug}.md`,
      content: buildLongDistanceMarkdown(values),
      commitMessage: `Update long-distance report: ${values.title}`,
      prTitle: `Long distance: ${values.title}`,
      prBody:
        `Automated long-distance report draft created by ${author ? `${author.name} <${author.email}>` : "unknown"}.\n\n` +
        `- Content repo: ${contentConfig.repo}\n` +
        `- Path: long-distance/${values.slug}.md\n` +
        `- Title: ${values.title}`,
      branchName: `shr-admin/long-distance-${values.slug}`,
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
