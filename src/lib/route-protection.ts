import { redirect } from "next/navigation";
import { getEditorSession } from "@/lib/auth-session";

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
