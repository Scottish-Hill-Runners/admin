import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { RaceAssetsUploadForm } from "@/components/race-assets-upload-form";
import { requireEditorAccess } from "@/lib/route-protection";

type RaceAssetsDetailPageProps = {
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

export default async function RaceAssetsDetailPage({
  params,
  searchParams,
}: RaceAssetsDetailPageProps) {
  const { raceId } = await params;
  const rawSearch = await searchParams;
  const returnToWorkflow = toSafeReturnPath(rawSearch?.returnToWorkflow);
  const returnSuffix = returnToWorkflow
    ? `?returnToWorkflow=${encodeURIComponent(returnToWorkflow)}`
    : "";
  await requireEditorAccess({ callbackUrl: `/race-assets/${raceId}` });

  return (
    <EditorialShell
      eyebrow="Race Assets"
      title={raceId}
      description="Upload a map image and GPX route file for this race. GPX files are automatically cleaned — timestamps and personal data are stripped, and the track is smoothed using Douglas-Peucker before publishing."
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link
          href={`/race-assets${returnSuffix}`}
          className="hover:text-stone-900 hover:underline underline-offset-4"
        >
          Race Assets
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">{raceId}</span>
      </nav>

      <RaceAssetsUploadForm fixedRaceId={raceId} returnToWorkflowUrl={returnToWorkflow} />
    </EditorialShell>
  );
}
