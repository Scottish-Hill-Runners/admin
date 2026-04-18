import { z } from "zod";

export const clubFormSchema = z.object({
  clubId: z
    .string()
    .min(1, "Club ID is required.")
    .regex(
      /^[A-Za-z0-9]+$/,
      "Club ID must contain letters and numbers only (no spaces or hyphens)."
    ),
  name: z.string().min(2, "Club name must be at least 2 characters."),
  aka: z.string().optional(),
  web: z.union([z.literal(""), z.url("Website must be a valid URL.")]),
  content: z.string().min(10, "Description must be at least 10 characters."),
});

export type ClubFormValues = z.infer<typeof clubFormSchema>;
