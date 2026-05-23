"use server";

import { z } from "zod";
import { infoFormSchema, type InfoFormValues } from "@/lib/info-schema";
import { contentConfig } from "@/lib/content-config";
import { createContentPullRequest, isGitHubAccessError } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";
import { buildPrAuthor } from "@/lib/auth-session";

export type InfoActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof InfoFormValues, string[]>>;
};

function toInfoFilePath(filePath: string): string {
  return `info/${filePath.trim()}`;
}

function toBranchSuffix(filePath: string): string {
  return filePath.trim().replace(/[/.]/g, "-");
}

export async function saveInfoDraft(
  previousState: InfoActionState,
  formData: FormData
): Promise<InfoActionState> {
  void previousState;

  const editorSession = await requireEditorAccess();
  const author = buildPrAuthor(editorSession);

  const parsed = infoFormSchema.safeParse({
    filePath: formData.get("filePath"),
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
  const targetPath = toInfoFilePath(values.filePath);
  const branchSuffix = toBranchSuffix(values.filePath);

  try {
    const autoMerge = formData.get("autoMerge") === "on";

    const result = await createContentPullRequest({
      title: values.filePath,
      path: targetPath,
      content: `${values.content.trim()}\n`,
      commitMessage: `Update info markdown: ${values.filePath}`,
      prTitle: `Info markdown: ${values.filePath}`,
      prBody:
        `Automated info markdown draft created by ${author ? `${author.name} <${author.email}>` : "unknown"}.\n\n` +
        `- Content repo: ${contentConfig.repo}\n` +
        `- Path: ${targetPath}`,
      branchName: `shr-admin/info-${branchSuffix}`,
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
