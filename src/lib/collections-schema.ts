import { z } from "zod";

const picturePathSchema = z
  .string()
  .min(1, "Image path is required.")
  .startsWith("blobs/", "Image paths must start with blobs/.");

const collectionItemSchema = z.object({
  path: picturePathSchema,
  tier: z.string().min(1, "Tier is required."),
  tags: z.array(z.string().min(1, "Tags cannot be empty.")).min(1, "At least one tag is required."),
});

const collectionSchema = z.object({
  id: z.string().min(1, "Collection id is required."),
  label: z.string().min(1, "Collection label is required."),
  usage: z.array(z.string().min(1)).default([]),
  doNotUseFor: z.array(z.string().min(1)).default([]),
  items: z.array(collectionItemSchema),
});

const raceImageReferenceSchema = z.object({
  path: picturePathSchema,
  confidence: z.string().min(1, "Confidence is required."),
  source: z.string().min(1, "Source is required."),
});

const raceImagesBySlugEntrySchema = z.object({
  hero: z.array(raceImageReferenceSchema).max(1, "A race can only have one hero image."),
  gallery: z.array(raceImageReferenceSchema),
});

export const collectionsYamlSchema = z.object({
  version: z.number().int(),
  collections: z.array(collectionSchema),
  raceImageConfig: z
    .object({
      defaultCollectionId: z.string().min(1),
      includeSidebarVariants: z.boolean(),
      notes: z.array(z.string().min(1)).default([]),
    })
    .catchall(z.any()),
  raceImagesBySlug: z.record(z.string(), raceImagesBySlugEntrySchema),
});

export type CollectionsYamlValues = z.infer<typeof collectionsYamlSchema>;
