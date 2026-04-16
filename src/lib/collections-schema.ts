import { z } from "zod";

const picturePathSchema = z
  .string()
  .min(1, "Image path is required.")
  .startsWith("Pictures/", "Image paths must start with Pictures/.");

const collectionItemSchema = z.object({
  path: picturePathSchema,
  tier: z.string().min(1, "Tier is required."),
  tags: z.array(z.string().min(1, "Tags cannot be empty.")).default([]),
});

const collectionSchema = z.object({
  id: z.string().min(1, "Collection id is required."),
  label: z.string().min(1, "Collection label is required."),
  status: z.string().min(1, "Collection status is required."),
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
  hero: z.array(raceImageReferenceSchema),
  gallery: z.array(raceImageReferenceSchema),
});

export const collectionsYamlSchema = z.object({
  version: z.number().int(),
  collections: z.array(collectionSchema),
  raceImageConfig: z
    .object({
      status: z.string().min(1),
      defaultCollectionId: z.string().min(1),
      includeSidebarVariants: z.boolean(),
      notes: z.array(z.string().min(1)).default([]),
    })
    .passthrough(),
  raceImagesBySlug: z.record(z.string(), raceImagesBySlugEntrySchema),
});

export type CollectionsYamlValues = z.infer<typeof collectionsYamlSchema>;
