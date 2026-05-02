import Link from "next/link";
import { AssetManifestEditorForm } from "@/components/asset-manifest-editor-form";
import { EditorialShell } from "@/components/editorial-shell";
import {
  saveDocumentsManifestDraft,
  uploadDocumentsDraft,
} from "@/app/collections/actions";
import { getDocumentsManifestDraft } from "@/lib/github";
import { parseAndValidateDocumentsManifestYaml } from "@/lib/collections-yaml";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function DocumentCollectionsPage() {
  await requireEditorAccess({ callbackUrl: "/collections/documents" });

  const yamlText = await getDocumentsManifestDraft();
  let currentCount: number | undefined;
  let loadError: string | null = null;

  if (!yamlText) {
    loadError = "Could not load the document list from the content store.";
  } else {
    const parsed = parseAndValidateDocumentsManifestYaml(yamlText);
    if (!parsed.data) {
      loadError = parsed.error ?? "The document list has an invalid format.";
    } else {
      currentCount = parsed.data.documents.length;
    }
  }

  return (
    <EditorialShell
      eyebrow="Documents"
      title="Document manifest editor"
      description="Upload published documents and register them in the documents manifest."
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link href="/collections" className="hover:text-stone-900 hover:underline underline-offset-4">
          Collections
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">Documents</span>
      </nav>

      <AssetManifestEditorForm
        uploadAction={uploadDocumentsDraft}
        saveAction={saveDocumentsManifestDraft}
        uploadPathPrefix="blobs/documents"
        uploadHeading="Upload document files"
        uploadDescription="Upload PDFs, DOCX files, and other document assets into blobs/documents."
        metadataHeading="Update document list"
        metadataDescription="Register one document at a time with metadata for title, description, and search tags."
        pathHelp="Document entries should point at blobs/documents/... paths. Upload validation allows non-image file types."
        fileFieldLabel="Files"
        previewMode="file-list"
        defaultTier="document"
        defaultTags="document, archive"
        pathPlaceholder="blobs/documents/annual-report.pdf"
        currentCount={currentCount}
        loadError={loadError}
        showTitleField
        showDescriptionField
        saveButtonLabel="Save document list"
        savePendingLabel="Saving…"
        uploadButtonLabel="Upload and save"
        uploadPendingLabel="Uploading…"
      />
    </EditorialShell>
  );
}