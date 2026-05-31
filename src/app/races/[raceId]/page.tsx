import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { RaceEditorForm } from "@/components/race-editor-form";
import { getRaceDraft, toSafeGitRef } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type RaceEditPageProps = {
  params: Promise<{ raceId: string }>;
  searchParams?: Promise<{ returnToWorkflow?: string; ref?: string }>;
};

function toSafeReturnPath(value: string | undefined): string | undefined {
  const trimmed = String(value ?? "").trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return undefined;
  }

  return trimmed;
}

export default async function RaceEditPage({ params, searchParams }: RaceEditPageProps) {
  const { raceId } = await params;
  const rawSearch = await searchParams;
  const returnToWorkflow = toSafeReturnPath(rawSearch?.returnToWorkflow);
  const ref = toSafeGitRef(rawSearch?.ref);
  const returnSuffix = returnToWorkflow
    ? `?returnToWorkflow=${encodeURIComponent(returnToWorkflow)}`
    : "";
  await requireEditorAccess({ callbackUrl: `/races/${raceId}` });

  const initialValues = await getRaceDraft(raceId, { ref });

  return (
    <EditorialShell
      eyebrow="Edit race"
      title={initialValues?.title ?? raceId}
      description={`Edit metadata and route description for ${initialValues?.title ?? raceId}.`}
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link href={`/races${returnSuffix}`} className="hover:text-stone-900 hover:underline underline-offset-4">
          Races
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">{raceId}</span>
      </nav>

      <RaceEditorForm
        key={initialValues?.raceId ?? raceId}
        initialValues={initialValues}
        returnToWorkflowUrl={returnToWorkflow}
      />
    </EditorialShell>
  );
}

