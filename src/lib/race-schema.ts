import { z } from "zod";

export const raceFormSchema = z.object({
  raceId: z
    .string()
    .min(2, "Race ID must be at least 2 characters.")
    .regex(/^[A-Za-z0-9-]+$/, "Race ID must contain letters, numbers, and hyphens only."),
  title: z.string().min(3, "Title must be at least 3 characters."),
  venue: z.string().min(2, "Venue is required."),
  distance: z.string().min(1, "Distance is required."),
  climb: z.string().optional(),
  maleRecord: z.string().optional(),
  femaleRecord: z.string().optional(),
  nonBinaryRecord: z.string().optional(),
  web: z.union([z.literal(""), z.string().url("Web must be a valid URL.")]),
  organiser: z.string().optional(),
  content: z.string().min(20, "Description must be at least 20 characters."),
});

export type RaceFormValues = z.infer<typeof raceFormSchema>;
