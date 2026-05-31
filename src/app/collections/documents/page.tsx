import Link from "next/link";
import { DocumentsUploadForm } from "@/components/documents-upload-form";
import { EditorialShell } from "@/components/editorial-shell";
import { getDocumentsManifestDraft, toSafeGitRef } from "@/lib/github";
import { parseAndValidateDocumentsManifestYaml } from "@/lib/collections-yaml";
import { requireEditorAccess } from "@/lib/route-protection";

type DocumentCollectionsPageProps = {
  searchParams?: Promise<{ returnToWorkflow?: string; ref?: string }>;
};

function toSafeReturnPath(value: string | undefined): string | undefined {
  const trimmed = String(value ?? "").trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return undefined;
  }

  return trimmed;
}

export default async function DocumentCollectionsPage({ searchParams }: DocumentCollectionsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const returnToWorkflowUrl = toSafeReturnPath(params?.returnToWorkflow);
  const ref = toSafeGitRef(params?.ref);

  await requireEditorAccess({
    callbackUrl: returnToWorkflowUrl
      ? `/collections/documents?returnToWorkflow=${encodeURIComponent(returnToWorkflowUrl)}`
      : "/collections/documents",
  });

  const yamlText = await getDocumentsManifestDraft({ ref });
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
      title="Document upload"
      description="Upload documents and add details for each file."
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link href="/collections" className="hover:text-stone-900 hover:underline underline-offset-4">
          Collections
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">Documents</span>
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

      <DocumentsUploadForm
        currentCount={currentCount}
        loadError={loadError}
        returnToWorkflowUrl={returnToWorkflowUrl}
      />
    </EditorialShell>
  );
}