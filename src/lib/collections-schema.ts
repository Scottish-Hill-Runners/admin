import { z } from "zod";

const blobPathSchema = z
  .string()
  .min(1, "Blob path is required.")
  .startsWith("blobs/", "Paths must start with blobs/.");

const tagSchema = z.string().min(1, "Tags cannot be empty.");

const imageAssetItemSchema = z.object({
  path: blobPathSchema,
  tier: z.string().min(1, "Tier is required."),
  tags: z.array(tagSchema).min(1, "At least one tag is required."),
});

const documentAssetItemSchema = z.object({
  path: blobPathSchema,
  tier: z.string().min(1, "Tier is required."),
  tags: z.array(tagSchema).min(1, "At least one tag is required."),
  title: z.string().min(1, "Title is required."),
  description: z.string().min(1, "Description is required."),
});

const raceImageItemSchema = z.object({
  path: blobPathSchema,
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
  hero: z.array(raceImageItemSchema).max(1, "A race can only have one hero image."),
  gallery: z.array(raceImageItemSchema),
});

export type HomepageImagesYamlValues = z.infer<typeof homepageImagesYamlSchema>;
export type DocumentsManifestYamlValues = z.infer<typeof documentsManifestYamlSchema>;
export type CommitteePortraitsYamlValues = z.infer<typeof committeePortraitsYamlSchema>;
export type RaceImagesYamlValues = z.infer<typeof raceImagesYamlSchema>;

export type ImageAssetItem = z.infer<typeof imageAssetItemSchema>;
export type DocumentAssetItem = z.infer<typeof documentAssetItemSchema>;
export { blobPathSchema };
