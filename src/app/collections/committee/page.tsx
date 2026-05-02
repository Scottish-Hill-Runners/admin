import Link from "next/link";
import { AssetManifestEditorForm } from "@/components/asset-manifest-editor-form";
import { EditorialShell } from "@/components/editorial-shell";
import {
  saveCommitteePortraitsDraft,
  uploadCommitteePortraitsDraft,
} from "@/app/collections/actions";
import { getCommitteePortraitsDraft } from "@/lib/github";
import { parseAndValidateCommitteePortraitsYaml } from "@/lib/collections-yaml";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function CommitteeCollectionsPage() {
  await requireEditorAccess({ callbackUrl: "/collections/committee" });

  const yamlText = await getCommitteePortraitsDraft();
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

      <AssetManifestEditorForm
        uploadAction={uploadCommitteePortraitsDraft}
        saveAction={saveCommitteePortraitsDraft}
        uploadPathPrefix="blobs/portraits"
        uploadHeading="Upload committee portraits"
        uploadDescription="Upload profile images into blobs/portraits."
        metadataHeading="Update committee portrait list"
        metadataDescription="Register one portrait at a time with its tier and tags."
        pathHelp="Committee portrait entries should point at blobs/portraits/... paths."
        fileFieldLabel="Image files"
        fileAccept="image/jpeg,image/png,image/webp,image/gif"
        previewMode="image"
        defaultTier="profile"
        defaultTags="portrait, committee"
        pathPlaceholder="blobs/portraits/committee-member.jpg"
        currentCount={currentCount}
        loadError={loadError}
        saveButtonLabel="Save committee portrait list"
        savePendingLabel="Saving…"
        uploadButtonLabel="Upload and save"
        uploadPendingLabel="Uploading…"
      />
    </EditorialShell>
  );
}