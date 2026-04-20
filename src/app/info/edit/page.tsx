import { EditorialShell } from "@/components/editorial-shell";
import { InfoEditorForm } from "@/components/info-editor-form";
import { InfoItemPicker } from "@/components/info-item-picker";
import { getInfoDraft, listInfoDrafts } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type InfoEditPageProps = {
  searchParams?: Promise<{
    filePath?: string;
    routePath?: string;
    infoQuery?: string;
  }>;
};

export default async function InfoEditPage({ searchParams }: InfoEditPageProps) {
  await requireEditorAccess();
  const params = await searchParams;
  const filePath = params?.filePath?.trim() ?? params?.routePath?.trim();
  const infoQuery = params?.infoQuery?.trim() ?? "";

  const [items, initialValues] = await Promise.all([
    listInfoDrafts(),
    filePath !== undefined ? getInfoDraft(filePath) : Promise.resolve(null),
  ]);

  return (
    <EditorialShell
      eyebrow="Edit"
      title="Edit info markdown"
      description="Select an info markdown file and edit its content."
    >
      <section>
        <InfoItemPicker
          items={items}
          initialQuery={infoQuery}
          selectedFilePath={filePath}
        />
      </section>
      {filePath !== undefined ? (
        <InfoEditorForm
          key={initialValues?.filePath ?? filePath}
          initialValues={initialValues}
        />
      ) : null}
    </EditorialShell>
  );
}
