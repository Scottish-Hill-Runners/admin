import { z } from "zod";

export const resultsUploadSchema = z.object({
  raceId: z
    .string()
    .min(2, "Race ID must be at least 2 characters.")
    .regex(/^[A-Za-z0-9-]+$/, "Race ID must contain letters, numbers, and hyphens only."),
  year: z
    .string()
    .regex(/^\d{4}(?:-[A-Za-z0-9]+)?\*?$/, "Year filename must look like YYYY, YYYY-suffix, or YYYY*."),
  csvText: z.string().min(10, "Paste CSV data before saving a draft."),
});

export type ResultsUploadValues = z.infer<typeof resultsUploadSchema>;
