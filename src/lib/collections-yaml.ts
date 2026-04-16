import { parseDocument, stringify } from "yaml";
import {
  collectionsYamlSchema,
  type CollectionsYamlValues,
} from "@/lib/collections-schema";

export function parseAndValidateCollectionsYaml(yamlText: string): {
  data?: CollectionsYamlValues;
  error?: string;
} {
  const document = parseDocument(yamlText);

  if (document.errors.length > 0) {
    return {
      error: document.errors.map((issue) => issue.message).join(" "),
    };
  }

  const parsed = document.toJS();
  const validated = collectionsYamlSchema.safeParse(parsed);
  if (!validated.success) {
    const [firstIssue] = validated.error.issues;

    return {
      error: firstIssue?.message ?? "collections.yaml is invalid.",
    };
  }

  return { data: validated.data };
}

export function stringifyCollectionsYaml(data: CollectionsYamlValues): string {
  return stringify(data, {
    lineWidth: 0,
    defaultStringType: "QUOTE_DOUBLE",
  }).trimEnd() + "\n";
}

export type CollectionsEditorOption = {
  value: string;
  label: string;
};

export function getCollectionsEditorOptions(data: CollectionsYamlValues): {
  collectionOptions: CollectionsEditorOption[];
  raceOptions: CollectionsEditorOption[];
} {
  const preferredCollectionIds = [
    "homepage-decorative-draft",
    "homepage-decorative",
    "committee-portraits-draft",
    "committee-portraits",
  ];

  const collectionMap = new Map(data.collections.map((item) => [item.id, item.label]));
  const collectionOptions = preferredCollectionIds
    .filter((collectionId) => collectionMap.has(collectionId))
    .map((collectionId) => ({
      value: collectionId,
      label: collectionMap.get(collectionId) ?? collectionId,
    }));

  const raceOptions = Object.keys(data.raceImagesBySlug)
    .sort((left, right) => left.localeCompare(right))
    .map((slug) => ({ value: slug, label: slug }));

  return {
    collectionOptions,
    raceOptions,
  };
}
