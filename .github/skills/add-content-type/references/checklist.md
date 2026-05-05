# New Content Type — Per-File Checklist

Use this as a quick reference when working through the 6 steps in SKILL.md.

---

## 1. `src/lib/<type>-schema.ts`

```typescript
import { z } from "zod";

export const widgetFormSchema = z.object({
  widgetId: z
    .string()
    .min(1, "ID is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only"),
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  // Optional URL:
  web: z.union([z.literal(""), z.string().url("Enter a valid URL")]).optional(),
  content: z.string().trim().min(1, "Body is required"),
});

export type WidgetFormValues = z.infer<typeof widgetFormSchema>;
```

Checklist:

- [ ] Schema named `${type}FormSchema`
- [ ] Type named `${Type}FormValues`
- [ ] ID field has appropriate regex (see lib.instructions.md for options)
- [ ] Optional URL uses `z.union([z.literal(""), z.string().url(...)])`
- [ ] Text fields use `.trim()` before `.min()`

---

## 2. `src/lib/content-types.ts` — additions only

```typescript
export type WidgetFrontmatter = {
  title: string;
};

export type WidgetFormData = {
  widgetId: string;
  title: string;
  web?: string;
  content: string;
};

export type WidgetListItem = {
  widgetId: string;
  title: string;
};
```

Checklist:

- [ ] No Zod imports — TypeScript types only
- [ ] `${Type}Frontmatter`, `${Type}FormData`, `${Type}ListItem` all present

---

## 3. `src/lib/github.ts` — additions only

```typescript
export async function listWidgetDrafts(): Promise<WidgetListItem[]> {
  const client = getGitHubClient();
  if (!client) return [];
  const files = await getRepositoryFiles("widgets", "md");
  return files.flatMap((f) => {
    // parse + return list item
    return [];
  });
}

export async function getWidgetDraft(widgetId: string): Promise<WidgetFormData | null> {
  const safeId = toSafeRepoPathSegment(widgetId);
  if (!safeId) return null;
  const raw = await getContentFile(normalizeRepoPath(`widgets/${safeId}/index.md`));
  if (!raw) return null;
  const { data, content } = matter(raw);
  return {
    widgetId: safeId,
    title: String(data.title ?? ""),
    web: String(data.web ?? ""),
    content: content.trim(),
  };
}
```

Checklist:

- [ ] `toSafeRepoPathSegment()` on all user-supplied IDs — return `null` on failure
- [ ] `normalizeRepoPath()` on all constructed paths
- [ ] List function returns `[]` (not throws) when GitHub client is unavailable
- [ ] Single-item fetch returns `null` on missing file (use `nullOn404: true` overload if needed)

---

## 4. `src/components/widget-editor-form.tsx`

```typescript
"use client";

import { useActionState } from "react";
import { saveWidgetDraft, type WidgetActionState } from "@/app/widgets/actions";
import { MarkdownEditorField } from "@/components/markdown-editor-field";
import type { WidgetFormData } from "@/lib/content-types";

const initialState: WidgetActionState = { status: "idle" };

export function WidgetEditorForm({ initialValues }: { initialValues?: WidgetFormData | null }) {
  const [state, formAction, isPending] = useActionState(saveWidgetDraft, initialState);
  const buttonLabel = isPending ? "Saving..." : "Save draft";

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      {/* LEFT: inputs */}
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold" htmlFor="widget-title">Title</label>
            <input
              id="widget-title"
              name="title"
              type="text"
              defaultValue={initialValues?.title}
              className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            {state.fieldErrors?.title?.map((e) => (
              <p key={e} className="text-sm text-red-700">{e}</p>
            ))}
          </div>
          <MarkdownEditorField
            id="widget-content"
            name="content"
            label="Body"
            placeholder="Write the body here"
            defaultValue={initialValues?.content}
            errors={state.fieldErrors?.content}
          />
        </div>
      </section>

      {/* RIGHT: summary + submit */}
      <section className="rounded-[1.5rem] bg-[#172119] p-6 text-stone-100">
        <div className="space-y-4">
          {/* file path preview */}
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">File</p>
            <p className="mt-1 text-sm text-stone-300">widgets/…/index.md</p>
          </div>
          {/* skip review */}
          <label className="flex items-center gap-3 text-sm text-stone-300">
            <input type="checkbox" name="autoMerge" className="size-4 rounded" />
            Minor correction — skip review
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-lime-300 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-stone-500"
          >
            {buttonLabel}
          </button>
          {/* status */}
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">Check status</p>
            <p className="mt-2 text-sm leading-6 text-stone-200">
              {state.message ?? "Nothing submitted yet."}
            </p>
          </div>
        </div>
      </section>
    </form>
  );
}
```

Checklist:

- [ ] `"use client"` first line
- [ ] `useActionState` — all three values destructured
- [ ] `initialState` defined outside component
- [ ] Light panel errors: `text-red-700`
- [ ] Dark panel / markdown errors: `text-red-200` (handled by `MarkdownEditorField`)
- [ ] Button: `disabled={isPending}`, correct Tailwind classes
- [ ] Status: fallback `"Nothing submitted yet."`
- [ ] Skip review checkbox: `name="autoMerge"`

---

## 5a. `src/app/widgets/page.tsx`

```typescript
import { EditorialShell } from "@/components/editorial-shell";
import { WidgetEditorForm } from "@/components/widget-editor-form";
import { listWidgetDrafts } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function WidgetsPage() {
  await requireEditorAccess({ callbackUrl: "/widgets" });
  const items = await listWidgetDrafts();

  return (
    <EditorialShell
      eyebrow="Widgets"
      title="Widget catalogue"
      description="Select a widget to edit, or add a new one."
    >
      {/* list items + new item form */}
      <WidgetEditorForm />
    </EditorialShell>
  );
}
```

Checklist:
- [ ] `async` function
- [ ] `requireEditorAccess()` is the **first** `await`
- [ ] Wraps everything in `<EditorialShell>`
- [ ] `eyebrow`, `title`, `description` use plain language (no GitHub concepts)

---

## 5b. `src/app/widgets/actions.ts`

```typescript
"use server";

import { z } from "zod";
import matter from "gray-matter";
import { widgetFormSchema, type WidgetFormValues } from "@/lib/widget-schema";
import { contentConfig } from "@/lib/content-config";
import { createContentPullRequest } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";
import { buildPrAuthor } from "@/lib/auth-session";
import { toSafeRepoPathSegment, normalizeRepoPath } from "@/lib/github";

export type WidgetActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof WidgetFormValues, string[]>>;
  prUrl?: string;
  prNumber?: number;
};

export async function saveWidgetDraft(
  _previousState: WidgetActionState,
  formData: FormData
): Promise<WidgetActionState> {
  const session = await requireEditorAccess();
  const author = buildPrAuthor(session);

  const parsed = widgetFormSchema.safeParse({
    widgetId: formData.get("widgetId"),
    title: formData.get("title"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields before continuing.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const values = parsed.data;
  const safeId = toSafeRepoPathSegment(values.widgetId);
  if (!safeId) {
    return { status: "error", message: "Invalid widget ID." };
  }

  const autoMerge = formData.get("autoMerge") === "on";

  try {
    const result = await createContentPullRequest({
      title: values.title,
      path: normalizeRepoPath(`widgets/${safeId}/index.md`),
      content: matter.stringify(values.content.trim(), { title: values.title }),
      commitMessage: `Update widget: ${values.title}`,
      prTitle: `Widget: ${values.title}`,
      prBody: `Draft created via shr-admin.\n\nContent repo: ${contentConfig.repo}`,
      branchName: `shr-admin/widget-${safeId}`,
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

Checklist:
- [ ] `"use server"` first line
- [ ] `requireEditorAccess()` called inside action (not at page level)
- [ ] `safeParse()` + `z.flattenError(parsed.error).fieldErrors`
- [ ] `toSafeRepoPathSegment()` on ID after Zod parse
- [ ] `normalizeRepoPath()` on final file path
- [ ] Branch: `shr-admin/<type>-<id>`
- [ ] `contentConfig.repo` in PR body (not a hard-coded string)
- [ ] Error catch returns `{ status: "error", message: ... }`

---

## 6. `src/components/editorial-shell.tsx` — nav addition

Find the nav links array and add:
```typescript
{ href: "/widgets", label: "Widgets" },
```

Checklist:
- [ ] Label is plain English — not the content-type technical name
- [ ] Appears in a logical position relative to other nav items
