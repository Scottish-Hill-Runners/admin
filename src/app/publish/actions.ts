"use server";

import { isGitHubAccessError, publishStagingToLive } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";
import { buildPrAuthor } from "@/lib/auth-session";

export type PublishActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  prUrl?: string;
  requestNumber?: number;
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
        message: `A publication request already exists: #${result.prNumber}`,
        prUrl: result.prUrl,
        requestNumber: result.prNumber,
      };
    }

    return {
      status: "success",
      message: `Opened publication request #${result.prNumber}. Approve it to send staged changes live.`,
      prUrl: result.prUrl,
      requestNumber: result.prNumber,
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
          : "Failed to submit the publication request.",
    };
  }
}
