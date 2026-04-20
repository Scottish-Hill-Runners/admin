import { EditorialShell } from "@/components/editorial-shell";
import { InfoEditorForm } from "@/components/info-editor-form";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function InfoPage() {
  await requireEditorAccess();

  return (
    <EditorialShell
      eyebrow="New"
      title="Create info markdown"
      description="Create or update any markdown file under info/ (use index.md for directory default routes)."
    >
      <InfoEditorForm initialValues={null} />
    </EditorialShell>
  );
}
