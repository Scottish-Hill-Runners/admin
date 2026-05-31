import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { WorkflowStepper } from "@/app/workflows/_components/workflow-stepper";
import { requireEditorAccess } from "@/lib/route-protection";

type TimeKeeperWorkflowPageProps = {
  searchParams: Promise<{ step?: string; target?: string; resultsSubmission?: string }>;
};

function toStep(value: string | undefined): number {
  const parsed = Number.parseInt(String(value ?? "1"), 10);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  if (parsed < 1) return 1;
  if (parsed > 5) return 5;
  return parsed;
}

function toPositiveInt(value: string | undefined): number | undefined {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

export default async function TimeKeeperWorkflowPage({ searchParams }: TimeKeeperWorkflowPageProps) {
  await requireEditorAccess({ callbackUrl: "/workflows/time-keeper" });
  const params = await searchParams;
  const currentStep = toStep(params.step);
  const target = params.target === "recent" ? "recent" : "historic";
  const resultsSubmission = toPositiveInt(params.resultsSubmission);
  const returnToDraftNewsStep = `/workflows/time-keeper?step=4&target=${target}`;
  const resultsMode = target === "recent" ? "recent" : "historic";
  const openResultsHref = `/results?mode=${resultsMode}&returnToWorkflow=${encodeURIComponent(returnToDraftNewsStep)}`;
  const openNewsHref = resultsSubmission
    ? `/news?fromResultsSubmission=${resultsSubmission}&returnToWorkflow=${encodeURIComponent(`/workflows/time-keeper?step=5&target=${target}`)}`
    : undefined;

  return (
    <EditorialShell
      eyebrow="Time keeper workflow"
      title="Upload race results"
      description="Follow these steps to submit a results update with checks before it is reviewed."
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link href="/workflows" className="hover:text-stone-900 hover:underline underline-offset-4">
          Start a task
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">Time keeper</span>
      </nav>

      <WorkflowStepper
        currentStep={currentStep}
        steps={[
          "Choose results type",
          "Upload results CSV",
          "Save your draft",
          "Draft news item",
          "Track request status",
        ]}
      />

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        {currentStep === 1 ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Step 1 of 5</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Choose results type</h2>
            <p className="mt-3 text-sm leading-6 text-stone-700">Choose whether you are uploading a recent race from this year or an older historic result.</p>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <article className="rounded-2xl border border-stone-900/10 bg-stone-50/90 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">Recent results?</p>
                <p className="mt-3 text-sm leading-6 text-stone-700">Go straight to this year&apos;s missing results list.</p>
                <Link href="/workflows/time-keeper?step=2&target=recent" className="mt-5 inline-block rounded-full bg-amber-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-800">Continue</Link>
              </article>
              <article className="rounded-2xl border border-stone-900/10 bg-stone-50/90 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">Historic results?</p>
                <p className="mt-3 text-sm leading-6 text-stone-700">Browse races first, then choose the year you want to upload.</p>
                <Link href="/workflows/time-keeper?step=2&target=historic" className="mt-5 inline-block rounded-full bg-amber-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-800">Continue</Link>
              </article>
            </div>
          </>
        ) : null}

        {currentStep === 2 ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Step 2 of 5</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Upload results CSV</h2>
            <p className="mt-3 text-sm leading-6 text-stone-700">
              {target === "recent"
                ? "Open this year&apos;s missing results and choose the race to upload."
                : "Open all races, then choose race ID and year for the result you are uploading."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <Link href={openResultsHref} className="rounded-full bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-800">Open upload flow</Link>
              <Link href={`/workflows/time-keeper?step=1&target=${target}`} className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100">Back</Link>
              <Link href={`/workflows/time-keeper?step=3&target=${target}`} className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100">Continue</Link>
            </div>
          </>
        ) : null}

        {currentStep === 3 ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Step 3 of 5</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Save your draft request</h2>
            <p className="mt-3 text-sm leading-6 text-stone-700">Save the draft request. After saving, this workflow will carry your request number into the next step automatically.</p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <Link href={openResultsHref} className="rounded-full bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-800">Open results</Link>
              <Link href={`/workflows/time-keeper?step=4&target=${target}`} className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100">Continue to draft news</Link>
            </div>
          </>
        ) : null}

        {currentStep === 4 ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Step 4 of 5</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Draft a news item</h2>
            <p className="mt-3 text-sm leading-6 text-stone-700">Generate a news draft from your saved results request so race winners and summary text are prepared for review.</p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              {openNewsHref ? (
                <Link href={openNewsHref} className="rounded-full bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-800">Generate news draft</Link>
              ) : (
                <Link href={openResultsHref} className="rounded-full bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-800">Save results first</Link>
              )}
              {resultsSubmission ? (
                <p className="self-center text-sm text-stone-600">Using request #{resultsSubmission}.</p>
              ) : (
                <p className="self-center text-sm text-stone-600">No results request found yet. Save results in step 3 first.</p>
              )}
              <Link href={`/workflows/time-keeper?step=5&target=${target}`} className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100">Continue to status tracking</Link>
            </div>
          </>
        ) : null}

        {currentStep === 5 ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Step 5 of 5</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Track progress</h2>
            <p className="mt-3 text-sm leading-6 text-stone-700">Open My requests to check whether your upload is waiting for review, approved, or closed.</p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <Link href="/submissions" className="rounded-full bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-800">Open My requests</Link>
              <Link href="/workflows/time-keeper?step=1" className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100">Start again</Link>
            </div>
          </>
        ) : null}
      </section>
    </EditorialShell>
  );
}