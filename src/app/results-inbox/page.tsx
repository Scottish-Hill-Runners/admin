import { EditorialShell } from "@/components/editorial-shell";
import { ResultsInboxReviewCard } from "@/components/results-inbox-review-card";
import {
  listResultsInboxCandidates,
  summarizeResultsInbox,
} from "@/lib/results-inbox";
import { requirePublisherAccess } from "@/lib/route-protection";

export default async function ResultsInboxPage() {
  await requirePublisherAccess();
  const candidates = await listResultsInboxCandidates();
  const summary = summarizeResultsInbox(candidates);

  return (
    <EditorialShell
      eyebrow="Scottish Hill Runners"
      title="Results inbox"
      description="Review incoming results emails and create draft updates when they are ready."
    >
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-stone-900/10 bg-stone-50 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-stone-500">Queued</p>
            <p className="mt-2 text-2xl font-semibold text-stone-900">{summary.queued}</p>
          </div>
          <div className="rounded-xl border border-stone-900/10 bg-stone-50 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-stone-500">Draft created</p>
            <p className="mt-2 text-2xl font-semibold text-stone-900">{summary.draftCreated}</p>
          </div>
          <div className="rounded-xl border border-stone-900/10 bg-stone-50 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-stone-500">Dismissed</p>
            <p className="mt-2 text-2xl font-semibold text-stone-900">{summary.rejected}</p>
          </div>
          <div className="rounded-xl border border-stone-900/10 bg-stone-50 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-stone-500">Needs attention</p>
            <p className="mt-2 text-2xl font-semibold text-stone-900">{summary.error}</p>
          </div>
        </div>

        {candidates.length === 0 ? (
          <p className="mt-6 text-sm leading-6 text-stone-700">
            No incoming results are queued yet. Send a CSV or XLSX attachment to the monitored
            mailbox and it will appear here after ingestion.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            {candidates.map((candidate) => (
              <ResultsInboxReviewCard key={candidate.id} candidate={candidate} />
            ))}
          </div>
        )}
      </section>
    </EditorialShell>
  );
}
