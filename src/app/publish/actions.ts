"use server";

import { publishStagingToLive } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";
import { buildPrAuthor } from "@/lib/auth-session";

export type PublishActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  prUrl?: string;
};

export async function publishStagingAction(
  previousState: PublishActionState,
  formData: FormData
): Promise<PublishActionState> {
  void previousState;
  void formData;

  const editorSession = await requireEditorAccess();
  const author = buildPrAuthor(editorSession);

  try {
    const result = await publishStagingToLive(author ?? undefined);

    if (result.alreadyExists) {
      return {
        status: "success",
        message: `A publish PR already exists: #${result.prNumber}`,
        prUrl: result.prUrl,
      };
    }

    return {
      status: "success",
      message: `Opened publish PR #${result.prNumber}. Merge it to deploy all staged changes.`,
      prUrl: result.prUrl,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to submit the publication request.",
    };
  }
}
