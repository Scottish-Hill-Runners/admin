import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";

export default function Home() {
  return (
    <EditorialShell
      eyebrow="Scottish Hill Runners"
      title="Editorial control for race results, descriptions, and news"
      description="This admin app is the safe editing surface for non-technical community editors. It checks content, prepares clean drafts for review, and keeps technical details out of the day-to-day workflow."
    >
      <div className="grid gap-8">
        <section className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-5">News</h3>
            <div className="space-y-3">
              <Link
                href="/news"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Browse &amp; manage
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  News posts
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Browse recent posts, edit existing articles, or create a new news post.
                </p>
              </Link>
            </div>
          </div>

          <div>
            <h3 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-5">Results</h3>
            <div className="space-y-3">
              <Link
                href="/results"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Browse &amp; manage
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Race results
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Select a race to upload new results or edit an existing results CSV.
                </p>
              </Link>
            </div>
          </div>

          <div>
            <h3 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-5">Assets</h3>
            <div className="space-y-3">
              <Link
                href="/collections"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Manage assets
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Images and documents
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Open specialist editors for homepage images, committee portraits, and document lists.
                </p>
              </Link>
            </div>
          </div>

          <div>
            <h3 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-5">Calendar</h3>
            <div className="space-y-3">
              <Link
                href="/calendar"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Edit schedule
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Edit calendar.csv
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Manage race dates in yyyy-mm-dd,RaceID format and save a draft for review.
                </p>
              </Link>
            </div>
          </div>

          <div>
            <h3 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-5">Races</h3>
            <div className="space-y-3">
              <Link
                href="/races"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Browse &amp; manage
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Race catalogue
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Browse all races, edit metadata and route descriptions, or create a new entry.
                </p>
              </Link>
            </div>
          </div>

          <div>
            <h3 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-5">Clubs</h3>
            <div className="space-y-3">
              <Link
                href="/clubs"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Browse &amp; manage
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Clubs
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Browse all clubs, edit details and descriptions, or add a new entry.
                </p>
              </Link>
            </div>
          </div>

          <div>
            <h3 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-5">Long Distance</h3>
            <div className="space-y-3">
              <Link
                href="/long-distance"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Browse &amp; manage
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Long-distance reports
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Browse reports, edit existing content, or create a new long-distance entry.
                </p>
              </Link>
            </div>
          </div>
          
          <div>
            <h3 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-5">Publish</h3>
            <div className="space-y-3">
              <Link
                href="/publish"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Deploy changes
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Publish draft updates
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Submit one publication request so officials can approve and deploy all accumulated updates in one step.
                </p>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </EditorialShell>
  );
}
