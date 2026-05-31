import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";

export default function Home() {
  return (
    <EditorialShell
      eyebrow="Scottish Hill Runners"
      title="Choose your task"
      description="Pick the role that matches what you need to do. Each route walks you through a task from start to submission tracking."
    >
      <div className="grid gap-8">
        <section className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-5">Runner</h3>
            <div className="space-y-3">
              <Link
                href="/workflows/runner"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Guided task
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Correct a race result
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Confirm race and year, submit the correction, and track approval progress.
                </p>
              </Link>
            </div>
          </div>

          <div>
            <h3 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-5">Race organiser</h3>
            <div className="space-y-3">
              <Link
                href="/workflows/race-organiser"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Guided task
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Update race details or GPX
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Choose to edit race information or upload route files.
                </p>
              </Link>
            </div>
          </div>

          <div>
            <h3 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-5">Photographer</h3>
            <div className="space-y-3">
              <Link
                href="/workflows/photographer"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Guided task
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Upload race photos
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Pick where your photos should appear, then upload and submit for review.
                </p>
              </Link>
            </div>
          </div>

          <div>
            <h3 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-5">Time keeper</h3>
            <div className="space-y-3">
              <Link
                href="/workflows/time-keeper"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Guided task
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Upload race results
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Select the race and year, run validation, then save a draft update.
                </p>
              </Link>
            </div>
          </div>

          <div>
            <h3 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-5">Historian</h3>
            <div className="space-y-3">
              <Link
                href="/workflows/historian"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Guided task
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Record a long-distance epic
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Report a new epic route or update an existing one.
                </p>
              </Link>
            </div>
          </div>

          <div>
            <h3 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-5">Announcer</h3>
            <div className="space-y-3">
              <Link
                href="/workflows/announcer"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Guided task
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Post a news update
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Start a new news item or update an existing one, then track review status.
                </p>
              </Link>
            </div>
          </div>

          <div>
            <h3 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-5">Club Official</h3>
            <div className="space-y-3">
              <Link
                href="/workflows/club-official"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Guided task
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Enter club details
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Add a new club or update details for an existing one, then track progress.
                </p>
              </Link>
            </div>
          </div>

          <div>
            <h3 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-5">Track progress</h3>
            <div className="space-y-3">
              <Link
                href="/submissions"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Status
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  My requests
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  See whether each request is waiting for review, approved, or closed.
                </p>
              </Link>
            </div>
          </div>

          <div>
            <h3 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-5">Publishing</h3>
            <div className="space-y-3">
              <Link
                href="/publish"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Publisher tools
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Publish draft updates
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Prepare draft updates to go live after approval.
                </p>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </EditorialShell>
  );
}
