import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { LongDistanceEditorForm } from "@/components/long-distance-editor-form";
import { getLongDistanceDraft, toSafeGitRef } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type LongDistanceEditPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ returnToWorkflow?: string; ref?: string }>;
};

function toSafeReturnPath(value: string | undefined): string | undefined {
  const trimmed = String(value ?? "").trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return undefined;
  }

  return trimmed;
}

export default async function LongDistanceEditPage({ params, searchParams }: LongDistanceEditPageProps) {
  const { slug } = await params;
  const rawSearch = await searchParams;
  const returnToWorkflowUrl = toSafeReturnPath(rawSearch?.returnToWorkflow);
  const ref = toSafeGitRef(rawSearch?.ref);
  const returnSuffix = returnToWorkflowUrl
    ? `?returnToWorkflow=${encodeURIComponent(returnToWorkflowUrl)}`
    : "";
  await requireEditorAccess({ callbackUrl: `/long-distance/${slug}` });

  const initialValues = await getLongDistanceDraft(slug, { ref });

  return (
    <EditorialShell
      eyebrow="Edit report"
      title={initialValues?.title ?? slug}
      description={`Edit long-distance report: ${slug}.`}
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link href={`/long-distance${returnSuffix}`} className="hover:text-stone-900 hover:underline underline-offset-4">
          Long Distance
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">{slug}</span>
      </nav>
      <LongDistanceEditorForm
        key={initialValues?.slug ?? slug}
        initialValues={initialValues}
        returnToWorkflowUrl={returnToWorkflowUrl}
      />
    </EditorialShell>
  );
}
