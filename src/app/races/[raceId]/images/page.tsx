import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { RaceImagesForm } from "@/components/race-images-form";
import { getRaceDraft } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type RaceImagesPageProps = {
  params: Promise<{ raceId: string }>;
};

export default async function RaceImagesPage({ params }: RaceImagesPageProps) {
  const { raceId } = await params;
  await requireEditorAccess({ callbackUrl: `/races/${raceId}/images` });

  const raceDraft = await getRaceDraft(raceId);
  const raceExists = raceDraft !== null;

  return (
    <EditorialShell
      eyebrow="Race Images"
      title={raceId}
      description="Upload race photos to blobs/ and register them in collections.yaml."
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link
          href="/races"
          className="hover:text-stone-900 hover:underline underline-offset-4"
        >
          Races
        </Link>
        <span aria-hidden="true">›</span>
        <Link
          href={`/races/${encodeURIComponent(raceId)}`}
          className="hover:text-stone-900 hover:underline underline-offset-4"
        >
          {raceId}
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">Images</span>
      </nav>

      <RaceImagesForm
        fixedRaceSlug={raceId}
        raceExists={raceExists}
      />
    </EditorialShell>
  );
}
