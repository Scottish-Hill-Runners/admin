"use server";

import {
  isGitHubAccessError,
  mergePullRequest,
  publishAndMergeToLive,
} from "@/lib/github";
import { requirePublisherAccess } from "@/lib/route-protection";
import { buildPrAuthor } from "@/lib/auth-session";

export type ManageActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export async function acceptSubmissionAction(
  previousState: ManageActionState,
  formData: FormData
): Promise<ManageActionState> {
  void previousState;

  await requirePublisherAccess();

  const raw = formData.get("pullNumber");
  const pullNumber = Number(raw);
  if (!Number.isInteger(pullNumber) || pullNumber <= 0) {
    return { status: "error", message: "Invalid submission reference." };
  }

  try {
    await mergePullRequest(pullNumber);
    return { status: "success", message: "Submission accepted and added to draft updates." };
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
          : "This submission can't be accepted right now — it may have a conflict. Contact an administrator if the problem continues.",
    };
  }
}

export async function publishLiveAction(
  previousState: ManageActionState,
  formData: FormData
): Promise<ManageActionState> {
  void previousState;
  void formData;

  const session = await requirePublisherAccess();
  const author = buildPrAuthor(session);

  try {
    await publishAndMergeToLive(author ?? undefined);
    return { status: "success", message: "Draft updates are now live." };
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
          : "Something went wrong while publishing. Contact an administrator.",
    };
  }
}
