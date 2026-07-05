import "server-only";

import { env } from "@/lib/env";

const FACEBOOK_GRAPH_VERSION = "v23.0";

type FacebookGraphErrorResponse = {
  error?: {
    message?: string;
    code?: number;
    type?: string;
  };
};

export class FacebookIntegrationError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "FacebookIntegrationError";
    this.status = status;
  }
}

export function isFacebookIntegrationError(error: unknown): error is FacebookIntegrationError {
  return error instanceof FacebookIntegrationError;
}

function getFacebookConfig(): { pageId: string; accessToken: string } {
  if (!env.FACEBOOK_PAGE_ID || !env.FACEBOOK_PAGE_ACCESS_TOKEN) {
    throw new FacebookIntegrationError(
      "Social sharing is not set up yet. Please contact an administrator."
    );
  }

  return {
    pageId: env.FACEBOOK_PAGE_ID,
    accessToken: env.FACEBOOK_PAGE_ACCESS_TOKEN,
  };
}

export async function postToFacebookPage(message: string, link?: string): Promise<{ postId: string }> {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    throw new FacebookIntegrationError("Post text cannot be empty.");
  }

  const { pageId, accessToken } = getFacebookConfig();
  const endpoint = `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/${encodeURIComponent(pageId)}/feed`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      message: trimmedMessage,
      access_token: accessToken,
      ...(link ? { link } : {}),
    }),
    cache: "no-store",
  });

  const payload = (await response.json()) as { id?: string } & FacebookGraphErrorResponse;

  if (!response.ok || !payload.id) {
    const fallback = "Facebook could not accept this post right now.";
    const reason = payload.error?.message?.trim();
    throw new FacebookIntegrationError(reason || fallback, response.status);
  }

  return { postId: payload.id };
}

export function toFacebookPublishFailureMessage(error: unknown): string {
  if (error instanceof FacebookIntegrationError) {
    if (error.message.includes("not set up")) {
      return error.message;
    }

    if (error.status === 401 || error.status === 403) {
      return "Facebook posting is not available with the current settings. Please contact an administrator.";
    }

    return error.message || "Facebook could not accept this post right now.";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Facebook could not accept this post right now.";
}
