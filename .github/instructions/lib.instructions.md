---
description: "Use when creating or editing files in src/lib — covers Zod schema naming, GitHub query functions, path safety, env vars, and content-types conventions."
applyTo: "src/lib/**"
---

# src/lib Conventions

## Schema Files (`*-schema.ts`)

Every content type has one schema file. Follow this structure exactly:

```typescript
import { z } from "zod";

export const exampleFormSchema = z.object({
  exampleId: z
    .string()
    .min(1, "ID is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only"),
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  web: z.union([z.literal(""), z.string().url("Enter a valid URL")]).optional(),
  content: z.string().min(1, "Body is required"),
});

export type ExampleFormValues = z.infer<typeof exampleFormSchema>;
```

**Naming rules:**
- Schema variable: `${contentType}FormSchema` (camelCase)
- Inferred type: `${ContentType}FormValues` (PascalCase)

**ID field regex by content type:**
- Race / championship: `/^[A-Za-z0-9-]+$/` (kebab-case, mixed case allowed)
- Club: `/^[A-Za-z0-9]+$/` — **no hyphens** — this is the one exception
- Slug (news suffix, long-distance): `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` (strict lowercase kebab)
- Info file path: `/^(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*[a-z0-9]+(?:-[a-z0-9]+)*\.md$/`

**Optional URL pattern** (blank or valid URL):
```typescript
web: z.union([z.literal(""), z.string().url("Enter a valid URL")]).optional(),
```

**Normalise before validation** with `.trim()` or `.transform()`:
```typescript
content: z.string().trim().min(1, "Body is required"),
```

## GitHub Query Functions (`github.ts`)

When adding a new query function, follow the existing patterns:

**Listing items:**
```typescript
export async function listExampleDrafts(): Promise<ExampleListItem[]> {
  const client = getGitHubClient();
  if (!client) return [];
  const files = await getRepositoryFiles("example", "md");
  // parse + return list items
}
```

**Fetching a single item:**
```typescript
export async function getExampleDraft(exampleId: string): Promise<ExampleFormData | null> {
  const safeId = toSafeRepoPathSegment(exampleId);
  if (!safeId) return null;
  const raw = await getContentFile(normalizeRepoPath(`example/${safeId}/index.md`));
  // parse frontmatter + return
}
```

**Path safety rules — always enforce both:**
1. `toSafeRepoPathSegment(value)` — validates a single path segment (rejects `.`, `..`, slashes, backslashes). Returns `null` on failure; bail out and return `null` from the caller.
2. `normalizeRepoPath(path)` — strips leading slashes, removes `contents/` prefix, decodes URI encoding. Always call this when constructing the final path string.

**ETag cache:**
- All GET requests go through `requestGitHubGet<T>(client, route, params)` — do not call `client.request()` directly.
- Cache cap is 250 entries with LRU eviction; avoid adding functions that produce unbounded unique cache keys (e.g., don't cache per-character user input).

**PR creation — use the shared helper, never roll your own:**
```typescript
const result = await createContentPullRequest({
  title: values.title,
  path: normalizeRepoPath(`example/${safeId}/index.md`),
  content: matter.stringify(values.content.trim(), { title: values.title }),
  commitMessage: `Update example: ${values.title}`,
  prTitle: `Example: ${values.title}`,
  branchName: `shr-admin/example-${safeId}`,
  author,         // from buildPrAuthor(session)
  labels,         // ["auto-merge"] or undefined
});
// result: { prNumber, prUrl, ... }
```

## Content Types (`content-types.ts`)

This file contains **only TypeScript type definitions** — no implementation, no imports from `zod`.

Type families follow this naming:
- Frontmatter shape: `ExampleFrontmatter`
- Full form data: `ExampleFormData` (matches the Zod inferred type from the schema)
- List item (for index pages): `ExampleListItem`

## Environment Variables (`env.ts`)

Add new env vars to the `envSchema` object using the `optStr` preprocessor for optional strings:

```typescript
// Optional string (empty string → undefined):
MY_VAR: z.preprocess(optStr, z.string().optional()),

// Required string:
MY_REQUIRED: z.string().min(1),

// Boolean (accepts "1", "true", "yes", "on"):
MY_FLAG: z.preprocess(boolStr, z.boolean().default(false)),
```

Access env vars only via `import { env } from "@/lib/env"` — never via `process.env` directly in application code.

## Content Config (`content-config.ts`)

Use `contentConfig` for all references to the content repo, branch, and staging branch — never hard-code these strings:

```typescript
import { contentConfig } from "@/lib/content-config";

contentConfig.repo           // e.g. "Scottish-Hill-Runners/contents"
contentConfig.branch         // e.g. "main"
contentConfig.stagingBranch  // e.g. "staging"
```

## Route Protection (`route-protection.ts`)

- `requireEditorAccess({ callbackUrl? })` — call at the top of server components and server actions; redirects to `/sign-in` if unauthenticated.
- `requirePublisherAccess()` — for publish-only routes; 404s for non-publishers.
- `isPublisher(email)` — for conditional UI only; never use as a security gate (use `requirePublisherAccess()` instead).

## Auth Session (`auth-session.ts`)

- `getEditorSession()` — returns `{ email, login, isEditor }`.
- `buildPrAuthor(session)` — returns `{ name, email }` or `undefined`; always pass this to `createContentPullRequest` as `author`.
