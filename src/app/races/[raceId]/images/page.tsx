import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { RaceImagesForm } from "@/components/race-images-form";
import { getRaceDraft, getRaceImagesDraft } from "@/lib/github";
import { parseAndValidateRaceImagesYaml } from "@/lib/collections-yaml";
import { requireEditorAccess } from "@/lib/route-protection";

type RaceImagesPageProps = {
  params: Promise<{ raceId: string }>;
  searchParams?: Promise<{ returnToWorkflow?: string }>;
};

function toSafeReturnPath(value: string | undefined): string | undefined {
  const trimmed = String(value ?? "").trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return undefined;
  }

  return trimmed;
}

export default async function RaceImagesPage({ params, searchParams }: RaceImagesPageProps) {
  const { raceId } = await params;
  const paramsWithQuery = searchParams ? await searchParams : undefined;
  const returnToWorkflowUrl = toSafeReturnPath(paramsWithQuery?.returnToWorkflow);

  await requireEditorAccess({
    callbackUrl: returnToWorkflowUrl
      ? `/races/${raceId}/images?returnToWorkflow=${encodeURIComponent(returnToWorkflowUrl)}`
      : `/races/${raceId}/images`,
  });

  const [raceDraft, raceImagesYaml] = await Promise.all([
    getRaceDraft(raceId),
    getRaceImagesDraft(raceId),
  ]);
  const raceExists = raceDraft !== null;
  const raceImages = raceImagesYaml ? parseAndValidateRaceImagesYaml(raceImagesYaml) : null;
  const imageCount = raceImages?.data
    ? raceImages.data.hero.length + raceImages.data.gallery.length
    : undefined;

  return (
    <EditorialShell
      eyebrow="Race Images"
      title={raceId}
      description="Upload race photos into the per-race blobs folder and add them to that race's image list."
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
        currentImageCount={imageCount}
        returnToWorkflowUrl={returnToWorkflowUrl}
      />
    </EditorialShell>
  );
}
