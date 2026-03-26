import { redirect } from "next/navigation";
import { getEditorSession } from "@/lib/auth-session";

export async function requireEditorAccess() {
  const result = await getEditorSession();

  if (!result.session) {
    redirect("/sign-in");
  }

  if (!result.isAllowedEditor) {
    redirect("/sign-in?error=not-allowed");
  }

  return result;
}
