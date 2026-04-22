import { EditorialShell } from "@/components/editorial-shell";
import { ClubEditorForm } from "@/components/club-editor-form";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function ClubsPage() {
  await requireEditorAccess({ callbackUrl: "/clubs" });

  return (
    <EditorialShell
      eyebrow="New"
      title="Create new club"
      description="Add a new club entry with its name, aliases, website, and a description."
    >
      <ClubEditorForm initialValues={null} />
    </EditorialShell>
  );
}
