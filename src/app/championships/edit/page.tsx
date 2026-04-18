import { EditorialShell } from "@/components/editorial-shell";
import { ChampionshipItemPicker } from "@/components/championship-item-picker";
import { ChampionshipEditorForm } from "@/components/championship-editor-form";
import { getChampionshipDraft, listChampionshipDrafts } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type ChampionshipsEditPageProps = {
  searchParams?: Promise<{
    championshipId?: string;
    championshipQuery?: string;
  }>;
};

export default async function ChampionshipsEditPage({
  searchParams,
}: ChampionshipsEditPageProps) {
  await requireEditorAccess();
  const params = await searchParams;
  const championshipId = params?.championshipId?.trim();
  const championshipQuery = params?.championshipQuery?.trim() ?? "";

  const [initialValues, championshipItems] = await Promise.all([
    championshipId ? getChampionshipDraft(championshipId) : Promise.resolve(null),
    listChampionshipDrafts(),
  ]);

  return (
    <EditorialShell
      eyebrow="Edit"
      title="Edit championship"
      description="Select a championship to load it into the editor, then update its schedule or description."
    >
      <section>
        <ChampionshipItemPicker
          championshipItems={championshipItems}
          initialQuery={championshipQuery}
          selectedChampionshipId={championshipId}
        />
      </section>
      {championshipId ? (
        <ChampionshipEditorForm
          key={initialValues?.championshipId ?? championshipId}
          initialValues={initialValues}
        />
      ) : null}
    </EditorialShell>
  );
}
