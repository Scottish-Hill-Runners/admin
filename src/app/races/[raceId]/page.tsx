import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { RaceEditorForm } from "@/components/race-editor-form";
import { getRaceDraft } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type RaceEditPageProps = {
  params: Promise<{ raceId: string }>;
};

export default async function RaceEditPage({ params }: RaceEditPageProps) {
  const { raceId } = await params;
  await requireEditorAccess({ callbackUrl: `/races/${raceId}` });

  const initialValues = await getRaceDraft(raceId);

  return (
    <EditorialShell
      eyebrow="Edit race"
      title={initialValues?.title ?? raceId}
      description={`Edit metadata and route description for ${initialValues?.title ?? raceId}.`}
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link href="/races" className="hover:text-stone-900 hover:underline underline-offset-4">
          Races
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">{raceId}</span>
      </nav>
      <RaceEditorForm
        key={initialValues?.raceId ?? raceId}
        initialValues={initialValues}
      />
    </EditorialShell>
  );
}
