import Link from "next/link";
import { AssetManifestEditorForm } from "@/components/asset-manifest-editor-form";
import { EditorialShell } from "@/components/editorial-shell";
import {
  saveHomepageImagesDraft,
  uploadHomepageImagesDraft,
} from "@/app/collections/actions";
import { getHomepageImagesDraft } from "@/lib/github";
import { parseAndValidateHomepageImagesYaml } from "@/lib/collections-yaml";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function HomepageCollectionsPage() {
  await requireEditorAccess({ callbackUrl: "/collections/homepage" });

  const yamlText = await getHomepageImagesDraft();
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
      description="Upload homepage-ready artwork and register image metadata for the site home page."
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link href="/collections" className="hover:text-stone-900 hover:underline underline-offset-4">
          Collections
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">Homepage</span>
      </nav>

      <AssetManifestEditorForm
        uploadAction={uploadHomepageImagesDraft}
        saveAction={saveHomepageImagesDraft}
        uploadPathPrefix="blobs/homepage"
        uploadHeading="Upload homepage images"
        uploadDescription="Upload images into blobs/homepage. Existing race assets can still be linked manually in the homepage image list when needed."
        metadataHeading="Update homepage image list"
        metadataDescription="Register one image entry at a time with its tier and tags."
        pathHelp="Homepage entries may reference any valid blobs/... path, including reused race photos."
        fileFieldLabel="Image files"
        fileAccept="image/jpeg,image/png,image/webp,image/gif"
        previewMode="image"
        defaultTier="strong"
        defaultTags="landscape, mountains"
        pathPlaceholder="blobs/homepage/banner-shot.jpg"
        currentCount={currentCount}
        loadError={loadError}
        saveButtonLabel="Save homepage image list"
        savePendingLabel="Saving…"
        uploadButtonLabel="Upload and save"
        uploadPendingLabel="Uploading…"
      />
    </EditorialShell>
  );
}