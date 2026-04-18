import { EditorialShell } from "@/components/editorial-shell";
import { LongDistanceItemPicker } from "@/components/long-distance-item-picker";
import { LongDistanceEditorForm } from "@/components/long-distance-editor-form";
import { getLongDistanceDraft, listLongDistanceDrafts } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type LongDistanceEditPageProps = {
  searchParams?: Promise<{
    slug?: string;
    ldQuery?: string;
  }>;
};

export default async function LongDistanceEditPage({ searchParams }: LongDistanceEditPageProps) {
  await requireEditorAccess();
  const params = await searchParams;
  const slug = params?.slug?.trim();
  const ldQuery = params?.ldQuery?.trim() ?? "";

  const [initialValues, items] = await Promise.all([
    slug ? getLongDistanceDraft(slug) : Promise.resolve(null),
    listLongDistanceDrafts(),
  ]);

  return (
    <EditorialShell
      eyebrow="Edit"
      title="Edit long-distance report"
      description="Select a report to load it into the editor, then update its content."
    >
      <section>
        <LongDistanceItemPicker items={items} initialQuery={ldQuery} selectedSlug={slug} />
      </section>
      {slug ? (
        <LongDistanceEditorForm
          key={initialValues?.slug ?? slug}
          initialValues={initialValues}
        />
      ) : null}
    </EditorialShell>
  );
}
