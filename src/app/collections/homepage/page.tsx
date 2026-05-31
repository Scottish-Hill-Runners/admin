import Link from "next/link";
import {
  uploadHomepageImagesDraft,
  type RaceImagesSubmitState,
} from "@/app/collections/actions";
import { EditorialShell } from "@/components/editorial-shell";
import { SharedImageUploadForm } from "@/components/shared-image-upload-form";
import { getHomepageImagesDraft, toSafeGitRef } from "@/lib/github";
import { parseAndValidateHomepageImagesYaml } from "@/lib/collections-yaml";
import { requireEditorAccess } from "@/lib/route-protection";

const initialState: RaceImagesSubmitState = { status: "idle" };

type HomepageCollectionsPageProps = {
  searchParams?: Promise<{ returnToWorkflow?: string; ref?: string }>;
};

function toSafeReturnPath(value: string | undefined): string | undefined {
  const trimmed = String(value ?? "").trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return undefined;
  }

  return trimmed;
}

export default async function HomepageCollectionsPage({ searchParams }: HomepageCollectionsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const returnToWorkflowUrl = toSafeReturnPath(params?.returnToWorkflow);
  const ref = toSafeGitRef(params?.ref);

  await requireEditorAccess({
    callbackUrl: returnToWorkflowUrl
      ? `/collections/homepage?returnToWorkflow=${encodeURIComponent(returnToWorkflowUrl)}`
      : "/collections/homepage",
  });

  const yamlText = await getHomepageImagesDraft({ ref });
  let currentCount: number | undefined;
  let loadError: string | null = null;

  if (!yamlText) {
    loadError = "Could not load the homepage image list from the content store.";
  } else {
    const parsed = parseAndValidateHomepageImagesYaml(yamlText);
    if (!parsed.data) {
      loadError = parsed.error ?? "The homepage image list has an invalid format.";
    } else {
      currentCount = parsed.data.images.length;
    }
  }

  return (
    <EditorialShell
      eyebrow="Homepage"
      title="Homepage image editor"
      description="Upload homepage-ready artwork and add tags for each image."
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link href="/collections" className="hover:text-stone-900 hover:underline underline-offset-4">
          Collections
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">Homepage</span>
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
        action={uploadHomepageImagesDraft}
        initialState={initialState}
        returnToWorkflowUrl={returnToWorkflowUrl}
        currentImageCount={currentCount}
        uploadHeading="Upload homepage images"
        uploadDescription="Select up to 20 images for homepage display. Paths are generated automatically in blobs/homepage."
        includeCaptionYear={false}
        showHeroOption={false}
        allowIndividualsDepictedToggle
        canSubmit={!loadError}
        cannotSubmitMessage={loadError ?? undefined}
      />
    </EditorialShell>
  );
}