"use server";

import { z } from "zod";
import {
  closePullRequest,
  isGitHubAccessError,
  listPublishNewsCandidates,
  mergePullRequest,
  publishAndMergeToLive,
} from "@/lib/github";
import { requirePublisherAccess } from "@/lib/route-protection";
import { buildPrAuthor } from "@/lib/auth-session";
import {
  postToFacebookPage,
  toFacebookPublishFailureMessage,
} from "@/lib/facebook";
import { env } from "@/lib/env";

const publishLiveRequestSchema = z.object({
  facebookPostEnabled: z.boolean().default(false),
  facebookSelectedSlugs: z
    .array(z.string().regex(/^\d{4}\/\d{4}-\d{2}-\d{2}(?:-[a-z0-9-]+)?$/))
    .max(25)
    .default([]),
});

type SocialFailureItem = {
  slug: string;
  title: string;
  reason: string;
};

export type ManageActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  socialResult?: {
    postedCount: number;
    failedCount: number;
    failedItems: SocialFailureItem[];
  };
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

export async function rejectSubmissionAction(
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
    await closePullRequest(pullNumber);
    return { status: "success", message: "Submission rejected." };
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
          : "This submission can't be rejected right now. Contact an administrator if the problem continues.",
    };
  }
}

export async function publishLiveAction(
  previousState: ManageActionState,
  formData: FormData
): Promise<ManageActionState> {
  void previousState;

  const parsedRequest = publishLiveRequestSchema.safeParse({
    facebookPostEnabled: formData.get("facebookPostEnabled") === "on",
    facebookSelectedSlugs: formData
      .getAll("facebookSelectedSlugs")
      .map((value) => String(value)),
  });

  if (!parsedRequest.success) {
    return {
      status: "error",
      message: "Please review the social posting options and try again.",
    };
  }

  const session = await requirePublisherAccess();
  const author = buildPrAuthor(session);

  const selectedFacebookPosts: Array<{ slug: string; title: string; message: string, link?: string }> = [];

  if (parsedRequest.data.facebookPostEnabled) {
    if (parsedRequest.data.facebookSelectedSlugs.length === 0) {
      return {
        status: "error",
        message: "Choose at least one news update to post on Facebook, or untick the Facebook option.",
      };
    }

    if (!env.PUBLIC_SITE_BASE_URL) {
      return {
        status: "error",
        message: "Social sharing is not set up yet. Please contact an administrator.",
      };
    }

    if (!env.FACEBOOK_PAGE_ID || !env.FACEBOOK_PAGE_ACCESS_TOKEN) {
      return {
        status: "error",
        message: "Social sharing is not set up yet. Please contact an administrator.",
      };
    }

    const publishNewsCandidates = await listPublishNewsCandidates();
    const candidateBySlug = new Map(publishNewsCandidates.map((candidate) => [candidate.slug, candidate]));
    const uniqueSlugs = Array.from(new Set(parsedRequest.data.facebookSelectedSlugs));

    for (const slug of uniqueSlugs) {
      const candidate = candidateBySlug.get(slug);
      if (!candidate) {
        return {
          status: "error",
          message:
            "One or more selected news updates are no longer in this publish batch. Refresh and try again.",
        };
      }

      const rawEditedText = formData.get(`facebookPostText:${slug}`);
      const editedText = typeof rawEditedText === "string" ? rawEditedText.trim() : "";
      const message = editedText || candidate.excerpt.trim();

      if (!message.trim()) {
        return {
          status: "error",
          message: `Post text for \"${candidate.title}\" cannot be empty.`,
        };
      }

      selectedFacebookPosts.push({
        slug,
        title: candidate.title,
        message,
        link: candidate.link ? `${env.PUBLIC_SITE_BASE_URL}${candidate.link}` : undefined,
      });
    }
  }

  try {
    await publishAndMergeToLive(author ?? undefined);

    if (!parsedRequest.data.facebookPostEnabled || selectedFacebookPosts.length === 0) {
      return { status: "success", message: "Draft updates are now live." };
    }

    let postedCount = 0;
    const failedItems: SocialFailureItem[] = [];

    for (const post of selectedFacebookPosts) {
      try {
        await postToFacebookPage(post.message, post.link);
        postedCount += 1;
      } catch (error) {
        failedItems.push({
          slug: post.slug,
          title: post.title,
          reason: toFacebookPublishFailureMessage(error),
        });
      }
    }

    if (failedItems.length === 0) {
      return {
        status: "success",
        message:
          selectedFacebookPosts.length === 1
            ? "Draft updates are now live. The selected news update was posted to Facebook."
            : `Draft updates are now live. ${selectedFacebookPosts.length} news updates were posted to Facebook.`,
        socialResult: {
          postedCount,
          failedCount: 0,
          failedItems: [],
        },
      };
    }

    return {
      status: "success",
      message:
        postedCount > 0
          ? `Draft updates are now live. ${postedCount} Facebook post${postedCount === 1 ? "" : "s"} succeeded and ${failedItems.length} failed.`
          : `Draft updates are now live, but Facebook posting failed for ${failedItems.length} news update${failedItems.length === 1 ? "" : "s"}.`,
      socialResult: {
        postedCount,
        failedCount: failedItems.length,
        failedItems,
      },
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
          : "Something went wrong while publishing. Contact an administrator.",
    };
  }
}
