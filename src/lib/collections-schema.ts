import { z } from "zod";
import { RACE_IMAGE_LICENSE_IDS } from "@/lib/race-image-licenses";

const blobPathSchema = z
  .string()
  .min(1, "Blob path is required.")
  .startsWith("blobs/", "Paths must start with blobs/.");

const tagSchema = z.string().min(1, "Tags cannot be empty.");

const imageAssetItemSchema = z.object({
  path: blobPathSchema,
  tier: z.string().min(1, "Tier is required."),
  tags: z.array(tagSchema).default([]),
  license: z.enum(RACE_IMAGE_LICENSE_IDS).optional(),
  copyrightConfirmed: z.boolean().optional(),
  individualsDepicted: z.boolean().optional(),
  individualsConsent: z.boolean().optional(),
});

const documentAssetItemSchema = imageAssetItemSchema.extend({
  tags: z.array(tagSchema).default([]),
  title: z.string().min(1, "Title is required."),
  description: z.string().min(1, "Description is required.").optional(),
});

const raceImageItemSchema = z.object({
  path: blobPathSchema,
  caption: z.string().max(300).optional(),
  year: z.number().int().min(1900).max(2099).optional(),
  tags: z.array(z.string().min(1).max(80)).max(10).optional(),
  license: z.enum(RACE_IMAGE_LICENSE_IDS).optional(),
});

export const homepageImagesYamlSchema = z.object({
  images: z.array(imageAssetItemSchema),
});

export const documentsManifestYamlSchema = z.object({
  documents: z.array(documentAssetItemSchema),
});

export const committeePortraitsYamlSchema = z.object({
  portraits: z.array(imageAssetItemSchema),
});

export const raceImagesYamlSchema = z.object({
  hero: z.array(raceImageItemSchema),
  gallery: z.array(raceImageItemSchema),
});

export type HomepageImagesYamlValues = z.infer<typeof homepageImagesYamlSchema>;
export type DocumentsManifestYamlValues = z.infer<typeof documentsManifestYamlSchema>;
export type CommitteePortraitsYamlValues = z.infer<typeof committeePortraitsYamlSchema>;
export type RaceImagesYamlValues = z.infer<typeof raceImagesYamlSchema>;
export type RaceImageItem = z.infer<typeof raceImageItemSchema>;

export type ImageAssetItem = z.infer<typeof imageAssetItemSchema>;
export type DocumentAssetItem = z.infer<typeof documentAssetItemSchema>;
export { blobPathSchema };
