import { redirect } from "next/navigation";
import { requireEditorAccess } from "@/lib/route-protection";

type RunnerStartPageProps = {
  searchParams: Promise<{ raceId?: string; year?: string; returnToWorkflow?: string; mode?: string }>;
};

function toSafeReturnPath(value: string | undefined): string | undefined {
  const trimmed = String(value ?? "").trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return undefined;
  }

  return trimmed;
}

export default async function RunnerStartPage({ searchParams }: RunnerStartPageProps) {
  await requireEditorAccess({ callbackUrl: "/workflows/runner" });
  const params = await searchParams;
  const raceId = String(params.raceId ?? "").trim();
  const year = String(params.year ?? "").trim();
  const mode = params.mode === "find" ? "find" : "known";
  const returnToWorkflow =
    toSafeReturnPath(params.returnToWorkflow) ?? `/workflows/runner?step=4&mode=${mode}`;

  if (!raceId || !year) {
    redirect("/workflows/runner");
  }

  redirect(
    `/results/${encodeURIComponent(raceId)}/${encodeURIComponent(year)}?returnToWorkflow=${encodeURIComponent(returnToWorkflow)}`
  );
}