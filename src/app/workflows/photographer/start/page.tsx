import { redirect } from "next/navigation";
import { requireEditorAccess } from "@/lib/route-protection";

type PhotographerStartPageProps = {
  searchParams: Promise<{ raceId?: string; returnToWorkflow?: string; target?: string }>;
};

function toSafeReturnPath(value: string | undefined): string | undefined {
  const trimmed = String(value ?? "").trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return undefined;
  }

  return trimmed;
}

export default async function PhotographerStartPage({ searchParams }: PhotographerStartPageProps) {
  await requireEditorAccess({ callbackUrl: "/workflows/photographer" });
  const params = await searchParams;
  const raceId = String(params.raceId ?? "").trim();
  const target = params.target === "race" ? "race" : "collection";
  const returnToWorkflow =
    toSafeReturnPath(params.returnToWorkflow) ?? `/workflows/photographer?step=4&target=${target}`;

  if (!raceId) {
    redirect(`/workflows/photographer?step=2&target=race`);
  }

  redirect(
    `/races/${encodeURIComponent(raceId)}/images?returnToWorkflow=${encodeURIComponent(returnToWorkflow)}`
  );
}