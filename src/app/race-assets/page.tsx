import { EditorialShell } from "@/components/editorial-shell";
import { RaceSearchList } from "@/components/race-search-list";
import { requireEditorAccess } from "@/lib/route-protection";
import { listRaceDrafts } from "@/lib/github";

type RaceAssetsPageProps = {
  searchParams?: Promise<{ returnToWorkflow?: string }>;
};

function toSafeReturnPath(value: string | undefined): string | undefined {
  const trimmed = String(value ?? "").trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return undefined;
  }

  return trimmed;
}

export default async function RaceAssetsPage({ searchParams }: RaceAssetsPageProps) {
  await requireEditorAccess({ callbackUrl: "/race-assets" });
  const params = await searchParams;
  const returnToWorkflow = toSafeReturnPath(params?.returnToWorkflow);
  const returnSuffix = returnToWorkflow
    ? `?returnToWorkflow=${encodeURIComponent(returnToWorkflow)}`
    : "";
  const raceItems = await listRaceDrafts();

  return (
    <EditorialShell
      eyebrow="Race Assets"
      title="Map & route upload"
      description="Select a race to upload a map image and GPX route file."
    >
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <h2 className="font-[family:var(--font-heading)] text-2xl text-stone-900">
          All races
        </h2>
        <div className="mt-5">
          <RaceSearchList
            raceItems={raceItems}
            hrefPrefix="/race-assets"
            hrefSuffix={returnSuffix}
          />
        </div>
      </section>
    </EditorialShell>
  );
}
