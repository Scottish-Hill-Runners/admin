import { EditorialShell } from "@/components/editorial-shell";
import Link from "next/link";
import { getEditorSession } from "@/lib/auth-session";
import { listEditorSubmissions } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type SubmissionStatus = "open" | "closed" | "approved";

function formatDate(dateValue: string): string {
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

export default async function SubmissionsPage() {
  await requireEditorAccess({ callbackUrl: "/submissions" });
  const editorSession = await getEditorSession();
  const email = editorSession.email;

  const submissions = email
    ? await listEditorSubmissions(email, { limit: 40 })
    : [];

  return (
    <EditorialShell
      eyebrow="Scottish Hill Runners"
      title="My submissions"
      description="Track your recent draft submissions in one place without leaving the admin site."
    >
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        {!email ? (
          <p className="text-sm leading-6 text-red-700">
            Your account is missing an email address, so submissions cannot be matched yet. Please
            contact an administrator.
          </p>
        ) : submissions.length === 0 ? (
          <p className="text-sm leading-6 text-stone-700">
            No submissions found for your account yet. Save a draft in any editor and it will
            appear here.
          </p>
        ) : (
          <div className="space-y-3">
            {submissions.map((submission) => {
              const pill = statusPill(submission.status);
              return (
                <article
                  key={submission.number}
                  className="rounded-2xl border border-stone-900/10 bg-stone-50/90 p-4"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-base font-semibold text-stone-900">
                      Request #{submission.number}
                    </p>
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${pill.classes}`}
                    >
                      {pill.label}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-stone-800">{submission.title}</p>
                  {submission.requiresAttention ? (
                    <p className="mt-2 text-sm leading-6 text-amber-800">
                      This submission needs administrator attention before it can continue through
                      draft updates.
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs uppercase tracking-[0.14em] text-stone-500">
                    Created {formatDate(submission.createdAt)} • Updated {formatDate(submission.updatedAt)}
                  </p>
                  <Link
                    href={`/submissions/${submission.number}`}
                    className="mt-3 inline-block text-sm font-semibold text-amber-700 underline"
                  >
                    View details
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </EditorialShell>
  );
}
