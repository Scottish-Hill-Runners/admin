import Link from "next/link";
import { notFound } from "next/navigation";
import { EditorialShell } from "@/components/editorial-shell";
import { getEditorSession } from "@/lib/auth-session";
import { getEditorSubmissionDetail } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type SubmissionDetailPageProps = {
  params: Promise<{ id: string }>;
};

type SubmissionStatus = "open" | "closed" | "approved";

function formatDate(dateValue: string | null): string {
  if (!dateValue) {
    return "Not available";
  }

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }

  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusPill(status: SubmissionStatus): { label: string; classes: string } {
  if (status === "approved") {
    return {
      label: "Approved",
      classes: "bg-lime-100 text-lime-900 border-lime-800/20",
    };
  }

  if (status === "closed") {
    return {
      label: "Closed",
      classes: "bg-stone-200 text-stone-800 border-stone-800/20",
    };
  }

  return {
    label: "Waiting for review",
    classes: "bg-amber-100 text-amber-900 border-amber-800/20",
  };
}

function statusDescription(status: SubmissionStatus): string {
  if (status === "approved") {
    return "This request was approved and added to draft updates.";
  }

  if (status === "closed") {
    return "This request was closed without approval.";
  }

  return "This request is waiting for review.";
}

type TimelineStep = {
  key: "submitted" | "review" | "outcome";
  title: string;
  description: string;
  timestamp: string;
  active: boolean;
  completed: boolean;
};

function buildTimeline(status: SubmissionStatus, createdAt: string, updatedAt: string, closedAt: string | null): TimelineStep[] {
  const isOpen = status === "open";
  const isApproved = status === "approved";
  const isClosed = status === "closed";

  return [
    {
      key: "submitted",
      title: "Submitted",
      description: "Your request was created.",
      timestamp: formatDate(createdAt),
      active: false,
      completed: true,
    },
    {
      key: "review",
      title: "Waiting for review",
      description: "An administrator is reviewing this request.",
      timestamp: isOpen ? formatDate(updatedAt) : "Completed",
      active: isOpen,
      completed: !isOpen,
    },
    {
      key: "outcome",
      title: isApproved ? "Approved" : isClosed ? "Closed" : "Outcome pending",
      description: isApproved
        ? "This request was approved and added to draft updates."
        : isClosed
          ? "This request was closed without approval."
          : "This request is still being reviewed.",
      timestamp: isApproved || isClosed ? formatDate(closedAt ?? updatedAt) : "Pending",
      active: isApproved || isClosed,
      completed: isApproved || isClosed,
    },
  ];
}

function toChangedFileHref(path: string, ref?: string): string | null {
  const withRef = (href: string): string => {
    if (!ref) {
      return href;
    }

    const params = new URLSearchParams();
    params.set("ref", ref);
    return `${href}?${params.toString()}`;
  };

  if (path === "calendar.csv") {
    return withRef("/calendar");
  }

  const newsMatch = /^news\/(\d{4})\/(.+)\.md$/.exec(path);
  if (newsMatch) {
    return withRef(`/news/${encodeURIComponent(newsMatch[1])}/${encodeURIComponent(newsMatch[2])}`);
  }

  const raceResultsMatch = /^races\/([^/]+)\/([^/]+)\.csv$/.exec(path);
  if (raceResultsMatch) {
    return withRef(`/results/${encodeURIComponent(raceResultsMatch[1])}/${encodeURIComponent(raceResultsMatch[2])}`);
  }

  const raceMetadataMatch = /^races\/([^/]+)\/index\.md$/.exec(path);
  if (raceMetadataMatch) {
    return withRef(`/races/${encodeURIComponent(raceMetadataMatch[1])}`);
  }

  const raceImagesMatch = /^races\/([^/]+)\/images\.ya?ml$/.exec(path);
  if (raceImagesMatch) {
    return withRef(`/races/${encodeURIComponent(raceImagesMatch[1])}/images`);
  }

  const raceAssetsMatch = /^races\/([^/]+)\/(map\.[^/]+|route\.geojson)$/.exec(path);
  if (raceAssetsMatch) {
    return withRef(`/race-assets/${encodeURIComponent(raceAssetsMatch[1])}`);
  }

  const clubMatch = /^clubs\/([^/]+)\.md$/.exec(path);
  if (clubMatch) {
    return withRef(`/clubs/${encodeURIComponent(clubMatch[1])}`);
  }

  const longDistanceMatch = /^long-distance\/([^/]+)\.md$/.exec(path);
  if (longDistanceMatch) {
    return withRef(`/long-distance/${encodeURIComponent(longDistanceMatch[1])}`);
  }

  const infoMatch = /^info\/(.+)\.md$/.exec(path);
  if (infoMatch) {
    const segments = infoMatch[1]
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment));

    return withRef(segments.length > 0 ? `/info/${segments.join("/")}` : "/info");
  }

  if (path === "collections/homepage-images.yaml" || path === "homepage/images.yaml") {
    return withRef("/collections/homepage");
  }

  if (path === "collections/documents.yaml" || path === "documents/manifest.yaml") {
    return withRef("/collections/documents");
  }

  if (path === "collections/committee-portraits.yaml" || path === "committee/portraits.yaml") {
    return withRef("/collections/committee");
  }

  return null;
}

export default async function SubmissionDetailPage({ params }: SubmissionDetailPageProps) {
  const { id } = await params;
  await requireEditorAccess({ callbackUrl: `/submissions/${id}` });

  const submissionNumber = Number.parseInt(id, 10);
  if (!Number.isInteger(submissionNumber) || submissionNumber <= 0) {
    notFound();
  }

  const editorSession = await getEditorSession();
  if (!editorSession.email) {
    notFound();
  }

  const submission = await getEditorSubmissionDetail(editorSession.email, submissionNumber);
  if (!submission) {
    notFound();
  }

  const pill = statusPill(submission.status);
  const timeline = buildTimeline(
    submission.status,
    submission.createdAt,
    submission.updatedAt,
    submission.closedAt
  );

  return (
    <EditorialShell
      eyebrow="Scottish Hill Runners"
      title={`Request #${submission.number}`}
      description="Detailed view of your submission, including status and file changes."
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link href="/submissions" className="hover:text-stone-900 hover:underline underline-offset-4">
          My submissions
        </Link>
        <span aria-hidden="true">&gt;</span>
        <span className="font-semibold text-stone-900">Request #{submission.number}</span>
      </nav>

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
            {submission.title}
          </h2>
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${pill.classes}`}>
            {pill.label}
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-stone-700">{statusDescription(submission.status)}</p>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em] text-stone-500">Created</dt>
            <dd className="mt-1 text-stone-900">{formatDate(submission.createdAt)}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em] text-stone-500">Last updated</dt>
            <dd className="mt-1 text-stone-900">{formatDate(submission.updatedAt)}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em] text-stone-500">Closed</dt>
            <dd className="mt-1 text-stone-900">{formatDate(submission.closedAt)}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em] text-stone-500">Submitted by</dt>
            <dd className="mt-1 text-stone-900">{submission.submitterName ?? "Unknown editor"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <h3 className="font-[family:var(--font-heading)] text-xl text-stone-900">Status timeline</h3>
        <ol className="mt-4 space-y-3">
          {timeline.map((step) => {
            const indicatorClasses = step.active
              ? "bg-amber-600 border-amber-700"
              : step.completed
                ? "bg-lime-600 border-lime-700"
                : "bg-stone-300 border-stone-400";

            return (
              <li
                key={step.key}
                className="rounded-xl border border-stone-900/10 bg-stone-50 px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`inline-flex h-3 w-3 rounded-full border ${indicatorClasses}`} />
                  <p className="text-sm font-semibold text-stone-900">{step.title}</p>
                  <p className="text-xs uppercase tracking-[0.14em] text-stone-500">
                    {step.timestamp}
                  </p>
                </div>
                <p className="mt-2 text-sm leading-6 text-stone-700">{step.description}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <h3 className="font-[family:var(--font-heading)] text-xl text-stone-900">Changed files</h3>
        {submission.changedFiles.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-stone-600">
            No file list is available for this request.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {submission.changedFiles.map((file) => {
              const href = toChangedFileHref(file.path, submission.headRef);

              return (
                <li key={`${file.changeType}-${file.path}`} className="rounded-xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                  {href ? (
                    <Link
                      href={href}
                      className="text-sm font-semibold text-stone-900 underline decoration-stone-300 underline-offset-4 transition hover:text-stone-700 hover:decoration-stone-600"
                    >
                      {file.path}
                    </Link>
                  ) : (
                    <p className="text-sm font-semibold text-stone-900">{file.path}</p>
                  )}
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-stone-500">
                    Change: {file.changeType}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </EditorialShell>
  );
}
