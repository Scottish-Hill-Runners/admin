import { env } from "@/lib/env";

export function getEditorAllowlist(): string[] {
  const value = env.EDITOR_GITHUB_ALLOWLIST ?? "";
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEditor(username?: string | null): boolean {
  if (!username) return false;
  const allowlist = getEditorAllowlist();
  if (allowlist.length === 0) return false;
  return allowlist.includes(username.toLowerCase());
}
