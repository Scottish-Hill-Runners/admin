"use server";

import matter from "gray-matter";
import { longDistanceFormSchema, type LongDistanceFormValues } from "@/lib/long-distance-schema";
import { contentConfig } from "@/lib/content-config";
import { createContentPullRequest } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

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
  await requireEditorAccess();

  const parsed = longDistanceFormSchema.safeParse({
    slug: formData.get("slug"),
    title: formData.get("title"),
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
      path: `long-distance/${values.slug}.md`,
      content: buildLongDistanceMarkdown(values),
      commitMessage: `Update long-distance report: ${values.title}`,
      prTitle: `Long distance: ${values.title}`,
      prBody:
        `Automated long-distance report draft created by SHR Admin.\n\n` +
        `- Content repo: ${contentConfig.repo}\n` +
        `- Path: long-distance/${values.slug}.md\n` +
        `- Title: ${values.title}`,
      branchName: `shr-admin/long-distance-${values.slug}`,
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
