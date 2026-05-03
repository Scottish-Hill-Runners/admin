<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# SHR Admin — Agent Instructions

## Project Overview

**shr-admin** is a Next.js 15+ App Router admin app (TypeScript, Tailwind CSS) for non-technical community editors to manage GitHub-backed content for Scottish Hill Runners. Editors never push to `main` directly — every edit creates a short-lived branch and opens a PR against `staging`.

**Node requirement:** `>=22 <25`. Use Node 22 LTS. Avoid Node 25 (heap OOM with Next.js).

## Commands

```sh
npm run dev    # Development server (port 3000) — also available as VS Code task "Next: dev"
npm run build  # Production build
npm run lint   # ESLint
```

## Architecture

### GitHub as Content Backend

Content lives in a separate repository (default: `Scottish-Hill-Runners/contents`, configured via `CONTENT_REPO`).

**Branch strategy:**
- `main` — live content only
- `staging` — accumulates approved edits
- `shr-admin/<type>-<id>` — short-lived per-edit branches created by the admin app

**Edit flow:** editor form → Zod validation → `createContentPullRequest()` in `src/lib/github.ts` → PR targeting `staging`. Editors tick "Minor correction" to add the `auto-merge` label; the content repo's workflow then squash-merges automatically.

Publishing: `publishStagingToLive()` creates a `staging → main` PR.

### Authentication

See `src/auth.ts` and `src/lib/auth-session.ts`.

- Providers: GitHub OAuth, Google OAuth, Microsoft Entra ID, magic-link email (Resend)
- JWT sessions (no database)
- `getEditorSession()` — extracts email + GitHub login + `isEditor` flag
- `requireEditorAccess()` — redirects to `/sign-in` if unauthenticated
- `requirePublisherAccess()` — also checks `PUBLISHER_EMAILS` env var (comma-separated, lowercase)

### Server Actions Pattern

All content writes use `"use server"` actions in `src/app/<route>/actions.ts`. There are no REST API routes for content editing. Client components use `useActionState()`.

**Action return type pattern:**

```typescript
type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof FormValues, string[]>>;
  prUrl?: string;
  prNumber?: number;
};
```

### Validation

Every content type has a Zod schema in `src/lib/*-schema.ts`. Use `schema.safeParse()` and flatten errors via `.flatten().fieldErrors`.

### Markdown + Frontmatter

Use `gray-matter` to build and parse content files:

```typescript
import matter from "gray-matter";
const fileContent = matter.stringify(markdownBody.trim(), { title, date, excerpt });
const { data, content } = matter(rawFileContent);
```

### GitHub Client (`src/lib/github.ts`)

- `getGitHubClient()` — returns Octokit; supports PAT (`GITHUB_TOKEN`) or GitHub App credentials
- `requestGitHubGet<T>()` — GET with in-memory ETag cache (5 min TTL, 250 entry cap)
- `createContentPullRequest({ path, content, branchName, prTitle, labels? })` — single-file PR
- `createContentPullRequestWithFiles(...)` — multi-file PR variant
- `normalizeRepoPath()` — always use this when constructing repo paths
- `toSafeRepoPathSegment()` — validates kebab-case segments; rejects `..`, `.`, backslashes

## Content Type → File Path Mapping

| Content type | Path in content repo |
|---|---|
| News article | `news/{YYYY}/{YYYY-MM-DD}-{suffix}.md` |
| Race metadata | `races/{raceId}/index.md` |
| Race results | `races/{raceId}/{year}.csv` |
| Club info | `clubs/{clubId}/index.md` |
| Info/handbook page | `info/{path}.md` |
| Long distance report | `long-distance/{slug}.md` |
| Homepage images | `collections/homepage-images.yaml` |
| Documents | `collections/documents.yaml` |
| Committee portraits | `collections/committee-portraits.yaml` |
| Race images | `collections/races/{raceId}-images.yaml` |
| Calendar | `calendar.csv` |

## Key Files

| File | Purpose |
|---|---|
| `src/lib/github.ts` | All GitHub API interactions |
| `src/lib/env.ts` | Zod-validated env vars with defaults |
| `src/lib/content-config.ts` | `CONTENT_REPO`, `CONTENT_BRANCH`, `CONTENT_STAGING_BRANCH` resolved values |
| `src/lib/route-protection.ts` | Auth guards used at top of server components/actions |
| `src/components/editorial-shell.tsx` | Layout wrapper for all editor pages (nav, header, session info) |
| `src/lib/*-schema.ts` | Zod schemas per content type |

## Required Environment Variables

```env
AUTH_SECRET=                    # Random secret for NextAuth
NEXTAUTH_URL=                   # Full URL for OAuth callbacks

# GitHub credentials (use one)
GITHUB_TOKEN=                   # Personal access token
# OR
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_APP_INSTALLATION_ID=

# Content repo (these have defaults shown)
CONTENT_REPO=Scottish-Hill-Runners/contents
CONTENT_BRANCH=main
CONTENT_STAGING_BRANCH=staging

# Auth providers (enable only those in use)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_ENTRA_ID_CLIENT_ID=
MICROSOFT_ENTRA_ID_CLIENT_SECRET=
MICROSOFT_ENTRA_ID_TENANT_ID=

# Magic-link email
RESEND_API_KEY=
EMAIL_FROM=

# Publisher access
PUBLISHER_EMAILS=               # Comma-separated, lowercase
```

## Known Pitfalls

- **Cache map** in `github.ts`: in-memory ETag cache has a cap of 250 entries; adding unbounded keys causes eviction.
- **`listReservedNewsSlugSuffixes()`** scans the full news tree + all open PR files on every call — avoid calling in tight loops.
- **Node version**: Next.js 16 + Node 25 triggers JS heap OOM. Keep Node 22 LTS.
- **`clubId` format**: alphanumeric only, no hyphens (unlike other IDs which are kebab-case).

## UI Copy Rules

See `.github/copilot-instructions.md` for the full plain-language copy substitution table. Summary: never expose GitHub concepts (PR, branch, merge, frontmatter, YAML, slug) to editors. Use "draft", "save", "URL ending", "saved fields" instead.
