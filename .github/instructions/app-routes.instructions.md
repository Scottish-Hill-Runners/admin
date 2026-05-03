---
description: "Use when creating or editing route files in src/app — page.tsx, actions.ts, or new content-type routes. Covers auth guards, EditorialShell, server action shape, Zod validation, and GitHub PR creation patterns."
applyTo: "src/app/**"
---

# App Route Conventions

## page.tsx — Server Component Structure

Every route page must follow this shape:

```typescript
import { EditorialShell } from "@/components/editorial-shell";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function ExamplePage() {
  await requireEditorAccess({ callbackUrl: "/example" });
  // fetch data from GitHub here (e.g. listExampleDrafts())

  return (
    <EditorialShell eyebrow="..." title="..." description="...">
      {/* list + form */}
    </EditorialShell>
  );
}
```

- **Always `async`** — route pages fetch from GitHub before rendering.
- **`requireEditorAccess()` is the first `await`** — no rendering before the auth check.
- **Publisher-only pages** use `requirePublisherAccess()` instead.
- **Always wrapped in `<EditorialShell>`** — never render page content outside it.

## actions.ts — Server Action Structure

```typescript
"use server";

import { z } from "zod";
import matter from "gray-matter";
import { exampleFormSchema, type ExampleFormValues } from "@/lib/example-schema";
import { contentConfig } from "@/lib/content-config";
import { createContentPullRequest } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";
import { buildPrAuthor } from "@/lib/auth-session";

export type ExampleActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof ExampleFormValues, string[]>>;
  prUrl?: string;
  prNumber?: number;
};

export async function saveExampleDraft(
  _previousState: ExampleActionState,
  formData: FormData
): Promise<ExampleActionState> {
  const session = await requireEditorAccess();
  const author = buildPrAuthor(session);

  const parsed = exampleFormSchema.safeParse({
    field: formData.get("field"),
    // ...
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields before continuing.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const values = parsed.data;
  const autoMerge = formData.get("autoMerge") === "on";

  try {
    const result = await createContentPullRequest({
      title: values.title,
      path: `example/${values.id}/index.md`,
      content: matter.stringify(values.content.trim(), { title: values.title }),
      commitMessage: `Update example: ${values.title}`,
      prTitle: `Example: ${values.title}`,
      branchName: `shr-admin/example-${values.id}`,
      author,
      labels: autoMerge ? ["auto-merge"] : undefined,
    });

    return {
      status: "success",
      message: `Saved draft #${result.prNumber}: ${result.prUrl}`,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Failed to save this draft.",
    };
  }
}
```

Key rules:
- `"use server"` is always the **first line** of the file.
- `requireEditorAccess()` is called **inside the action**, not at page level.
- Validation uses `schema.safeParse()` + `z.flattenError(parsed.error).fieldErrors`.
- `ActionState` always has `{ status, message?, fieldErrors?, prUrl?, prNumber? }`.
- Markdown is built with `matter.stringify(values.content.trim(), { ...frontmatterFields })`.
- Branch names follow the pattern `shr-admin/<type>-<id>`.
- PR body should include author name/email and content repo path for traceability.

## New Route Checklist

When adding a new content type `widgets`:

1. `src/lib/widget-schema.ts` — Zod schema + `WidgetFormValues` type
2. `src/lib/github.ts` — `listWidgetDrafts()` query function
3. `src/components/widget-editor-form.tsx` — `"use client"` form using `useActionState()`
4. `src/app/widgets/page.tsx` — listing page
5. `src/app/widgets/actions.ts` — `saveWidgetDraft()` server action
6. Add route to `EditorialShell` nav in `src/components/editorial-shell.tsx`

## Path Safety

- Always use `normalizeRepoPath()` when constructing GitHub file paths.
- Validate user-supplied path segments with `toSafeRepoPathSegment()` — rejects `..`, `.`, backslashes.
- `clubId` is alphanumeric only (no hyphens). All other IDs are kebab-case.

## UI Copy

Never expose GitHub internals in user-facing text. See [copilot-instructions.md](../copilot-instructions.md) for the full substitution table.
