import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { WorkflowStepper } from "@/app/workflows/_components/workflow-stepper";
import { requireEditorAccess } from "@/lib/route-protection";

type ClubOfficialWorkflowPageProps = {
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

export default async function ClubOfficialWorkflowPage({ searchParams }: ClubOfficialWorkflowPageProps) {
  await requireEditorAccess({ callbackUrl: "/workflows/club-official" });
  const params = await searchParams;
  const currentStep = toStep(params.step);
  const task = params.task === "edit" ? "edit" : "new";
  const returnToStatusTracking = `/workflows/club-official?step=4&task=${task}`;
  const clubsParams = new URLSearchParams();
  clubsParams.set("returnToWorkflow", returnToStatusTracking);
  clubsParams.set("mode", task === "new" ? "new" : "edit");
  const openClubsHref = `/clubs?${clubsParams.toString()}`;

  return (
    <EditorialShell
      eyebrow="Club official workflow"
      title="Create or update a club entry"
      description="Choose whether you are adding a new club or updating an existing listing, then save your draft and track progress."
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link href="/workflows" className="hover:text-stone-900 hover:underline underline-offset-4">
          Start a task
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">Club official</span>
      </nav>

      <WorkflowStepper
        currentStep={currentStep}
        steps={[
          "Choose club task",
          "Open club editor",
          "Save your draft",
          "Track request status",
        ]}
      />

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        {currentStep === 1 ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Step 1 of 4</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Pick your club task</h2>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <article className="rounded-2xl border border-stone-900/10 bg-stone-50/90 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">Create a new club</p>
                <p className="mt-3 text-sm leading-6 text-stone-700">Use this when the club does not yet have an entry.</p>
                <Link href="/workflows/club-official?step=2&task=new" className="mt-5 inline-block rounded-full bg-amber-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-800">Continue</Link>
              </article>
              <article className="rounded-2xl border border-stone-900/10 bg-stone-50/90 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">Update an existing club</p>
                <p className="mt-3 text-sm leading-6 text-stone-700">Use this when the club already has an entry and needs changes.</p>
                <Link href="/workflows/club-official?step=2&task=edit" className="mt-5 inline-block rounded-full bg-amber-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-800">Continue</Link>
              </article>
            </div>
          </>
        ) : null}

        {currentStep === 2 ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Step 2 of 4</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Open club editor</h2>
            <p className="mt-3 text-sm leading-6 text-stone-700">
              {task === "new"
                ? "Open Clubs and use Add new club."
                : "Open Clubs and select the club you want to update."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <Link href={openClubsHref} className="rounded-full bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-800">Open clubs editor</Link>
              <Link href="/workflows/club-official?step=1" className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100">Back</Link>
              <Link href={`/workflows/club-official?step=3&task=${task}`} className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100">Continue</Link>
            </div>
          </>
        ) : null}

        {currentStep === 3 ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Step 3 of 4</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Save your draft request</h2>
            <p className="mt-3 text-sm leading-6 text-stone-700">Complete the club details, save your draft request, and note the request number.</p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <Link href={openClubsHref} className="rounded-full bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-800">Open clubs editor</Link>
              <Link href={`/workflows/club-official?step=4&task=${task}`} className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100">Continue to status tracking</Link>
            </div>
          </>
        ) : null}

        {currentStep === 4 ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Step 4 of 4</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Track progress</h2>
            <p className="mt-3 text-sm leading-6 text-stone-700">Open My requests to check whether your club update is waiting for review, approved, or closed.</p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <Link href="/submissions" className="rounded-full bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-800">Open My requests</Link>
              <Link href="/workflows/club-official?step=1" className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100">Start again</Link>
            </div>
          </>
        ) : null}
      </section>
    </EditorialShell>
  );
}