"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { env } from "@/lib/env";
import {
  generateMagicToken,
  MagicLinkEmailError,
  sendMagicLinkEmail,
} from "@/lib/magic-link";

const emailSchema = z.string().email();

export type RequestMagicLinkState = {
  status: "idle" | "sent" | "error";
  error?: string;
};

function toUserFacingMagicLinkError(err: unknown): string {
  if (!(err instanceof MagicLinkEmailError)) {
    return "Failed to send sign-in email. Please try again.";
  }

  if (err.status === 401 || err.status === 403) {
    return "Email sign-in is not set up yet. Please contact an administrator.";
  }

  if (err.status === 422) {
    return "Email sign-in is not set up yet. Please contact an administrator.";
  }

  if (err.status >= 500) {
    return "The email service is temporarily unavailable. Please try again.";
  }

  return "Failed to send sign-in email. Please try again.";
}

export async function requestMagicLink(
  _prev: RequestMagicLinkState,
  formData: FormData
): Promise<RequestMagicLinkState> {
  const raw = formData.get("email");
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", error: "Please enter a valid email address." };
  }

  if (!env.RESEND_API_KEY) {
    return { status: "error", error: "Email sign-in is not configured." };
  }

  try {
    const token = await generateMagicToken(parsed.data);
    const headersList = await headers();
    const host = headersList.get("host") ?? "localhost:3000";
    const proto =
      headersList.get("x-forwarded-proto") ??
      (host.startsWith("localhost") ? "http" : "https");
    const baseUrl = env.NEXTAUTH_URL ?? `${proto}://${host}`;
    const rawCallbackUrl = formData.get("callbackUrl");
    const callbackUrl =
      typeof rawCallbackUrl === "string" &&
      rawCallbackUrl.startsWith("/") &&
      !rawCallbackUrl.startsWith("//")
        ? rawCallbackUrl
        : undefined;
    await sendMagicLinkEmail(parsed.data, token, baseUrl, callbackUrl);
    return { status: "sent" };
  } catch (err) {
    if (err instanceof MagicLinkEmailError) {
      console.error("Magic link send error", {
        status: err.status,
        responseBody: err.responseBody,
        message: err.message,
      });
    } else {
      console.error("Magic link send error", err);
    }

    return {
      status: "error",
      error: toUserFacingMagicLinkError(err),
    };
  }
}
