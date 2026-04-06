import { EditorialShell } from "@/components/editorial-shell";
import { RaceEditorForm } from "@/components/race-editor-form";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function RacesPage() {
  await requireEditorAccess();

  return (
    <EditorialShell
      eyebrow="New"
      title="Create new race"
      description="Start a new race page with metadata, route description, and event details."
    >
      <RaceEditorForm initialValues={null} />
    </EditorialShell>
  );
}
