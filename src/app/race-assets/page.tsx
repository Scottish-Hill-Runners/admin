import { EditorialShell } from "@/components/editorial-shell";
import { RaceAssetsUploadForm } from "@/components/race-assets-upload-form";
import { requireEditorAccess } from "@/lib/route-protection";
import { listRaceDrafts } from "@/lib/github";

export default async function RaceAssetsPage() {
  await requireEditorAccess({ callbackUrl: "/race-assets" });
  const raceItems = await listRaceDrafts();

  return (
    <EditorialShell
      eyebrow="Race Assets"
      title="Map & route upload"
      description="Upload a map image and GPX route file for a race. GPX files are automatically cleaned — timestamps and personal data are stripped, and the track is smoothed using Douglas-Peucker before publishing."
    >
      <RaceAssetsUploadForm raceItems={raceItems} />
    </EditorialShell>
  );
}
