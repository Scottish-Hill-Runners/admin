import { parseDocument, stringify } from "yaml";
import {
  committeePortraitsYamlSchema,
  documentsManifestYamlSchema,
  homepageImagesYamlSchema,
  raceImagesYamlSchema,
  type CommitteePortraitsYamlValues,
  type DocumentsManifestYamlValues,
  type HomepageImagesYamlValues,
  type RaceImagesYamlValues,
} from "@/lib/collections-schema";

type ParseYamlResult<T> = {
  data?: T;
  error?: string;
};

function parseAndValidateYamlDocument<T>(
  yamlText: string,
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { issues: Array<{ message: string }> } } },
  invalidMessage: string
): ParseYamlResult<T> {
  const document = parseDocument(yamlText);

  if (document.errors.length > 0) {
    return {
      error: document.errors.map((issue) => issue.message).join(" "),
    };
  }

  const parsed = document.toJS();
  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    const [firstIssue] = validated.error.issues;

    return {
      error: firstIssue?.message ?? invalidMessage,
    };
  }

  return { data: validated.data };
}

function stringifyYamlDocument(data: unknown): string {
  return stringify(data, {
    lineWidth: 0,
    defaultStringType: "QUOTE_DOUBLE",
  }).trimEnd() + "\n";
}

export function parseAndValidateHomepageImagesYaml(yamlText: string): ParseYamlResult<HomepageImagesYamlValues> {
  return parseAndValidateYamlDocument(
    yamlText,
    homepageImagesYamlSchema,
    "homepage/images.yaml is invalid."
  );
}

export function stringifyHomepageImagesYaml(data: HomepageImagesYamlValues): string {
  return stringifyYamlDocument(data);
}

export function parseAndValidateDocumentsManifestYaml(yamlText: string): ParseYamlResult<DocumentsManifestYamlValues> {
  return parseAndValidateYamlDocument(
    yamlText,
    documentsManifestYamlSchema,
    "documents/manifest.yaml is invalid."
  );
}

export function stringifyDocumentsManifestYaml(data: DocumentsManifestYamlValues): string {
  return stringifyYamlDocument(data);
}

export function parseAndValidateCommitteePortraitsYaml(yamlText: string): ParseYamlResult<CommitteePortraitsYamlValues> {
  return parseAndValidateYamlDocument(
    yamlText,
    committeePortraitsYamlSchema,
    "committee/portraits.yaml is invalid."
  );
}

export function stringifyCommitteePortraitsYaml(data: CommitteePortraitsYamlValues): string {
  return stringifyYamlDocument(data);
}

export function parseAndValidateRaceImagesYaml(yamlText: string): ParseYamlResult<RaceImagesYamlValues> {
  return parseAndValidateYamlDocument(
    yamlText,
    raceImagesYamlSchema,
    "races/<raceId>/images.yaml is invalid."
  );
}

export function stringifyRaceImagesYaml(data: RaceImagesYamlValues): string {
  return stringifyYamlDocument(data);
}
