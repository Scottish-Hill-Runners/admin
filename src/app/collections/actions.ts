"use server";

import { z } from "zod";
import { contentConfig } from "@/lib/content-config";
import { buildPrAuthor, getEditorSession } from "@/lib/auth-session";
import {
  createContentPullRequest,
  createContentPullRequestWithFiles,
  getCommitteePortraitsDraft,
  getDocumentsManifestDraft,
  getHomepageImagesDraft,
  getRaceImagesDraft,
} from "@/lib/github";
import {
  parseAndValidateCommitteePortraitsYaml,
  parseAndValidateDocumentsManifestYaml,
  parseAndValidateHomepageImagesYaml,
  parseAndValidateRaceImagesYaml,
  stringifyCommitteePortraitsYaml,
  stringifyDocumentsManifestYaml,
  stringifyHomepageImagesYaml,
  stringifyRaceImagesYaml,
} from "@/lib/collections-yaml";
import { requireEditorAccess } from "@/lib/route-protection";
import { computeHashFilename, optimizeUploadedImage } from "@/lib/image-upload";
import { toSafeUploadFilename, type UploadMode } from "@/lib/upload-filename";
import { RACE_IMAGE_LICENSE_IDS } from "@/lib/race-image-licenses";
import { type RaceImageItem, type RaceImagesYamlValues } from "@/lib/collections-schema";

const MAX_UPLOAD_FILES = 20;
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const assetPathSchema = z
  .string()
  .trim()
  .min(1, "Path is required.")
  .startsWith("blobs/", "Paths must start with blobs/.");

const imageManifestEntrySchema = z.object({
  path: assetPathSchema,
  tier: z.string().trim().min(1, "Tier is required."),
  tags: z.string().trim().min(1, "Add at least one tag."),
});

const documentManifestEntrySchema = imageManifestEntrySchema.extend({
  title: z.string().trim().min(1, "Title is required."),
  description: z.string().trim().min(1, "Description is required."),
});

const raceImagesUpdateSchema = z.object({
  raceId: z.string().trim().min(1, "Race is required."),
  imagePaths: z.string().trim().optional(),
  heroImagePath: z.string().trim().optional(),
});

export type UploadAssetsState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: {
    assetFiles?: string[];
  };
};

export type AssetMetadataState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: {
    path?: string[];
    tier?: string[];
    tags?: string[];
    title?: string[];
    description?: string[];
    raceId?: string[];
    imagePaths?: string[];
    heroImagePath?: string[];
  };
};

export type RaceImagesSubmitState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: {
    imageFiles?: string[];
    raceId?: string[];
    imagesMetadata?: string[];
  };
  prUrl?: string;
  prNumber?: number;
};

type UploadOptions = {
  targetFolder: string;
  branchPrefix: string;
  contentLabel: string;
  fileLabel: string;
  mode: UploadMode;
};

function splitPaths(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((path) => path.trim())
    .filter((path) => path.length > 0);
}

function toUniquePaths(paths: string[]): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const path of paths) {
    if (seen.has(path)) {
      continue;
    }

    seen.add(path);
    unique.push(path);
  }

  return unique;
}

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function toSafeBranchSegment(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+/, "")
      .replace(/[-.]+$/, "") || "update"
  );
}

function expectPathPrefix(
  path: string,
  prefix: string,
  message: string
): { ok: true } | { ok: false; error: string } {
  if (path.startsWith(prefix)) {
    return { ok: true };
  }

  return {
    ok: false,
    error: message,
  };
}

async function uploadAssetFilesDraft(
  formData: FormData,
  options: UploadOptions
): Promise<UploadAssetsState> {
  await requireEditorAccess();

  const selectedAssetFiles = formData
    .getAll("assetFiles")
    .filter((value): value is File => value instanceof File && value.size > 0);
  const selectedImageFiles = formData
    .getAll("imageFiles")
    .filter((value): value is File => value instanceof File && value.size > 0);
  const assetFiles = selectedAssetFiles.length > 0 ? selectedAssetFiles : selectedImageFiles;

  if (assetFiles.length === 0) {
    return {
      status: "error",
      message: `Select at least one ${options.fileLabel} before submitting.`,
      fieldErrors: {
        assetFiles: [`Select one or more ${options.fileLabel} before submitting.`],
      },
    };
  }

  if (assetFiles.length > MAX_UPLOAD_FILES) {
    return {
      status: "error",
      message: `Upload up to ${MAX_UPLOAD_FILES} files per submission.`,
      fieldErrors: {
        assetFiles: [`Too many files selected (${assetFiles.length}).`],
      },
    };
  }

  const validationErrors: string[] = [];
  const safeFilenames = new Set<string>();

  for (const file of assetFiles) {
    if (options.mode === "image" && !allowedImageMimeTypes.has(file.type)) {
      validationErrors.push(`${file.name}: unsupported file type (${file.type || "unknown"}).`);
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      validationErrors.push(`${file.name}: file is larger than 10MB.`);
    }

    const safeName = toSafeUploadFilename(file.name, options.mode);
    if (!safeName) {
      validationErrors.push(
        `${file.name}: filename must include a valid extension and use safe characters.`
      );
      continue;
    }

    if (safeFilenames.has(safeName)) {
      validationErrors.push(`${file.name}: collides with another selected filename (${safeName}).`);
      continue;
    }

    safeFilenames.add(safeName);
  }

  if (validationErrors.length > 0) {
    return {
      status: "error",
      message: "Fix the upload issues and try again.",
      fieldErrors: {
        assetFiles: validationErrors,
      },
    };
  }

  try {
    const files = await Promise.all(
      assetFiles.map(async (file) => {
        if (options.mode === "image") {
          const optimized = await optimizeUploadedImage({
            file,
            maxBytes: MAX_UPLOAD_SIZE_BYTES,
            preset: "racePhoto",
          });
          const hashName = computeHashFilename(optimized.buffer, optimized.outputExtension);
          return {
            path: `${options.targetFolder}/${hashName}`,
            content: optimized.buffer.toString("base64"),
            encoding: "base64" as const,
          };
        }

        const safeName = toSafeUploadFilename(file.name, options.mode) as string;
        const bytes = Buffer.from(await file.arrayBuffer());
        return {
          path: `${options.targetFolder}/${safeName}`,
          content: bytes.toString("base64"),
          encoding: "base64" as const,
        };
      })
    );

    const editorSession = await getEditorSession();
    const author = buildPrAuthor(editorSession);
    const autoMerge = formData.get("autoMerge") === "on";
    const branchName = `shr-admin/${options.branchPrefix}-${Date.now()}`;
    const result = await createContentPullRequestWithFiles({
      title: `Upload ${options.contentLabel}`,
      files,
      commitMessage: `Upload ${options.contentLabel}`,
      prTitle: `Assets: upload ${options.contentLabel}`,
      prBody:
        `Automated asset upload created by ${author ? `${author.name} <${author.email}>` : "unknown"}.\n\n` +
        `- Content repo: ${contentConfig.repo}\n` +
        `- Files uploaded: ${files.length}\n` +
        `- Target folder: ${options.targetFolder}`,
      branchName,
      author,
      labels: autoMerge ? ["auto-merge"] : undefined,
    });

    return {
      status: "success",
      message: `Saved draft #${result.prNumber}: ${result.prUrl}`,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to save this draft.",
    };
  }
}

async function createYamlUpdatePullRequest(args: {
  path: string;
  content: string;
  branchPrefix: string;
  prTitle: string;
  commitMessage: string;
  summary: string;
  autoMerge: boolean;
}) {
  const editorSession = await getEditorSession();
  const author = buildPrAuthor(editorSession);

  return createContentPullRequest({
    title: `Update ${args.path}`,
    path: args.path,
    content: args.content,
    commitMessage: args.commitMessage,
    prTitle: args.prTitle,
    prBody:
      `Automated ${args.path} update created by ${author ? `${author.name} (${author.email})` : "unknown"}.\n\n` +
      `- Content repo: ${contentConfig.repo}\n` +
      `- Path: ${args.path}\n` +
      `- Summary: ${args.summary}`,
    branchName: `shr-admin/${args.branchPrefix}-${Date.now()}`,
    author,
    labels: args.autoMerge ? ["auto-merge"] : undefined,
  });
}

export async function uploadHomepageImagesDraft(
  _previousState: UploadAssetsState,
  formData: FormData
): Promise<UploadAssetsState> {
  return uploadAssetFilesDraft(formData, {
    targetFolder: "blobs/homepage",
    branchPrefix: "homepage-assets",
    contentLabel: "homepage images",
    fileLabel: "image files",
    mode: "image",
  });
}

export async function uploadDocumentsDraft(
  _previousState: UploadAssetsState,
  formData: FormData
): Promise<UploadAssetsState> {
  return uploadAssetFilesDraft(formData, {
    targetFolder: "blobs/documents",
    branchPrefix: "document-assets",
    contentLabel: "documents",
    fileLabel: "files",
    mode: "any",
  });
}

export async function uploadCommitteePortraitsDraft(
  _previousState: UploadAssetsState,
  formData: FormData
): Promise<UploadAssetsState> {
  return uploadAssetFilesDraft(formData, {
    targetFolder: "blobs/portraits",
    branchPrefix: "portrait-assets",
    contentLabel: "committee portraits",
    fileLabel: "image files",
    mode: "image",
  });
}

export async function uploadRaceImagesDraft(
  _previousState: UploadAssetsState,
  formData: FormData
): Promise<UploadAssetsState> {
  const raceId = String(formData.get("raceId") ?? "").trim();
  if (!raceId) {
    return {
      status: "error",
      message: "Race is required before uploading images.",
      fieldErrors: {
        assetFiles: ["Race is required before uploading images."],
      },
    };
  }

  return uploadAssetFilesDraft(formData, {
    targetFolder: `blobs/races/${raceId}`,
    branchPrefix: `race-images-${toSafeBranchSegment(raceId)}`,
    contentLabel: `${raceId} race images`,
    fileLabel: "image files",
    mode: "image",
  });
}

export async function saveHomepageImagesDraft(
  _previousState: AssetMetadataState,
  formData: FormData
): Promise<AssetMetadataState> {
  await requireEditorAccess();

  const parsed = imageManifestEntrySchema.safeParse({
    path: formData.get("path"),
    tier: formData.get("tier"),
    tags: formData.get("tags"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields before continuing.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const yamlText = await getHomepageImagesDraft();
  if (!yamlText) {
    return {
      status: "error",
      message: "Could not load the homepage image list from the content store.",
    };
  }

  const validated = parseAndValidateHomepageImagesYaml(yamlText);
  if (!validated.data) {
    return {
      status: "error",
      message: validated.error ?? "The homepage image list is not valid.",
    };
  }

  const { path, tier, tags } = parsed.data;
  const nextData = structuredClone(validated.data);
  if (nextData.images.some((item) => item.path === path)) {
    return {
      status: "error",
      message: "This path already exists in the homepage image list.",
      fieldErrors: {
        path: ["Duplicate path for homepage images."],
      },
    };
  }

  nextData.images.push({
    path,
    tier,
    tags: parseTags(tags),
  });

  const nextYamlText = stringifyHomepageImagesYaml(nextData);
  const finalValidated = parseAndValidateHomepageImagesYaml(nextYamlText);
  if (!finalValidated.data) {
    return {
      status: "error",
      message: "The requested change produced invalid homepage image list content.",
    };
  }

  try {
    const result = await createYamlUpdatePullRequest({
      path: "homepage/images.yaml",
      content: stringifyHomepageImagesYaml(finalValidated.data),
      branchPrefix: "homepage-images-yaml",
      prTitle: "Homepage images: update manifest",
      commitMessage: `Update homepage/images.yaml (${path})`,
      summary: `Added homepage image ${path}`,
      autoMerge: formData.get("autoMerge") === "on",
    });

    return {
      status: "success",
      message: `Saved draft #${result.prNumber}: ${result.prUrl}`,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to save this draft.",
    };
  }
}

export async function saveDocumentsManifestDraft(
  _previousState: AssetMetadataState,
  formData: FormData
): Promise<AssetMetadataState> {
  await requireEditorAccess();

  const parsed = documentManifestEntrySchema.safeParse({
    path: formData.get("path"),
    tier: formData.get("tier"),
    tags: formData.get("tags"),
    title: formData.get("title"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields before continuing.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const prefixCheck = expectPathPrefix(
    parsed.data.path,
    "blobs/documents/",
    "Document paths must start with blobs/documents/."
  );
  if (!prefixCheck.ok) {
    return {
      status: "error",
      message: prefixCheck.error,
      fieldErrors: {
        path: [prefixCheck.error],
      },
    };
  }

  const yamlText = await getDocumentsManifestDraft();
  if (!yamlText) {
    return {
      status: "error",
      message: "Could not load the document list from the content store.",
    };
  }

  const validated = parseAndValidateDocumentsManifestYaml(yamlText);
  if (!validated.data) {
    return {
      status: "error",
      message: validated.error ?? "The document list is not valid.",
    };
  }

  const { path, tier, tags, title, description } = parsed.data;
  const nextData = structuredClone(validated.data);
  if (nextData.documents.some((item) => item.path === path)) {
    return {
      status: "error",
      message: "This path already exists in the document list.",
      fieldErrors: {
        path: ["Duplicate path for document manifest."],
      },
    };
  }

  nextData.documents.push({
    path,
    tier,
    tags: parseTags(tags),
    title,
    description,
  });

  const nextYamlText = stringifyDocumentsManifestYaml(nextData);
  const finalValidated = parseAndValidateDocumentsManifestYaml(nextYamlText);
  if (!finalValidated.data) {
    return {
      status: "error",
      message: "The requested change produced invalid document list content.",
    };
  }

  try {
    const result = await createYamlUpdatePullRequest({
      path: "documents/manifest.yaml",
      content: stringifyDocumentsManifestYaml(finalValidated.data),
      branchPrefix: "documents-manifest",
      prTitle: "Documents: update manifest",
      commitMessage: `Update documents/manifest.yaml (${path})`,
      summary: `Added document ${path}`,
      autoMerge: formData.get("autoMerge") === "on",
    });

    return {
      status: "success",
      message: `Saved draft #${result.prNumber}: ${result.prUrl}`,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to save this draft.",
    };
  }
}

export async function saveCommitteePortraitsDraft(
  _previousState: AssetMetadataState,
  formData: FormData
): Promise<AssetMetadataState> {
  await requireEditorAccess();

  const parsed = imageManifestEntrySchema.safeParse({
    path: formData.get("path"),
    tier: formData.get("tier"),
    tags: formData.get("tags"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields before continuing.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const prefixCheck = expectPathPrefix(
    parsed.data.path,
    "blobs/portraits/",
    "Portrait paths must start with blobs/portraits/."
  );
  if (!prefixCheck.ok) {
    return {
      status: "error",
      message: prefixCheck.error,
      fieldErrors: {
        path: [prefixCheck.error],
      },
    };
  }

  const yamlText = await getCommitteePortraitsDraft();
  if (!yamlText) {
    return {
      status: "error",
      message: "Could not load the committee portrait list from the content store.",
    };
  }

  const validated = parseAndValidateCommitteePortraitsYaml(yamlText);
  if (!validated.data) {
    return {
      status: "error",
      message: validated.error ?? "The committee portrait list is not valid.",
    };
  }

  const { path, tier, tags } = parsed.data;
  const nextData = structuredClone(validated.data);
  if (nextData.portraits.some((item) => item.path === path)) {
    return {
      status: "error",
      message: "This path already exists in the committee portrait list.",
      fieldErrors: {
        path: ["Duplicate path for committee portraits."],
      },
    };
  }

  nextData.portraits.push({
    path,
    tier,
    tags: parseTags(tags),
  });

  const nextYamlText = stringifyCommitteePortraitsYaml(nextData);
  const finalValidated = parseAndValidateCommitteePortraitsYaml(nextYamlText);
  if (!finalValidated.data) {
    return {
      status: "error",
      message: "The requested change produced invalid committee portrait list content.",
    };
  }

  try {
    const result = await createYamlUpdatePullRequest({
      path: "committee/portraits.yaml",
      content: stringifyCommitteePortraitsYaml(finalValidated.data),
      branchPrefix: "committee-portraits-yaml",
      prTitle: "Committee portraits: update manifest",
      commitMessage: `Update committee/portraits.yaml (${path})`,
      summary: `Added portrait ${path}`,
      autoMerge: formData.get("autoMerge") === "on",
    });

    return {
      status: "success",
      message: `Saved draft #${result.prNumber}: ${result.prUrl}`,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to save this draft.",
    };
  }
}

export async function saveRaceImagesDraft(
  _previousState: AssetMetadataState,
  formData: FormData
): Promise<AssetMetadataState> {
  await requireEditorAccess();

  const parsed = raceImagesUpdateSchema.safeParse({
    raceId: formData.get("raceId"),
    imagePaths: formData.get("imagePaths"),
    heroImagePath: formData.get("heroImagePath"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields before continuing.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const { raceId } = parsed.data;
  const expectedPrefix = `blobs/races/${raceId}/`;
  const raceImagePaths = toUniquePaths(splitPaths(parsed.data.imagePaths ?? ""));
  if (raceImagePaths.length === 0) {
    return {
      status: "error",
      message: "Add one or more race image paths before submitting.",
      fieldErrors: {
        imagePaths: ["Add at least one image path for this race."],
      },
    };
  }

  const invalidPaths = raceImagePaths.filter((path) => !path.startsWith(expectedPrefix));
  if (invalidPaths.length > 0) {
    return {
      status: "error",
      message: `Race image paths must start with ${expectedPrefix}.`,
      fieldErrors: {
        imagePaths: invalidPaths.map(
          (path) => `${path}: race image paths must start with ${expectedPrefix}.`
        ),
      },
    };
  }

  const heroImagePath = parsed.data.heroImagePath?.trim() ? parsed.data.heroImagePath.trim() : null;
  if (heroImagePath && !raceImagePaths.includes(heroImagePath)) {
    return {
      status: "error",
      message: "Hero image must be one of the submitted race image paths.",
      fieldErrors: {
        heroImagePath: ["Choose a hero image from the submitted race image paths."],
      },
    };
  }

  const yamlText = await getRaceImagesDraft(raceId);
  const validated = yamlText
    ? parseAndValidateRaceImagesYaml(yamlText)
    : { data: { hero: [], gallery: [] } as RaceImagesYamlValues, error: null };
  if (!validated.data) {
    return {
      status: "error",
      message: validated.error ?? `The image list for ${raceId} is not valid.`,
    };
  }

  const nextData = structuredClone(validated.data);
  const existingPaths = new Set([
    ...nextData.hero.map((item) => item.path),
    ...nextData.gallery.map((item) => item.path),
  ]);
  const duplicatePaths = raceImagePaths.filter((path) => existingPaths.has(path));
  if (duplicatePaths.length > 0) {
    return {
      status: "error",
      message: "Some submitted race images already exist for this race.",
      fieldErrors: {
        imagePaths: duplicatePaths.map((path) => `${path}: duplicate image path for selected race.`),
      },
    };
  }

  for (const path of raceImagePaths) {
    const entry = { path };
    if (heroImagePath && path === heroImagePath) {
      nextData.hero.push(entry);
      continue;
    }

    nextData.gallery.push(entry);
  }

  const nextYamlText = stringifyRaceImagesYaml(nextData);
  const finalValidated = parseAndValidateRaceImagesYaml(nextYamlText);
  if (!finalValidated.data) {
    return {
      status: "error",
      message: `The requested change produced invalid image list content for ${raceId}.`,
    };
  }

  try {
    const result = await createYamlUpdatePullRequest({
      path: `races/${raceId}/images.yaml`,
      content: stringifyRaceImagesYaml(finalValidated.data),
      branchPrefix: `race-images-yaml-${toSafeBranchSegment(raceId)}`,
      prTitle: `Race images: update ${raceId}`,
      commitMessage: `Update races/${raceId}/images.yaml`,
      summary: `Added ${raceImagePaths.length} race image${raceImagePaths.length === 1 ? "" : "s"} for ${raceId}`,
      autoMerge: formData.get("autoMerge") === "on",
    });

    return {
      status: "success",
      message: `Saved draft #${result.prNumber}: ${result.prUrl}`,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to save this draft.",
    };
  }
}

const perImageMetadataSchema = z.object({
  caption: z.string().max(300).optional(),
  year: z.number().int().min(1900).max(2099).optional(),
  tags: z.array(z.string().min(1).max(80)).max(10).default([]),
  license: z.enum(RACE_IMAGE_LICENSE_IDS, {
    error: "Select a valid licence for this image.",
  }),
  copyrightConfirmed: z.boolean(),
  individualsConsent: z.boolean(),
});

export async function submitRaceImagesDraft(
  _previousState: RaceImagesSubmitState,
  formData: FormData
): Promise<RaceImagesSubmitState> {
  await requireEditorAccess();

  const raceId = String(formData.get("raceId") ?? "").trim();
  if (!raceId) {
    return {
      status: "error",
      message: "Race is required.",
      fieldErrors: { raceId: ["Race is required."] },
    };
  }

  const imageFiles = formData
    .getAll("imageFiles")
    .filter((v): v is File => v instanceof File && v.size > 0);

  if (imageFiles.length === 0) {
    return {
      status: "error",
      message: "Select at least one image before submitting.",
      fieldErrors: { imageFiles: ["Select at least one image before submitting."] },
    };
  }

  if (imageFiles.length > MAX_UPLOAD_FILES) {
    return {
      status: "error",
      message: `Upload up to ${MAX_UPLOAD_FILES} files per submission.`,
      fieldErrors: { imageFiles: [`Too many files selected (${imageFiles.length}).`] },
    };
  }

  const fileErrors: string[] = [];
  for (const file of imageFiles) {
    if (!allowedImageMimeTypes.has(file.type)) {
      fileErrors.push(`${file.name}: unsupported file type (${file.type || "unknown"}).`);
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      fileErrors.push(`${file.name}: file is larger than 10 MB.`);
    }
  }
  if (fileErrors.length > 0) {
    return {
      status: "error",
      message: "Fix the upload issues and try again.",
      fieldErrors: { imageFiles: fileErrors },
    };
  }

  const rawMetadata = String(formData.get("imagesMetadata") ?? "");
  let parsedMetadataArray: unknown;
  try {
    parsedMetadataArray = JSON.parse(rawMetadata);
  } catch {
    return {
      status: "error",
      message: "Invalid image metadata.",
      fieldErrors: { imagesMetadata: ["Invalid image metadata."] },
    };
  }

  const metadataResult = z.array(perImageMetadataSchema).safeParse(parsedMetadataArray);
  if (!metadataResult.success) {
    const issues = metadataResult.error.issues.map((i) => i.message);
    return {
      status: "error",
      message: "Please fix the highlighted fields before continuing.",
      fieldErrors: { imagesMetadata: issues },
    };
  }

  const metadataArray = metadataResult.data;
  if (metadataArray.length !== imageFiles.length) {
    return {
      status: "error",
      message: "Image metadata count does not match file count.",
      fieldErrors: { imagesMetadata: ["Image metadata count does not match file count."] },
    };
  }

  const uncheckedIndices = metadataArray
    .map((m, i) => (!m.copyrightConfirmed ? i + 1 : null))
    .filter((i): i is number => i !== null);
  if (uncheckedIndices.length > 0) {
    return {
      status: "error",
      message: "Confirm you have the rights for all images before submitting.",
      fieldErrors: {
        imagesMetadata: [
          `Copyright must be confirmed for image${uncheckedIndices.length === 1 ? "" : "s"} ${uncheckedIndices.join(", ")}.`,
        ],
      },
    };
  }

  const heroIndexRaw = String(formData.get("heroIndex") ?? "");
  const heroIndex = heroIndexRaw !== "" ? parseInt(heroIndexRaw, 10) : null;

  try {
    const processedImages = await Promise.all(
      imageFiles.map(async (file, index) => {
        const optimized = await optimizeUploadedImage({
          file,
          maxBytes: MAX_UPLOAD_SIZE_BYTES,
          preset: "racePhoto",
        });
        const filename = computeHashFilename(optimized.buffer, optimized.outputExtension);
        return {
          file,
          buffer: optimized.buffer,
          path: `blobs/races/${raceId}/${filename}`,
          metadata: metadataArray[index],
          isHero: heroIndex === index,
        };
      })
    );

    const yamlText = await getRaceImagesDraft(raceId);
    const validated = yamlText
      ? parseAndValidateRaceImagesYaml(yamlText)
      : { data: { hero: [], gallery: [] } as RaceImagesYamlValues, error: null };
    if (!validated.data) {
      return {
        status: "error",
        message: validated.error ?? `The image list for ${raceId} is not valid.`,
      };
    }

    const nextData = structuredClone(validated.data);
    const existingPaths = new Set([
      ...nextData.hero.map((item) => item.path),
      ...nextData.gallery.map((item) => item.path),
    ]);

    const duplicatePaths = processedImages
      .filter((img) => existingPaths.has(img.path))
      .map((img) => img.path);
    if (duplicatePaths.length > 0) {
      return {
        status: "error",
        message: "Some images already exist in this race's image list.",
        fieldErrors: {
          imageFiles: duplicatePaths.map((p) => `Already registered: ${p}`),
        },
      };
    }

    for (const img of processedImages) {
      const { caption, year, tags, license } = img.metadata;
      const entry: RaceImageItem = { path: img.path };
      if (caption) entry.caption = caption;
      if (year !== undefined) entry.year = year;
      if (tags.length > 0) entry.tags = tags;
      entry.license = license;

      if (img.isHero) {
        nextData.hero.push(entry);
      } else {
        nextData.gallery.push(entry);
      }
    }

    const nextYamlText = stringifyRaceImagesYaml(nextData);
    const finalValidated = parseAndValidateRaceImagesYaml(nextYamlText);
    if (!finalValidated.data) {
      return {
        status: "error",
        message: `The requested change produced invalid image list content for ${raceId}.`,
      };
    }

    const editorSession = await getEditorSession();
    const author = buildPrAuthor(editorSession);
    const autoMerge = formData.get("autoMerge") === "on";

    const consentRows = processedImages
      .map((img, i) => {
        const m = img.metadata;
        const individuals = m.individualsConsent
          ? "Depicts individuals — consent confirmed"
          : "No identifiable individuals / not applicable";
        return `| ${i + 1} | ${img.file.name} | ${m.license} | ✓ | ${individuals} |`;
      })
      .join("\n");

    const prFiles = [
      ...processedImages.map((img) => ({
        path: img.path,
        content: img.buffer.toString("base64"),
        encoding: "base64" as const,
      })),
      {
        path: `races/${raceId}/images.yaml`,
        content: Buffer.from(stringifyRaceImagesYaml(finalValidated.data)).toString("base64"),
        encoding: "base64" as const,
      },
    ];

    const branchName = `shr-admin/race-images-${toSafeBranchSegment(raceId)}-${Date.now()}`;
    const result = await createContentPullRequestWithFiles({
      title: `Race images: upload and register for ${raceId}`,
      files: prFiles,
      commitMessage: `Upload and register ${processedImages.length} race image${processedImages.length === 1 ? "" : "s"} for ${raceId}`,
      prTitle: `Race images: ${raceId} (${processedImages.length} new)`,
      prBody:
        `Race image upload by ${author ? `${author.name} <${author.email}>` : "unknown"}.\n\n` +
        `**Race:** ${raceId}\n` +
        `**Images uploaded:** ${processedImages.length}\n\n` +
        `## Rights confirmation\n\n` +
        `| # | Original filename | Licence | Copyright | Individuals |\n` +
        `|---|---|---|---|---|\n` +
        consentRows,
      branchName,
      author,
      labels: autoMerge ? ["auto-merge"] : undefined,
    });

    return {
      status: "success",
      message: `Saved draft #${result.prNumber}: ${result.prUrl}`,
      prUrl: result.prUrl,
      prNumber: result.prNumber,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Failed to save this draft.",
    };
  }
}