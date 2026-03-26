import { auth } from "@/auth";
import { isAllowedEditor } from "@/lib/editor-access";

export async function getEditorSession() {
  const session = await auth();
  const login = (session?.user as { login?: string } | undefined)?.login ?? null;

  return {
    session,
    email: session?.user?.email ?? null,
    login,
    isAllowedEditor: isAllowedEditor(login),
  };
}
