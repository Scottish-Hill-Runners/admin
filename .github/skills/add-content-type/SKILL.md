---
name: add-content-type
description: "Add a new content type end-to-end in shr-admin. Use when creating a new editable content type — covers all 6 steps: Zod schema, GitHub query functions, editor form component, route page, server action, and nav registration. Invoke with the content type name as argument (e.g. /add-content-type widgets)."
argument-hint: "<content-type-name> (e.g. widgets, relays, venues)"
---

# Add a New Content Type

## When to Use

Invoke this skill when adding a brand-new category of editable content to the admin app — for example a new "venues" or "relays" type that needs a form, a GitHub-backed draft flow, and an editor route.

## Input

The argument is the **content type name** in singular kebab-case (e.g. `venue`, `relay`, `long-distance-route`). If no argument is given, ask the user for:
- Content type name (singular, kebab-case)
- Content repo path (e.g. `venues/{venueId}/index.md`)
- ID field name and format (kebab-case? alphanumeric? auto-generated?)
- Fields needed (title always required; list others)
- Whether it needs a detail/edit view (`[id]/page.tsx`) in addition to the list+create page

## Steps

Work through these steps in order. Complete each fully before moving to the next. Confirm with the user before writing code if any input is ambiguous.

See [checklist.md](./references/checklist.md) for the detailed per-file checklist and code templates.

### Step 1 — Zod Schema (`src/lib/<type>-schema.ts`)

- Export `${type}FormSchema` (camelCase) and `type ${Type}FormValues`
- Include an ID field with the correct regex for the ID format
- Use `z.union([z.literal(""), z.string().url(...)])` for optional URL fields
- Use `.trim()` / `.transform()` on text fields before `.min()` validation
- See [lib.instructions.md](../../instructions/lib.instructions.md) for full rules

### Step 2 — Content Types (`src/lib/content-types.ts`)

Add TypeScript-only type definitions (no Zod imports):
- `${Type}Frontmatter` — fields stored in markdown frontmatter
- `${Type}FormData` — matches the Zod inferred type
- `${Type}ListItem` — minimal shape for the index listing

### Step 3 — GitHub Query Functions (`src/lib/github.ts`)

Add at the end of the file:
- `list${Type}Drafts(): Promise<${Type}ListItem[]>`
- `get${Type}Draft(id: string): Promise<${Type}FormData | null>`

Always:
- Validate ID params with `toSafeRepoPathSegment()` — return `null` if invalid
- Wrap all paths with `normalizeRepoPath()`
- Use `requestGitHubGet<T>()` for all GitHub GETs — never `client.request()` directly
- See [lib.instructions.md](../../instructions/lib.instructions.md) for full rules

### Step 4 — Editor Form Component (`src/components/<type>-editor-form.tsx`)

- `"use client"` first line
- Wire with `useActionState(save${Type}Draft, { status: "idle" })`
- Two-column grid layout: `bg-white/85` inputs left, `bg-[#172119]` summary/status right
- Field errors: `text-red-700` in light panel, `text-red-200` in dark panel / markdown fields
- Submit button: `disabled={isPending}`, label `"Saving..."` / `"Save draft"`
- Status message: `{state.message ?? "Nothing submitted yet."}`
- Use `<MarkdownEditorField>` for long-form content — never a plain `<textarea>`
- See [components.instructions.md](../../instructions/components.instructions.md) for full rules

### Step 5 — Route Page and Server Action

**`src/app/<type>/page.tsx`**
- `async` server component
- First line: `await requireEditorAccess({ callbackUrl: "/<type>" })`
- Fetch drafts: `const items = await list${Type}Drafts()`
- Wrap everything in `<EditorialShell eyebrow="..." title="..." description="...">`

**`src/app/<type>/actions.ts`**
- `"use server"` first line
- Export `${Type}ActionState` type: `{ status; message?; fieldErrors?; prUrl?; prNumber? }`
- Export `save${Type}Draft(_prev: ${Type}ActionState, formData: FormData)`
- Inside: `await requireEditorAccess()`, `buildPrAuthor(session)`, `safeParse()`, `z.flattenError()`
- Call `createContentPullRequest({ ..., branchName: "shr-admin/<type>-${id}", author, labels })`
- See [app-routes.instructions.md](../../instructions/app-routes.instructions.md) for full rules

### Step 6 — Navigation (`src/components/editorial-shell.tsx`)

Add the new route to the nav links array in `EditorialShell`. Use plain language for the label — never expose content-type internals (see UI copy rules in [copilot-instructions.md](../../copilot-instructions.md)).

## Quality Checks

Before declaring done, verify:

- [ ] `npm run lint` passes with no new errors
- [ ] `npm run build` succeeds (catches type errors missed by the editor)
- [ ] No `process.env` references in new files — use `env` from `@/lib/env`
- [ ] No hard-coded repo/branch strings — use `contentConfig` from `@/lib/content-config`
- [ ] Branch name follows `shr-admin/<type>-<id>` pattern
- [ ] No GitHub concepts in user-facing strings (no "PR", "branch", "frontmatter", "YAML", "slug")
- [ ] `toSafeRepoPathSegment()` called on all user-supplied path segments
- [ ] `normalizeRepoPath()` called on all final repo paths
