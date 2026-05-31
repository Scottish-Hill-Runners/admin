import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import {
  submitCommitteePortraitsDraft,
  type RaceImagesSubmitState,
} from "@/app/collections/actions";
import { SharedImageUploadForm } from "@/components/shared-image-upload-form";
import { getCommitteePortraitsDraft, toSafeGitRef } from "@/lib/github";
import { parseAndValidateCommitteePortraitsYaml } from "@/lib/collections-yaml";
import { requireEditorAccess } from "@/lib/route-protection";

const initialState: RaceImagesSubmitState = { status: "idle" };

type CommitteeCollectionsPageProps = {
  searchParams?: Promise<{ returnToWorkflow?: string; ref?: string }>;
};

function toSafeReturnPath(value: string | undefined): string | undefined {
  const trimmed = String(value ?? "").trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return undefined;
  }

  return trimmed;
}

export default async function CommitteeCollectionsPage({ searchParams }: CommitteeCollectionsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const returnToWorkflowUrl = toSafeReturnPath(params?.returnToWorkflow);
  const ref = toSafeGitRef(params?.ref);

  await requireEditorAccess({
    callbackUrl: returnToWorkflowUrl
      ? `/collections/committee?returnToWorkflow=${encodeURIComponent(returnToWorkflowUrl)}`
      : "/collections/committee",
  });

  const yamlText = await getCommitteePortraitsDraft({ ref });
  let currentCount: number | undefined;
  let loadError: string | null = null;

  if (!yamlText) {
    loadError = "Could not load the committee portrait list from the content store.";
  } else {
    const parsed = parseAndValidateCommitteePortraitsYaml(yamlText);
    if (!parsed.data) {
      loadError = parsed.error ?? "The committee portrait list has an invalid format.";
    } else {
      currentCount = parsed.data.portraits.length;
    }
  }

  return (
    <EditorialShell
      eyebrow="Committee"
      title="Committee portrait editor"
      description="Upload and register committee profile images for the site."
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link href="/collections" className="hover:text-stone-900 hover:underline underline-offset-4">
          Collections
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">Committee</span>
      </nav>

      {returnToWorkflowUrl ? (
        <div className="mt-4">
          <Link
            href={returnToWorkflowUrl}
            className="inline-flex items-center rounded-full border border-stone-900/15 bg-white px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
          >
            Back to workflow
          </Link>
        </div>
      ) : null}

      {loadError ? (
        <p className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-900/20 px-4 py-3 text-sm text-amber-200">
          {loadError}
        </p>
      ) : null}

      <SharedImageUploadForm
        action={submitCommitteePortraitsDraft}
        initialState={initialState}
        returnToWorkflowUrl={returnToWorkflowUrl}
        currentImageCount={currentCount}
        uploadHeading="Upload committee portraits"
        uploadDescription="Select profile images for committee portraits. Paths are generated automatically in blobs/portraits."
        includeCaptionYear={false}
        showHeroOption={false}
        assumedIndividualsDepicted={true}
        allowIndividualsDepictedToggle={false}
        canSubmit={!loadError}
      />
    </EditorialShell>
  );
}