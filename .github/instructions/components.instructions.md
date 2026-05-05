---
description: "Use when creating or editing editor form components in src/components — enforces useActionState, field error display, submit button, markdown editor, and two-column layout conventions."
applyTo: "src/components/**"
---

# Editor Form Component Conventions

## Directive and Action Wiring

Every editor form component must be a client component wired to a server action via `useActionState`:

```typescript
"use client";

import { useActionState } from "react";
import { saveExampleDraft, type ExampleActionState } from "@/app/example/actions";

const initialState: ExampleActionState = { status: "idle" };

export function ExampleEditorForm({ initialValues }: { initialValues?: ExampleFormData | null }) {
  const [state, formAction, isPending] = useActionState(saveExampleDraft, initialState);
  // ...
}
```

- `"use client"` is always the **first line**.
- Always destructure all three values: `[state, formAction, isPending]`.
- `initialState` is defined outside the component with `status: "idle"`.

## Form Layout

All editor forms use a two-column grid — a light input panel on the left and a dark summary/status panel on the right:

```jsx
<form action={formAction} className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
  {/* LEFT: input fields */}
  <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
    {/* fields */}
  </section>

  {/* RIGHT: summary + status */}
  <section className="rounded-[1.5rem] bg-[#172119] p-6 text-stone-100">
    {/* file path preview, submit button, status message */}
  </section>
</form>
```

## Field Error Display

Errors beneath standard inputs (light panel — `text-red-700`):

```jsx
<input name="title" defaultValue={initialValues?.title} />
{state.fieldErrors?.title?.map((error) => (
  <p key={error} className="text-sm text-red-700">{error}</p>
))}
```

Errors beneath the markdown editor (dark panel — `text-red-200`):

```jsx
<MarkdownEditorField
  id="content"
  name="content"
  label="Body"
  defaultValue={initialValues?.content}
  errors={state.fieldErrors?.content}
/>
```

(`MarkdownEditorField` renders its own errors in `text-red-200` internally.)

## Submit Button

```jsx
const buttonLabel = isPending ? "Saving..." : "Save draft";

<button
  type="submit"
  disabled={isPending}
  className="rounded-full bg-lime-300 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-stone-500"
>
  {buttonLabel}
</button>
```

- Use `"Saving..."` while pending, `"Save draft"` otherwise.
- CSV/upload forms may also gate on `blockingErrorsExist`: `disabled={isPending || blockingErrorsExist}`.

## Status Message

Always in the dark right panel, below the file-path summary:

```jsx
<div>
  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
    Check status
  </p>
  <p className="mt-2 text-sm leading-6 text-stone-200">
    {state.message ?? "Nothing submitted yet."}
  </p>
</div>
```

## Markdown Editor

Use `MarkdownEditorField` for any long-form content field — never a plain `<textarea>`:

```jsx
import { MarkdownEditorField } from "@/components/markdown-editor-field";

<MarkdownEditorField
  id={`${formId}-content`}
  name="content"
  label="Body"
  placeholder="Write the body here"
  defaultValue={initialValues?.content}
  errors={state.fieldErrors?.content}
/>
```

## Initial Values via Props

- Pass optional `initialValues` as a prop typed to the content's form data type.
- Use `defaultValue` (not `value`) on all inputs — these are uncontrolled.
- For fields that drive live UI state (e.g. a path preview), mirror to a `useState` via `onInput` on the `<form>`.

```typescript
type ExampleEditorFormProps = {
  initialValues?: ExampleFormData | null;
};
```

## Skip Review Checkbox

When editors can flag a change as minor (triggering auto-merge), add this inside the dark panel:

```jsx
<label className="flex items-center gap-3 text-sm text-stone-300">
  <input type="checkbox" name="autoMerge" className="size-4 rounded" />
  Minor correction — skip review
</label>
```

## Label Style

Section and field labels in the dark panel use this consistent style:

```jsx
<p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
  Label text
</p>
```
