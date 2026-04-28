"use server";

import { z } from "zod";
import { infoFormSchema, type InfoFormValues } from "@/lib/info-schema";
import { contentConfig } from "@/lib/content-config";
import { createContentPullRequest } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";
import { buildPrAuthor } from "@/lib/auth-session";

export type InfoActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof InfoFormValues, string[]>>;
};

const initialState: InfoActionState = {
  status: "idle",
};

function toInfoFilePath(filePath: string): string {
  return `info/${filePath.trim()}`;
}

function toBranchSuffix(filePath: string): string {
  return filePath.trim().replace(/[/.]/g, "-");
}

export async function saveInfoDraft(
  _previousState: InfoActionState = initialState,
  formData: FormData
): Promise<InfoActionState> {
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
