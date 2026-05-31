import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { WorkflowStepper } from "@/app/workflows/_components/workflow-stepper";
import { requireEditorAccess } from "@/lib/route-protection";

type PhotographerWorkflowPageProps = {
  searchParams: Promise<{ step?: string; target?: string; raceId?: string }>;
};

function toStep(value: string | undefined): number {
  const parsed = Number.parseInt(String(value ?? "1"), 10);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  if (parsed < 1) return 1;
  if (parsed > 4) return 4;
  return parsed;
}

export default async function PhotographerWorkflowPage({ searchParams }: PhotographerWorkflowPageProps) {
  await requireEditorAccess({ callbackUrl: "/workflows/photographer" });
  const params = await searchParams;
  const currentStep = toStep(params.step);
  const target = params.target === "collection" ? "collection" : "race";
  const raceId = String(params.raceId ?? "").trim();
  const returnToWorkflow = `/workflows/photographer?step=4&target=${target}`;
  const encodedReturnToWorkflow = encodeURIComponent(returnToWorkflow);
  const collectionDestinations = [
    {
      href: `/collections/homepage?returnToWorkflow=${encodedReturnToWorkflow}`,
      label: "Homepage images",
    },
    {
      href: `/collections/documents?returnToWorkflow=${encodedReturnToWorkflow}`,
      label: "Document list",
    },
    {
      href: `/collections/committee?returnToWorkflow=${encodedReturnToWorkflow}`,
      label: "Committee portraits",
    },
  ];

  return (
    <EditorialShell
      eyebrow="Photographer workflow"
      title="Upload race photos"
      description="Pick where your images should appear, then submit and track progress."
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link href="/workflows" className="hover:text-stone-900 hover:underline underline-offset-4">
          Start a task
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">Photographer</span>
      </nav>

      <WorkflowStepper
        currentStep={currentStep}
        steps={[
          "Choose destination",
          "Open image upload",
          "Save your draft",
          "Track request status",
        ]}
      />

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        {currentStep === 1 ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Step 1 of 4</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Where should these photos go?</h2>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <article className="rounded-2xl border border-stone-900/10 bg-stone-50/90 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">A specific race</p>
                <p className="mt-3 text-sm leading-6 text-stone-700">Use race assets when photos belong to one race entry.</p>
                <Link href="/workflows/photographer?step=2&target=race" className="mt-5 inline-block rounded-full bg-amber-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-800">Continue</Link>
              </article>
              <article className="rounded-2xl border border-stone-900/10 bg-stone-50/90 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">Homepage or shared collection</p>
                <p className="mt-3 text-sm leading-6 text-stone-700">Use collections for shared image sets and site-wide content.</p>
                <Link href="/workflows/photographer?step=2&target=collection" className="mt-5 inline-block rounded-full bg-amber-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-800">Continue</Link>
              </article>
            </div>
          </>
        ) : null}

        {currentStep === 2 ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Step 2 of 4</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Open image upload</h2>
            {target === "race" ? (
              <>
                <p className="mt-3 text-sm leading-6 text-stone-700">
                  Enter the race ID to open that race image editor.
                </p>
                <form action="/workflows/photographer/start" method="get" className="mt-4 grid gap-4 lg:max-w-xl">
                  <input type="hidden" name="target" value="race" />
                  <input type="hidden" name="returnToWorkflow" value={returnToWorkflow} />
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
                      Race ID
                    </span>
                    <input
                      name="raceId"
                      required
                      defaultValue={raceId}
                      placeholder="e.g. Allermuir"
                      className="w-full rounded-2xl border border-stone-900/10 bg-white px-4 py-3 text-base text-stone-900 outline-none transition focus:border-stone-900/40"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-full bg-amber-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-800"
                  >
                    Open race image editor
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm leading-6 text-stone-700">
                  Choose the destination you need to update.
                </p>
                <div className="mt-5 flex flex-wrap gap-3 text-sm">
                  {collectionDestinations.map((destination) => (
                    <Link
                      key={destination.href}
                      href={destination.href}
                      className="rounded-full bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-800"
                    >
                      {destination.label}
                    </Link>
                  ))}
                  <Link href="/workflows/photographer?step=1" className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100">Back</Link>
                  <Link href={`/workflows/photographer?step=3&target=collection&raceId=${encodeURIComponent(raceId)}`} className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100">Continue</Link>
                </div>
              </>
            )}
          </>
        ) : null}

        {currentStep === 3 ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Step 3 of 4</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Save your draft request</h2>
            <p className="mt-3 text-sm leading-6 text-stone-700">Upload your files, complete required fields, and save your draft request.</p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              {target === "race" ? (
                <Link
                  href={raceId ? `/workflows/photographer/start?target=race&raceId=${encodeURIComponent(raceId)}&returnToWorkflow=${encodedReturnToWorkflow}` : "/workflows/photographer?step=2&target=race"}
                  className="rounded-full bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-800"
                >
                  {raceId ? "Open race image editor" : "Set race ID first"}
                </Link>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {collectionDestinations.map((destination) => (
                    <Link
                      key={destination.href}
                      href={destination.href}
                      className="rounded-full bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-800"
                    >
                      {destination.label}
                    </Link>
                  ))}
                </div>
              )}
              <Link href={`/workflows/photographer?step=4&target=${target}`} className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100">Continue to status tracking</Link>
            </div>
          </>
        ) : null}

        {currentStep === 4 ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Step 4 of 4</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Track progress</h2>
            <p className="mt-3 text-sm leading-6 text-stone-700">Open My requests to check progress and final outcome.</p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <Link href="/submissions" className="rounded-full bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-800">Open My requests</Link>
              <Link href="/workflows/photographer?step=1" className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100">Start again</Link>
            </div>
          </>
        ) : null}
      </section>
    </EditorialShell>
  );
}