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
import { getEditorSession } from "@/lib/auth-session";
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
  imagePath: z.string().trim().optional(),
  imagePaths: z.string().trim().optional(),
  heroImagePath: z.string().trim().optional(),
  tier: z.string().trim().optional(),
  tags: z.string().trim().optional(),
  raceSlug: z.string().trim().optional(),
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
    imagePaths?: string[];
    heroImagePath?: string[];
    tier?: string[];
    tags?: string[];
    raceSlug?: string[];
    confidence?: string[];
    source?: string[];
  };
};

function splitImagePaths(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((path) => path.trim())
    .filter((path) => path.length > 0);
}

function toUniqueImagePaths(paths: string[]): string[] {
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

function toDefaultSource(args: {
  name: string | null;
  email: string | null;
  login: string | null;
}): string {
  if (args.name && args.email) {
    return `${args.name} <${args.email}>`;
  }

  if (args.email) {
    return args.email;
  }

  if (args.name) {
    return args.name;
  }

  if (args.login) {
    return args.login;
  }

  return "shr-admin";
}

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
  const editorSession = await getEditorSession();
  const editorName = editorSession.session?.user?.name ?? null;

  const parsed = collectionsSectionUpdateSchema.safeParse({
    targetSection: formData.get("targetSection"),
    imagePath: formData.get("imagePath"),
    imagePaths: formData.get("imagePaths"),
    heroImagePath: formData.get("heroImagePath"),
    tier: formData.get("tier"),
    tags: formData.get("tags"),
    raceSlug: formData.get("raceSlug"),
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
  const confidence = values.confidence && values.confidence.length > 0 ? values.confidence : "high";
  const source =
    values.source && values.source.length > 0
      ? values.source
      : toDefaultSource({
          name: editorName,
          email: editorSession.email,
          login: editorSession.login,
        });

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

    const raceImagePaths = toUniqueImagePaths(
      splitImagePaths(values.imagePaths ?? "").concat(
        values.imagePath && values.imagePath.length > 0 ? [values.imagePath] : []
      )
    );

    if (raceImagePaths.length === 0) {
      return {
        status: "error",
        message: "Add one or more race image paths before submitting.",
        fieldErrors: {
          imagePaths: ["Add at least one image path for race updates."],
        },
      };
    }

    const invalidRacePaths = raceImagePaths.filter((path) => !path.startsWith("Pictures/"));
    if (invalidRacePaths.length > 0) {
      return {
        status: "error",
        message: "Race image paths must start with Pictures/.",
        fieldErrors: {
          imagePaths: invalidRacePaths.map(
            (path) => `${path}: image paths must start with Pictures/.`
          ),
        },
      };
    }

    const heroImagePath = values.heroImagePath && values.heroImagePath.length > 0
      ? values.heroImagePath
      : null;

    if (heroImagePath && !raceImagePaths.includes(heroImagePath)) {
      return {
        status: "error",
        message: "Hero image must be one of the submitted race image paths.",
        fieldErrors: {
          heroImagePath: ["Choose a hero image from the submitted race image paths."],
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

    if (heroImagePath && raceEntry.hero.length > 0) {
      return {
        status: "error",
        message: "This race already has a hero image.",
        fieldErrors: {
          heroImagePath: ["A race can only have one hero image."],
        },
      };
    }

    const duplicateRacePaths = raceImagePaths.filter(
      (path) =>
        raceEntry.hero.some((item) => item.path === path) ||
        raceEntry.gallery.some((item) => item.path === path)
    );

    if (duplicateRacePaths.length > 0) {
      return {
        status: "error",
        message: "Some submitted race images already exist for this race.",
        fieldErrors: {
          imagePaths: duplicateRacePaths.map(
            (path) => `${path}: duplicate image path for selected race.`
          ),
        },
      };
    }

    let heroCount = 0;
    let galleryCount = 0;

    for (const path of raceImagePaths) {
      const entry = {
        path,
        confidence,
        source,
      };

      if (heroImagePath && path === heroImagePath) {
        raceEntry.hero.push(entry);
        heroCount += 1;
        continue;
      }

      raceEntry.gallery.push(entry);
      galleryCount += 1;
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

    const targetSummary = `race ${values.raceSlug} (${heroCount} hero, ${galleryCount} gallery)`;

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
  } else {
    const imagePath = (values.imagePath ?? "").trim();
    if (!imagePath) {
      return {
        status: "error",
        message: "Image path is required for collection entries.",
        fieldErrors: {
          imagePath: ["Image path is required for collection entries."],
        },
      };
    }

    if (!imagePath.startsWith("Pictures/")) {
      return {
        status: "error",
        message: "Image path must start with Pictures/.",
        fieldErrors: {
          imagePath: ["Image path must start with Pictures/."],
        },
      };
    }

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

    const tags = (values.tags ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    if (tags.length === 0) {
      return {
        status: "error",
        message: "Each image must have at least one tag.",
        fieldErrors: {
          tags: ["Each image must have at least one tag."],
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
  const targetSummary = values.targetSection;

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
