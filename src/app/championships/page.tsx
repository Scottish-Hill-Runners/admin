import { EditorialShell } from "@/components/editorial-shell";
import { ChampionshipEditorForm } from "@/components/championship-editor-form";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function ChampionshipsPage() {
  await requireEditorAccess();

  return (
    <EditorialShell
      eyebrow="New"
      title="Create new championship"
      description="Add a new championship with its title, annual race schedules, and a description."
    >
      <ChampionshipEditorForm initialValues={null} />
    </EditorialShell>
  );
}
