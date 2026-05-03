import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { getEditorSession } from "@/lib/auth-session";
import { env } from "@/lib/env";

function getPublisherEmails(): string[] {
  if (!env.PUBLISHER_EMAILS) return [];
  return env.PUBLISHER_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isPublisher(email: string | null | undefined): boolean {
  if (!email) return false;
  return getPublisherEmails().includes(email.toLowerCase());
}

type RequireEditorAccessOptions = {
  callbackUrl?: string;
};

function isSafeCallbackPath(path: string): boolean {
  if (!path.startsWith("/")) {
    return false;
  }

  return !path.startsWith("//");
}

export async function requireEditorAccess(options?: RequireEditorAccessOptions) {
  const result = await getEditorSession();

  if (!result.session) {
    const callbackUrl = options?.callbackUrl?.trim();
    if (callbackUrl && isSafeCallbackPath(callbackUrl)) {
      redirect(`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }

    redirect("/sign-in");
  }

  return result;
}

export async function requirePublisherAccess() {
  const result = await requireEditorAccess();
  if (!isPublisher(result.email)) {
    notFound();
  }
  return result;
}
