import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { WorkflowStepper } from "@/app/workflows/_components/workflow-stepper";
import { requireEditorAccess } from "@/lib/route-protection";

type RunnerWorkflowPageProps = {
  searchParams: Promise<{ step?: string; mode?: string }>;
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

export default async function RunnerWorkflowPage({ searchParams }: RunnerWorkflowPageProps) {
  await requireEditorAccess({ callbackUrl: "/workflows/runner" });
  const params = await searchParams;
  const currentStep = toStep(params.step);
  const mode = params.mode === "find" ? "find" : "known";
  const returnToWorkflow = `/workflows/runner?step=4&mode=${mode}`;
  const encodedReturnToWorkflow = encodeURIComponent(returnToWorkflow);

  return (
    <EditorialShell
      eyebrow="Runner workflow"
      title="Correct a result"
      description="Use this guided route to find the right results file, apply your correction, and track review status."
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link href="/workflows" className="hover:text-stone-900 hover:underline underline-offset-4">
          Start a task
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">Runner</span>
      </nav>

      <WorkflowStepper
        currentStep={currentStep}
        steps={[
          "Identify race and year",
          "Open the right results file",
          "Save your correction",
          "Track request status",
        ]}
      />

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        {currentStep === 1 ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Step 1 of 4</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">
              Do you know the race ID and year?
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Choose one path and we will guide you to the correct file.
            </p>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-stone-900/10 bg-stone-50/90 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">Yes, I know both</p>
                <p className="mt-3 text-sm leading-6 text-stone-700">
                  Continue to enter race ID and year directly.
                </p>
                <Link
                  href="/workflows/runner?step=2&mode=known"
                  className="mt-5 inline-block rounded-full bg-amber-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-800"
                >
                  Continue
                </Link>
              </section>

              <section className="rounded-2xl border border-stone-900/10 bg-stone-50/90 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">No, I need to find them</p>
                <p className="mt-3 text-sm leading-6 text-stone-700">
                  Continue to browse races and pick the right year.
                </p>
                <Link
                  href="/workflows/runner?step=2&mode=find"
                  className="mt-5 inline-block rounded-full bg-amber-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-800"
                >
                  Continue
                </Link>
              </section>
            </div>
          </>
        ) : null}

        {currentStep === 2 ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Step 2 of 4</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">
              Open the correct results file
            </h2>
            {mode === "known" ? (
              <form action="/workflows/runner/start" method="get" className="mt-4 grid gap-4 lg:max-w-xl">
                <input type="hidden" name="mode" value={mode} />
                <input type="hidden" name="returnToWorkflow" value={returnToWorkflow} />
                <label className="block space-y-2">
                  <span className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
                    Race ID
                  </span>
                  <input
                    name="raceId"
                    required
                    placeholder="e.g. Carnethy5"
                    className="w-full rounded-2xl border border-stone-900/10 bg-white px-4 py-3 text-base text-stone-900 outline-none transition focus:border-stone-900/40"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
                    Year
                  </span>
                  <input
                    name="year"
                    required
                    placeholder="e.g. 2025"
                    className="w-full rounded-2xl border border-stone-900/10 bg-white px-4 py-3 text-base text-stone-900 outline-none transition focus:border-stone-900/40"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-full bg-amber-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-800"
                >
                  Open correction form
                </button>
              </form>
            ) : (
              <>
                <p className="mt-3 text-sm leading-6 text-stone-700">
                  Open the race list, choose your race, then choose the year to enter the correction form.
                </p>
                <Link
                  href={`/results?mode=historic&returnToWorkflow=${encodedReturnToWorkflow}`}
                  className="mt-5 inline-block rounded-full bg-amber-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-800"
                >
                  Browse races
                </Link>
              </>
            )}

            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <Link
                href="/workflows/runner?step=1"
                className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100"
              >
                Back
              </Link>
              <Link
                href={`/workflows/runner?step=3&mode=${mode}`}
                className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100"
              >
                Continue to next step
              </Link>
            </div>
          </>
        ) : null}

        {currentStep === 3 ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Step 3 of 4</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">
              Save your correction request
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-700">
              In the results editor, make the correction and save your draft request.
            </p>
            <p className="text-sm leading-6 text-stone-700">
              After saving, note the request number shown in the success message.
            </p>

            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <Link
                href={`/results?mode=historic&returnToWorkflow=${encodedReturnToWorkflow}`}
                className="rounded-full bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-800"
              >
                Open results editor
              </Link>
              <Link
                href={`/workflows/runner?step=4&mode=${mode}`}
                className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100"
              >
                Continue to status tracking
              </Link>
            </div>
          </>
        ) : null}

        {currentStep === 4 ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Step 4 of 4</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">
              Track progress
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-700">
              Open My requests to check whether your correction is waiting for review, approved, or closed.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <Link
                href="/submissions"
                className="rounded-full bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-800"
              >
                Open My requests
              </Link>
              <Link
                href="/workflows/runner?step=1"
                className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100"
              >
                Start again
              </Link>
            </div>
          </>
        ) : null}
      </section>
    </EditorialShell>
  );
}