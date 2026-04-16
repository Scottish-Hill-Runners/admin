"use server";

import { z } from "zod";
import { contentConfig } from "@/lib/content-config";
import {
  createContentPullRequest,
  createContentPullRequestWithFiles,
  getCollectionsYamlDraft,
} from "@/lib/github";
import {
  parseAndValidateCollectionsYaml,
  stringifyCollectionsYaml,
} from "@/lib/collections-yaml";
import { requireEditorAccess } from "@/lib/route-protection";

const MAX_IMAGE_FILES = 20;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const allowedImageExtensions = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

const targetSectionSchema = z.enum([
  "homepage-decorative-draft",
  "homepage-decorative",
  "committee-portraits-draft",
  "committee-portraits",
  "race",
]);

const collectionsSectionUpdateSchema = z.object({
  targetSection: targetSectionSchema,
  imagePath: z
    .string()
    .trim()
    .min(1, "Image path is required.")
    .startsWith("Pictures/", "Image path must start with Pictures/."),
  tier: z.string().trim().optional(),
  tags: z.string().trim().optional(),
  raceSlug: z.string().trim().optional(),
  raceSlot: z.enum(["hero", "gallery"]).optional(),
  confidence: z.string().trim().optional(),
  source: z.string().trim().optional(),
});

export type UploadPicturesState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: {
    imageFiles?: string[];
  };
};

export type CollectionsYamlState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: {
    targetSection?: string[];
    imagePath?: string[];
    tier?: string[];
    tags?: string[];
    raceSlug?: string[];
    raceSlot?: string[];
    confidence?: string[];
    source?: string[];
  };
};

function toSafePictureFilename(originalName: string): string | null {
  const trimmed = String(originalName).trim();
  const extensionSeparator = trimmed.lastIndexOf(".");
  if (extensionSeparator <= 0 || extensionSeparator === trimmed.length - 1) {
    return null;
  }

  const rawBase = trimmed.slice(0, extensionSeparator);
  const rawExtension = trimmed.slice(extensionSeparator + 1).toLowerCase();
  if (!allowedImageExtensions.has(rawExtension)) {
    return null;
  }

  const safeBase = rawBase
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
    .replace(/[-.]+$/, "");

  if (!safeBase || safeBase === "." || safeBase === "..") {
    return null;
  }

  return `${safeBase}.${rawExtension}`;
}

export async function uploadPicturesDraft(
  _previousState: UploadPicturesState,
  formData: FormData
): Promise<UploadPicturesState> {
  await requireEditorAccess();

  const imageFiles = formData
    .getAll("imageFiles")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (imageFiles.length === 0) {
    return {
      status: "error",
      message: "Select at least one image file.",
      fieldErrors: {
        imageFiles: ["Select one or more image files before submitting."],
      },
    };
  }

  if (imageFiles.length > MAX_IMAGE_FILES) {
    return {
      status: "error",
      message: `Upload up to ${MAX_IMAGE_FILES} images per submission.`,
      fieldErrors: {
        imageFiles: [`Too many files selected (${imageFiles.length}).`],
      },
    };
  }

  const validationErrors: string[] = [];
  const safeFilenames = new Set<string>();

  for (const file of imageFiles) {
    if (!allowedImageMimeTypes.has(file.type)) {
      validationErrors.push(`${file.name}: unsupported file type (${file.type || "unknown"}).`);
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      validationErrors.push(`${file.name}: file is larger than 10MB.`);
    }

    const safeName = toSafePictureFilename(file.name);
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
        imageFiles: validationErrors,
      },
    };
  }

  try {
    const files = await Promise.all(
      imageFiles.map(async (file) => {
        const safeName = toSafePictureFilename(file.name) as string;
        const bytes = Buffer.from(await file.arrayBuffer());

        return {
          path: `Pictures/${safeName}`,
          content: bytes.toString("base64"),
          encoding: "base64" as const,
        };
      })
    );

    const branchName = `shr-admin/pictures-${Date.now()}`;
    const result = await createContentPullRequestWithFiles({
      title: `Pictures upload (${files.length} files)`,
      files,
      commitMessage: `Upload pictures (${files.length} files)`,
      prTitle: `Pictures: upload ${files.length} image${files.length === 1 ? "" : "s"}`,
      prBody:
        "Automated pictures upload created by SHR Admin.\n\n" +
        `- Content repo: ${contentConfig.repo}\n` +
        `- Files uploaded: ${files.length}\n` +
        "- Target folder: Pictures/",
      branchName,
    });

    return {
      status: "success",
      message: `Opened PR #${result.prNumber}: ${result.prUrl}`,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to create the GitHub pull request.",
    };
  }
}

export async function saveCollectionsYamlDraft(
  _previousState: CollectionsYamlState,
  formData: FormData
): Promise<CollectionsYamlState> {
  await requireEditorAccess();

  const parsed = collectionsSectionUpdateSchema.safeParse({
    targetSection: formData.get("targetSection"),
    imagePath: formData.get("imagePath"),
    tier: formData.get("tier"),
    tags: formData.get("tags"),
    raceSlug: formData.get("raceSlug"),
    raceSlot: formData.get("raceSlot"),
    confidence: formData.get("confidence"),
    source: formData.get("source"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields before continuing.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const currentYamlText = await getCollectionsYamlDraft();
  if (!currentYamlText) {
    return {
      status: "error",
      message: "Could not load collections.yaml from the content repository.",
    };
  }

  const validated = parseAndValidateCollectionsYaml(currentYamlText);

  if (!validated.data) {
    return {
      status: "error",
      message: "collections.yaml is not valid.",
      fieldErrors: {},
    };
  }

  const values = parsed.data;
  const nextData = structuredClone(validated.data);

  const imagePath = values.imagePath;
  const confidence = values.confidence && values.confidence.length > 0 ? values.confidence : "high";
  const source = values.source && values.source.length > 0 ? values.source : "filename-match";

  if (values.targetSection === "race") {
    if (!values.raceSlug) {
      return {
        status: "error",
        message: "Please select a race.",
        fieldErrors: {
          raceSlug: ["Race is required when target section is race."],
        },
      };
    }

    if (!values.raceSlot) {
      return {
        status: "error",
        message: "Please choose hero or gallery for race images.",
        fieldErrors: {
          raceSlot: ["Race slot is required when target section is race."],
        },
      };
    }

    const raceEntry = nextData.raceImagesBySlug[values.raceSlug];
    if (!raceEntry) {
      return {
        status: "error",
        message: "Selected race slug was not found in collections.yaml.",
        fieldErrors: {
          raceSlug: ["Choose a race that exists in collections.yaml."],
        },
      };
    }

    const targetList = values.raceSlot === "hero" ? raceEntry.hero : raceEntry.gallery;
    if (targetList.some((item) => item.path === imagePath)) {
      return {
        status: "error",
        message: "This image already exists for the selected race slot.",
        fieldErrors: {
          imagePath: ["Duplicate image path for selected race slot."],
        },
      };
    }

    targetList.push({
      path: imagePath,
      confidence,
      source,
    });
  } else {
    const targetCollection = nextData.collections.find(
      (collection) => collection.id === values.targetSection
    );

    if (!targetCollection) {
      return {
        status: "error",
        message: "Selected collection was not found in collections.yaml.",
        fieldErrors: {
          targetSection: ["Choose one of the available homepage or committee collections."],
        },
      };
    }

    const tier = (values.tier ?? "").trim();
    if (!tier) {
      return {
        status: "error",
        message: "Tier is required for collection image entries.",
        fieldErrors: {
          tier: ["Tier is required for homepage or committee collections."],
        },
      };
    }

    if (targetCollection.items.some((item) => item.path === imagePath)) {
      return {
        status: "error",
        message: "This image already exists in the selected collection.",
        fieldErrors: {
          imagePath: ["Duplicate image path for selected collection."],
        },
      };
    }

    const tags = (values.tags ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    targetCollection.items.push({
      path: imagePath,
      tier,
      tags,
    });
  }

  const finalValidated = parseAndValidateCollectionsYaml(
    stringifyCollectionsYaml(nextData)
  );

  if (!finalValidated.data) {
    return {
      status: "error",
      message: "The requested change produced invalid collections.yaml content.",
    };
  }

  const nextYamlText = stringifyCollectionsYaml(finalValidated.data);

  const targetSummary =
    values.targetSection === "race"
      ? `race ${values.raceSlug ?? ""} (${values.raceSlot ?? ""})`
      : values.targetSection;

  try {
    const result = await createContentPullRequest({
      title: "Update collections.yaml",
      path: "collections.yaml",
      content: nextYamlText,
      commitMessage: `Update collections.yaml (${targetSummary})`,
      prTitle: "Collections: update collections.yaml",
      prBody:
        "Automated collections.yaml update created by SHR Admin.\n\n" +
        `- Content repo: ${contentConfig.repo}\n` +
        "- Path: collections.yaml\n" +
        `- Target section: ${targetSummary}\n` +
        "- Validated sections: collections, raceImageConfig, raceImagesBySlug",
      branchName: `shr-admin/collections-yaml-${Date.now()}`,
    });

    return {
      status: "success",
      message: `Opened PR #${result.prNumber}: ${result.prUrl}`,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to create the GitHub pull request.",
    };
  }
}
