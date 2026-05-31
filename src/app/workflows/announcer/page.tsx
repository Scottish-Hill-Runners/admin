import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { WorkflowStepper } from "@/app/workflows/_components/workflow-stepper";
import { requireEditorAccess } from "@/lib/route-protection";

type AnnouncerWorkflowPageProps = {
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

export default async function AnnouncerWorkflowPage({ searchParams }: AnnouncerWorkflowPageProps) {
  await requireEditorAccess({ callbackUrl: "/workflows/announcer" });
  const params = await searchParams;
  const currentStep = toStep(params.step);
  const task = params.task === "edit" ? "edit" : "new";
  const returnToStatusTracking = `/workflows/announcer?step=4&task=${task}`;
  const openNewsHref = `/news?returnToWorkflow=${encodeURIComponent(returnToStatusTracking)}`;

  return (
    <EditorialShell
      eyebrow="Announcer workflow"
      title="Post a news item"
      description="Choose whether to add a new post or update one that already exists."
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link href="/workflows" className="hover:text-stone-900 hover:underline underline-offset-4">
          Start a task
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">Announcer</span>
      </nav>

      <WorkflowStepper
        currentStep={currentStep}
        steps={[
          "Choose post task",
          "Open news editor",
          "Save your draft",
          "Track request status",
        ]}
      />

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        {currentStep === 1 ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Step 1 of 4</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">What do you need to do?</h2>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <article className="rounded-2xl border border-stone-900/10 bg-stone-50/90 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">Create a new post</p>
                <p className="mt-3 text-sm leading-6 text-stone-700">Start a fresh news update.</p>
                <Link href="/workflows/announcer?step=2&task=new" className="mt-5 inline-block rounded-full bg-amber-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-800">Continue</Link>
              </article>
              <article className="rounded-2xl border border-stone-900/10 bg-stone-50/90 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">Update an existing post</p>
                <p className="mt-3 text-sm leading-6 text-stone-700">Choose a published item and apply updates.</p>
                <Link href="/workflows/announcer?step=2&task=edit" className="mt-5 inline-block rounded-full bg-amber-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-800">Continue</Link>
              </article>
            </div>
          </>
        ) : null}

        {currentStep === 2 ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Step 2 of 4</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Open news editor</h2>
            <p className="mt-3 text-sm leading-6 text-stone-700">
              {task === "new"
                ? "Open news and use Add new post."
                : "Open news and select the post you want to edit."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <Link href={openNewsHref} className="rounded-full bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-800">Open news editor</Link>
              <Link href="/workflows/announcer?step=1" className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100">Back</Link>
              <Link href={`/workflows/announcer?step=3&task=${task}`} className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100">Continue</Link>
            </div>
          </>
        ) : null}

        {currentStep === 3 ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Step 3 of 4</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-2xl text-stone-900">Save your draft request</h2>
            <p className="mt-3 text-sm leading-6 text-stone-700">Complete title, date, summary, and body, then save your draft request.</p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <Link href={openNewsHref} className="rounded-full bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-800">Open news editor</Link>
              <Link href={`/workflows/announcer?step=4&task=${task}`} className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100">Continue to status tracking</Link>
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
              <Link href="/workflows/announcer?step=1" className="rounded-full border border-stone-900/15 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100">Start again</Link>
            </div>
          </>
        ) : null}
      </section>
    </EditorialShell>
  );
}