"use server";

import { z } from "zod";
import matter from "gray-matter";
import { clubFormSchema, type ClubFormValues } from "@/lib/club-schema";
import { contentConfig } from "@/lib/content-config";
import { createContentPullRequest, isGitHubAccessError } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";
import { buildPrAuthor } from "@/lib/auth-session";

export type ClubActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof ClubFormValues, string[]>>;
};

function buildClubMarkdown(values: ClubFormValues): string {
  return matter.stringify(values.content.trim(), {
    name: values.name,
    ...(values.aka && values.aka.length > 0 ? { aka: values.aka } : {}),
    ...(values.web ? { web: values.web } : {}),
  });
}

export async function saveClubDraft(
  _previousState: ClubActionState,
  formData: FormData
): Promise<ClubActionState> {
  const editorSession = await requireEditorAccess();
  const author = buildPrAuthor(editorSession);

  const parsed = clubFormSchema.safeParse({
    clubId: formData.get("clubId"),
    name: formData.get("name"),
    aka: ((formData.get("aka") as string) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    web: formData.get("web"),
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
      title: values.name,
      path: `clubs/${values.clubId}.md`,
      content: buildClubMarkdown(values),
      commitMessage: `Update club info: ${values.name}`,
      prTitle: `Club info: ${values.name}`,
      prBody:
        `Automated club info draft created by ${author ? `${author.name} <${author.email}>` : "unknown"}.\n\n` +
        `- Content repo: ${contentConfig.repo}\n` +
        `- Path: clubs/${values.clubId}.md\n` +
        `- Name: ${values.name}`,
      branchName: `shr-admin/club-${values.clubId}`,
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
