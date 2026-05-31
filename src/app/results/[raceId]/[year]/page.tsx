import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { ResultsEditForm } from "@/components/results-edit-form";
import { ResultsUploadForm } from "@/components/results-upload-form";
import { getRaceResultsDraft, listAllClubNameSet, toSafeGitRef } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type ResultsTerminalPageProps = {
  params: Promise<{ raceId: string; year: string }>;
  searchParams?: Promise<{ returnToWorkflow?: string; ref?: string }>;
};

function toSafeReturnPath(value: string | undefined): string | undefined {
  const trimmed = String(value ?? "").trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return undefined;
  }

  return trimmed;
}

export default async function ResultsTerminalPage({ params, searchParams }: ResultsTerminalPageProps) {
  const { raceId, year } = await params;
  const rawSearch = await searchParams;
  const returnToWorkflow = toSafeReturnPath(rawSearch?.returnToWorkflow);
  const ref = toSafeGitRef(rawSearch?.ref);
  const returnSuffix = returnToWorkflow
    ? `?returnToWorkflow=${encodeURIComponent(returnToWorkflow)}`
    : "";
  await requireEditorAccess({ callbackUrl: `/results/${raceId}/${year}` });

  const clubNameSet = await listAllClubNameSet();

  const existingDraft = await getRaceResultsDraft(raceId, year, { ref });

  const knownClubNames = [...clubNameSet];

  const breadcrumb = (
    <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
      <Link href={`/results${returnSuffix}`} className="hover:text-stone-900 hover:underline underline-offset-4">
        Results
      </Link>
      <span aria-hidden="true">›</span>
      <Link
        href={`/results/${encodeURIComponent(raceId)}${returnSuffix}`}
        className="hover:text-stone-900 hover:underline underline-offset-4"
      >
        {raceId}
      </Link>
      <span aria-hidden="true">›</span>
      <span className="font-semibold text-stone-900">{year}</span>
    </nav>
  );

  if (existingDraft) {
    return (
      <EditorialShell
        eyebrow="Edit results"
        title={`${raceId} — ${year}`}
        description={`Edit the existing results CSV for races/${raceId}/${year}.csv.`}
      >
        {breadcrumb}
        <ResultsEditForm
          key={`${raceId}:${year}`}
          raceId={raceId}
          year={year}
          csvText={existingDraft.csvText}
          knownClubNames={knownClubNames}
          returnToWorkflowUrl={returnToWorkflow}
        />
      </EditorialShell>
    );
  }

  return (
    <EditorialShell
      eyebrow="New results"
      title={`${raceId} — ${year}`}
      description={`Upload a new results CSV for races/${raceId}/${year}.csv.`}
    >
      {breadcrumb}
      <ResultsUploadForm
        fixedRaceId={raceId}
        fixedYear={year}
        knownClubNames={knownClubNames}
        returnToWorkflowUrl={returnToWorkflow}
      />
    </EditorialShell>
  );
}
