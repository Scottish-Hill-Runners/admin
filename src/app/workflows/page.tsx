import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function WorkflowsPage() {
  await requireEditorAccess({ callbackUrl: "/workflows" });

  return (
    <EditorialShell
      eyebrow="Workflows"
      title="Start a guided task"
      description="Choose the role that matches your goal. Each path walks you through completing one task, from setup to status tracking."
    >
      <section className="grid gap-5 lg:grid-cols-2">
        <Link
          href="/workflows/runner"
          className="block rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Runner</p>
          <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Correct a result</h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Confirm race and year, apply the correction, and track progress.
          </p>
        </Link>

        <Link
          href="/workflows/race-organiser"
          className="block rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Race organiser</p>
          <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Update race details or GPX</h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Choose the update type and go straight to the correct editor.
          </p>
        </Link>

        <Link
          href="/workflows/photographer"
          className="block rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Photographer</p>
          <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Upload race photos</h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Pick the destination and then upload images using the relevant asset editor.
          </p>
        </Link>

        <Link
          href="/workflows/time-keeper"
          className="block rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Time keeper</p>
          <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Upload results</h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Select race and year, upload CSV, run checks, then save your draft.
          </p>
        </Link>

        <Link
          href="/workflows/historian"
          className="block rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Historian</p>
          <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Record a long-distance epic</h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Decide whether to create a new report or update an existing entry.
          </p>
        </Link>

        <Link
          href="/workflows/announcer"
          className="block rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Announcer</p>
          <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Post a news item</h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Start a new update or edit an existing article.
          </p>
        </Link>

        <Link
          href="/workflows/club-official"
          className="block rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Club official</p>
          <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Create or update a club entry</h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Add a new club or update details for an existing one, then track progress.
          </p>
        </Link>
      </section>

      <section
        id="advanced-tools"
        className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]"
      >
        <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">Advanced tools</h2>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Experienced editors can jump directly to specialist pages.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/results" className="rounded-full border border-stone-900/10 bg-stone-50 px-4 py-2 font-medium text-stone-900 transition hover:bg-white">Results</Link>
          <Link href="/races" className="rounded-full border border-stone-900/10 bg-stone-50 px-4 py-2 font-medium text-stone-900 transition hover:bg-white">Races</Link>
          <Link href="/race-assets" className="rounded-full border border-stone-900/10 bg-stone-50 px-4 py-2 font-medium text-stone-900 transition hover:bg-white">Route files</Link>
          <Link href="/collections" className="rounded-full border border-stone-900/10 bg-stone-50 px-4 py-2 font-medium text-stone-900 transition hover:bg-white">Collections</Link>
          <Link href="/long-distance" className="rounded-full border border-stone-900/10 bg-stone-50 px-4 py-2 font-medium text-stone-900 transition hover:bg-white">Long distance</Link>
          <Link href="/news" className="rounded-full border border-stone-900/10 bg-stone-50 px-4 py-2 font-medium text-stone-900 transition hover:bg-white">News</Link>
        </div>
      </section>
    </EditorialShell>
  );
}