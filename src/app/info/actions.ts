"use server";

import { infoFormSchema, type InfoFormValues } from "@/lib/info-schema";
import { contentConfig } from "@/lib/content-config";
import { createContentPullRequest } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

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
  await requireEditorAccess();

  const parsed = infoFormSchema.safeParse({
    filePath: formData.get("filePath"),
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
        `Automated info markdown draft created by SHR Admin.\n\n` +
        `- Content repo: ${contentConfig.repo}\n` +
        `- Path: ${targetPath}`,
      branchName: `shr-admin/info-${branchSuffix}`,
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
