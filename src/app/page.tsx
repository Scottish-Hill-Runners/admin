import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";

export default function Home() {
  return (
    <EditorialShell
      eyebrow="Scottish Hill Runners"
      title="Editorial control for race results, descriptions, and news"
      description="This admin app is the safe editing surface for non-technical editors. It will validate content, prepare clean pull requests, and keep GitHub out of the day-to-day workflow."
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
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-700">
                  Add new
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Create a news post
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Write a new news article with title, date, excerpt, and markdown content.
                </p>
              </Link>
              <Link
                href="/news/edit"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Edit existing
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Edit a news post
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Load an existing news post and update its content or metadata.
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
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-700">
                  Add new
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Upload race results
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Import a CSV file with race results, validate, and create a pull request.
                </p>
              </Link>
              <Link
                href="/results/edit"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Edit existing
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Edit race results
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Load an existing results CSV and update event timings or participant data.
                </p>
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-5">Collections</h3>
            <div className="space-y-3">
              <Link
                href="/collections"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Manage images
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Upload pictures and edit collections
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Upload image assets to Pictures/ and update collections.yaml in a validated PR.
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
                  Manage race dates in yyyy-mm-dd,RaceID format and create a pull request draft.
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
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-700">
                  Add new
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Create new race
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Start a new race page with metadata, route description, and event details.
                </p>
              </Link>
              <Link
                href="/races/edit"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Edit existing
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Edit race details
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Load an existing race page and update its metadata or route description.
                </p>
              </Link>
            </div>
          </div>

          <div>
            <h3 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-5">Championships</h3>
            <div className="space-y-3">
              <Link
                href="/championships/edit"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Edit existing
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Edit championship
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Load an existing championship and update its schedule or description.
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
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-700">
                  Add new
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Create new club
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Add a new club entry with its name, aliases, website, and a description.
                </p>
              </Link>
              <Link
                href="/clubs/edit"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Edit existing
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Edit club details
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Load an existing club page and update its details or description.
                </p>
              </Link>
            </div>
          </div>

          <div>
            <h3 className="font-[family:var(--font-heading)] text-2xl text-stone-900 mb-5">Long Distance</h3>
            <div className="space-y-3">
              <Link
                href="/long-distance/edit"
                className="block rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)] transition hover:border-stone-900/25 hover:bg-white"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Edit existing
                </p>
                <h4 className="mt-2 font-[family:var(--font-heading)] text-xl text-stone-900">
                  Edit long-distance report
                </h4>
                <p className="mt-3 text-base leading-6 text-stone-600">
                  Load an existing long-distance report and update its content.
                </p>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </EditorialShell>
  );
}
