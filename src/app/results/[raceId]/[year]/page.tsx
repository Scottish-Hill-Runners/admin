import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { ResultsEditForm } from "@/components/results-edit-form";
import { ResultsUploadForm } from "@/components/results-upload-form";
import { getRaceResultsDraft, listAllClubNameSet } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type ResultsTerminalPageProps = {
  params: Promise<{ raceId: string; year: string }>;
};

export default async function ResultsTerminalPage({ params }: ResultsTerminalPageProps) {
  const { raceId, year } = await params;
  await requireEditorAccess({ callbackUrl: `/results/${raceId}/${year}` });

  const [existingDraft, clubNameSet] = await Promise.all([
    getRaceResultsDraft(raceId, year),
    listAllClubNameSet(),
  ]);

  const knownClubNames = [...clubNameSet];

  const breadcrumb = (
    <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
      <Link href="/results" className="hover:text-stone-900 hover:underline underline-offset-4">
        Results
      </Link>
      <span aria-hidden="true">›</span>
      <Link
        href={`/results/${encodeURIComponent(raceId)}`}
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
      />
    </EditorialShell>
  );
}
