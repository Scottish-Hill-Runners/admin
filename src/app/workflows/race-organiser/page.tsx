import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { WorkflowStepper } from "@/app/workflows/_components/workflow-stepper";
import { requireEditorAccess } from "@/lib/route-protection";

type RaceOrganiserWorkflowPageProps = {
  searchParams: Promise<{ step?: string; task?: string }>;
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

export default async function RaceOrganiserWorkflowPage({ searchParams }: RaceOrganiserWorkflowPageProps) {
  await requireEditorAccess({ callbackUrl: "/workflows/race-organiser" });
  const params = await searchParams;
  const currentStep = toStep(params.step);
  const task = params.task === "assets" ? "assets" : "details";
  const returnToWorkflow = `/workflows/race-organiser?step=4&task=${task}`;
  const encodedReturnToWorkflow = encodeURIComponent(returnToWorkflow);

  return (
    <EditorialShell
      eyebrow="Race organiser workflow"
      title="Update race details or route files"
      description="Choose the exact update type so you land in the right editor first time."
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link href="/workflows" className="hover:text-stone-900 hover:underline underline-offset-4">
          Start a task
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">Race organiser</span>
      </nav>

      <WorkflowStepper
        currentStep={currentStep}
        steps={[
          "Choose update type",
          "Open the right editor",
          "Save your draft",
          "Track request status",
        ]}
      />

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        {currentStep === 1 ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Step 1 of 4</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">What are you updating?</h2>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <article className="rounded-2xl border border-stone-900/10 bg-stone-50/90 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">Race description and details</p>
                <p className="mt-3 text-sm leading-6 text-stone-700">Use this for description, venue, distance, climb, records, website, or organiser updates.</p>
                <Link href="/workflows/race-organiser?step=2&task=details" className="mt-5 inline-block rounded-full bg-amber-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-800">Continue</Link>
              </article>
              <article className="rounded-2xl border border-stone-900/10 bg-stone-50/90 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">GPX or map files</p>
                <p className="mt-3 text-sm leading-6 text-stone-700">Use this for route files, checkpoints, and map image updates.</p>
                <Link href="/workflows/race-organiser?step=2&task=assets" className="mt-5 inline-block rounded-full bg-amber-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-800">Continue</Link>
              </article>
            </div>
          </>
        ) : null}

        {currentStep === 2 ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Step 2 of 4</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Open the correct editor</h2>
            <p className="mt-3 text-sm leading-6 text-stone-700">
              {task === "details"
                ? "Open the race editor and choose the race you need to update."
                : "Open route file upload and choose the race for your file changes."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <Link href={task === "details" ? `/races?returnToWorkflow=${encodedReturnToWorkflow}` : `/race-assets?returnToWorkflow=${encodedReturnToWorkflow}`} className="rounded-full bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-800">
                {task === "details" ? "Open race editor" : "Open route file upload"}
              </Link>
              <Link href="/workflows/race-organiser?step=1" className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100">Back</Link>
              <Link href={`/workflows/race-organiser?step=3&task=${task}`} className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100">Continue</Link>
            </div>
          </>
        ) : null}

        {currentStep === 3 ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Step 3 of 4</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Save your draft request</h2>
            <p className="mt-3 text-sm leading-6 text-stone-700">Complete your update, then save the draft request and note the request number.</p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <Link href={task === "details" ? `/races?returnToWorkflow=${encodedReturnToWorkflow}` : `/race-assets?returnToWorkflow=${encodedReturnToWorkflow}`} className="rounded-full bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-800">
                {task === "details" ? "Open race editor" : "Open route file upload"}
              </Link>
              <Link href={`/workflows/race-organiser?step=4&task=${task}`} className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100">Continue to status tracking</Link>
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
              <Link href="/workflows/race-organiser?step=1" className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100">Start again</Link>
            </div>
          </>
        ) : null}
      </section>
    </EditorialShell>
  );
}