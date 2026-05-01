import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { RaceAssetsUploadForm } from "@/components/race-assets-upload-form";
import { requireEditorAccess } from "@/lib/route-protection";

type RaceAssetsDetailPageProps = {
  params: Promise<{ raceId: string }>;
};

export default async function RaceAssetsDetailPage({
  params,
}: RaceAssetsDetailPageProps) {
  const { raceId } = await params;
  await requireEditorAccess({ callbackUrl: `/race-assets/${raceId}` });

  return (
    <EditorialShell
      eyebrow="Race Assets"
      title={raceId}
      description="Upload a map image and GPX route file for this race. GPX files are automatically cleaned — timestamps and personal data are stripped, and the track is smoothed using Douglas-Peucker before publishing."
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link
          href="/race-assets"
          className="hover:text-stone-900 hover:underline underline-offset-4"
        >
          Race Assets
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">{raceId}</span>
      </nav>

      <RaceAssetsUploadForm fixedRaceId={raceId} />
    </EditorialShell>
  );
}
