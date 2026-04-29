import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { ChampionshipEditorForm } from "@/components/championship-editor-form";
import { getChampionshipDraft } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type ChampionshipEditPageProps = {
  params: Promise<{ championshipId: string }>;
};

export default async function ChampionshipEditPage({ params }: ChampionshipEditPageProps) {
  const { championshipId } = await params;
  await requireEditorAccess({ callbackUrl: `/championships/${championshipId}` });

  const initialValues = await getChampionshipDraft(championshipId);

  return (
    <EditorialShell
      eyebrow="Championships"
      title={initialValues?.title ?? championshipId}
      description="Edit the race schedule and description for this championship."
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link
          href="/championships"
          className="hover:text-stone-900 hover:underline underline-offset-4"
        >
          Championships
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">{championshipId}</span>
      </nav>
      <ChampionshipEditorForm
        key={championshipId}
        championshipId={championshipId}
        initialValues={initialValues}
      />
    </EditorialShell>
  );
}
