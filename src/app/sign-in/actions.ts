"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { env } from "@/lib/env";
import { generateMagicToken, sendMagicLinkEmail } from "@/lib/magic-link";

const emailSchema = z.string().email();

export type RequestMagicLinkState = {
  status: "idle" | "sent" | "error";
  error?: string;
};

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
    const token = generateMagicToken(parsed.data);
    const headersList = await headers();
    const host = headersList.get("host") ?? "localhost:3000";
    const proto =
      headersList.get("x-forwarded-proto") ??
      (host.startsWith("localhost") ? "http" : "https");
    const baseUrl = env.NEXTAUTH_URL ?? `${proto}://${host}`;
    await sendMagicLinkEmail(parsed.data, token, baseUrl);
    return { status: "sent" };
  } catch (err) {
    console.error("Magic link send error:", err);
    return {
      status: "error",
      error: "Failed to send sign-in email. Please try again.",
    };
  }
}
