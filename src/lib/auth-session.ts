import { auth } from "@/auth";

export async function getEditorSession() {
  const session = { user: { email: "jham005@gmail.com", name: "Editor", login: "editor" } }; // await auth();
  const login = (session?.user as { login?: string } | undefined)?.login ?? null;

  return {
    session,
    email: session?.user?.email ?? null,
    login,
    isEditor: !!session,
  };
}

type EditorSession = Awaited<ReturnType<typeof getEditorSession>>;

export function buildPrAuthor(
  editorSession: EditorSession
): { name: string; email: string } | undefined {
  const email = editorSession.email;
  if (!email) return undefined;
  const name = editorSession.session?.user?.name || email.split("@")[0];
  return { name, email };
}
