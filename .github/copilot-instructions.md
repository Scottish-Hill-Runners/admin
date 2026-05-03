# SHR Admin — Copilot Instructions

This is a Next.js 15+ App Router admin app (TypeScript, Tailwind CSS) for non-technical community editors managing GitHub-backed content for Scottish Hill Runners.

For full architecture, patterns, and pitfalls see [AGENTS.md](../AGENTS.md).

## UI Copy Guidelines

This app is used by non-technical community editors. All user-facing text must use plain language — never expose internal implementation details.

**Avoid → Use instead:**
- "PR" / "pull request" → "draft", "submission", or "publication request"
- "branch" / "merge" / "commit" → omit or use "save", "update"
- "staging" → "draft updates"
- "auto-merge" → "publish automatically"
- "frontmatter" → "saved fields"
- "markdown" → "text formatting" or omit
- "YAML" / `.yaml` filenames → omit; use plain descriptions ("document list", "image list")
- "slug" → "URL ending"
- "content repository" → "content store"
- "Validation" (as a heading) → "Checks"
- "GitHub credentials not configured" → "Publishing is not set up yet. Please contact an administrator."

Button labels must describe the user's intent, not the underlying mechanism (e.g., "Save draft" not "Create draft PR").
