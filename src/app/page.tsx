import Link from "next/link";
import type { EditorialFlow } from "@/lib/content-types";
import { EditorialShell } from "@/components/editorial-shell";

export default function Home() {
  const flows: EditorialFlow[] = [
    {
      slug: "news",
      title: "News",
      description:
        "Create and revise news posts with guided fields for title, date, excerpt, and preview.",
      status: "MVP",
      path: "/news",
    },
    {
      slug: "races",
      title: "Race Information",
      description:
        "Edit race metadata, route assets, and descriptive copy without touching markdown directly.",
      status: "MVP",
      path: "/races",
    },
    {
      slug: "results-upload",
      title: "Race Results Upload",
      description:
        "Import CSV files, map columns, and catch validation problems before opening a PR.",
      status: "MVP",
      path: "/races",
    },
  ];

  const principles = [
    "Hide GitHub mechanics behind clear editorial tasks.",
    "Validate before save so editors see plain-language issues early.",
    "Create reviewable pull requests instead of direct production edits.",
  ];

  return (
    <EditorialShell
      eyebrow="Scottish Hill Runners"
      title="Editorial control for race results, race pages, and club news."
      description="This admin app is the safe editing surface for non-technical editors. It will validate content, prepare clean pull requests, and keep GitHub out of the day-to-day workflow."
    >
      <div className="grid gap-8">
        <section className="overflow-hidden rounded-[2rem] border border-stone-900/10 bg-stone-50/85 shadow-[0_24px_80px_rgba(52,42,28,0.14)] backdrop-blur">
          <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.3fr_0.7fr] lg:px-10 lg:py-10">
            <div className="space-y-5">
              <p className="text-sm font-medium uppercase tracking-[0.28em] text-amber-900/70">
                MVP scope
              </p>
              <p className="max-w-2xl text-lg leading-8 text-stone-700">
                The first implementation slice establishes auth-ready editorial routes,
                content-repo configuration, and clear task separation for news, race
                information, and results uploads.
              </p>
            </div>

            <aside className="rounded-[1.5rem] border border-stone-900/10 bg-stone-900 px-5 py-5 text-stone-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
              <p className="text-sm uppercase tracking-[0.24em] text-amber-200/80">
                Initial workflow
              </p>
              <ol className="mt-4 space-y-3 text-sm leading-6 text-stone-200">
                <li>1. Sign in with a magic link.</li>
                <li>2. Choose an editorial task instead of editing files.</li>
                <li>3. Save changes as a reviewable pull request.</li>
              </ol>
            </aside>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          {flows.map((flow) => (
            <article
              key={flow.slug}
              className="rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
                  {flow.title}
                </h2>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
                  {flow.status}
                </span>
              </div>
              <p className="mt-4 text-base leading-7 text-stone-700">
                {flow.description}
              </p>
              <Link
                href={flow.path}
                className="mt-5 inline-flex rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 transition hover:bg-stone-700"
              >
                Open flow
              </Link>
            </article>
          ))}
        </section>

        <section className="grid gap-6 rounded-[2rem] border border-stone-900/10 bg-[#1d2b24] px-6 py-7 text-stone-50 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-lime-200/80">
              Product direction
            </p>
            <h2 className="mt-3 font-[family:var(--font-heading)] text-3xl leading-tight">
              A thin editorial layer over the GitHub content repository.
            </h2>
          </div>
          <ul className="space-y-3 text-base leading-7 text-stone-200">
            {principles.map((principle) => (
              <li key={principle}>{principle}</li>
            ))}
          </ul>
        </section>
      </div>
    </EditorialShell>
  );
}
