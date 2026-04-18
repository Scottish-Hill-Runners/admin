import { z } from "zod";

export const longDistanceFormSchema = z.object({
  slug: z
    .string()
    .min(1, "Slug is required.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase letters, numbers, and hyphens only (e.g. 'charlie-ramsays-round')."
    ),
  title: z.string().min(2, "Title must be at least 2 characters."),
  content: z.string().min(10, "Report body must be at least 10 characters."),
});

export type LongDistanceFormValues = z.infer<typeof longDistanceFormSchema>;
