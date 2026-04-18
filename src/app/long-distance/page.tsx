import { EditorialShell } from "@/components/editorial-shell";
import { LongDistanceEditorForm } from "@/components/long-distance-editor-form";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function LongDistancePage() {
  await requireEditorAccess();

  return (
    <EditorialShell
      eyebrow="New"
      title="Create long-distance report"
      description="Add a new long-distance report with a title and detailed markdown body."
    >
      <LongDistanceEditorForm initialValues={null} />
    </EditorialShell>
  );
}
