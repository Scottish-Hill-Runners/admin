"use server";

import matter from "gray-matter";
import { clubFormSchema, type ClubFormValues } from "@/lib/club-schema";
import { contentConfig } from "@/lib/content-config";
import { createContentPullRequest } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

export type ClubActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof ClubFormValues, string[]>>;
};

function buildClubMarkdown(values: ClubFormValues): string {
  const akaList = values.aka
    ? values.aka
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  return matter.stringify(values.content.trim(), {
    name: values.name,
    ...(akaList.length > 0 ? { aka: akaList } : {}),
    ...(values.web ? { web: values.web } : {}),
  });
}

export async function saveClubDraft(
  _previousState: ClubActionState,
  formData: FormData
): Promise<ClubActionState> {
  await requireEditorAccess();

  const parsed = clubFormSchema.safeParse({
    clubId: formData.get("clubId"),
    name: formData.get("name"),
    aka: formData.get("aka"),
    web: formData.get("web"),
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
      title: values.name,
      path: `clubs/${values.clubId}.md`,
      content: buildClubMarkdown(values),
      commitMessage: `Update club info: ${values.name}`,
      prTitle: `Club info: ${values.name}`,
      prBody:
        `Automated club info draft created by SHR Admin.\n\n` +
        `- Content repo: ${contentConfig.repo}\n` +
        `- Path: clubs/${values.clubId}.md\n` +
        `- Name: ${values.name}`,
      branchName: `shr-admin/club-${values.clubId.toLowerCase()}`,
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
