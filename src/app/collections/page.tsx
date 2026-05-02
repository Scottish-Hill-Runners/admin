import { CollectionsEditorForm } from "@/components/collections-editor-form";
import { EditorialShell } from "@/components/editorial-shell";
import { getCollectionsYamlDraft } from "@/lib/github";
import {
  getCollectionsEditorOptions,
  parseAndValidateCollectionsYaml,
} from "@/lib/collections-yaml";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function CollectionsPage() {
  await requireEditorAccess();

  const yamlText = await getCollectionsYamlDraft();
  const fallbackCollections = [
    { value: "homepage-decorative-draft", label: "Homepage decorative draft" },
    { value: "committee-portraits-draft", label: "Committee portraits draft" },
  ];

  let collectionOptions = fallbackCollections;
  let raceOptions: Array<{ value: string; label: string }> = [];
  let loadError: string | null = null;

  if (!yamlText) {
    loadError = "Could not load collections.yaml from the content repository.";
  } else {
    const parsed = parseAndValidateCollectionsYaml(yamlText);
    if (!parsed.data) {
      loadError = "Could not parse collections.yaml. Showing limited fallback options.";
    } else {
      const options = getCollectionsEditorOptions(parsed.data);
      collectionOptions =
        options.collectionOptions.length > 0 ? options.collectionOptions : fallbackCollections;
      raceOptions = options.raceOptions;
    }
  }

  return (
    <EditorialShell
      eyebrow="Images"
      title="Upload pictures and edit collections.yaml"
      description="Upload one or more images to blobs/ and register them in collections.yaml in a validated PR workflow."
    >
      <CollectionsEditorForm
        collectionOptions={collectionOptions}
        raceOptions={raceOptions}
        loadError={loadError}
      />
    </EditorialShell>
  );
}
