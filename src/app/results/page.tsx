import { EditorialShell } from "@/components/editorial-shell";
import { ResultsUploadForm } from "@/components/results-upload-form";
import { listRaceDrafts } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function ResultsPage() {
  await requireEditorAccess();
  const raceItems = await listRaceDrafts();

  return (
    <EditorialShell
      eyebrow="New"
      title="Upload race results"
      description="Import a CSV file with race results, validate, and create a pull request."
    >
      <ResultsUploadForm initialValues={null} raceItems={raceItems} />
    </EditorialShell>
  );
}
