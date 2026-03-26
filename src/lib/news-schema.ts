import { z } from "zod";

export const newsFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters.")
    .regex(/^[a-z0-9-]+$/, "Slug must contain lowercase letters, numbers, and hyphens only."),
  date: z.string().min(1, "Date is required."),
  excerpt: z.string().min(10, "Excerpt must be at least 10 characters."),
  content: z.string().min(20, "Body must be at least 20 characters."),
});

export type NewsFormValues = z.infer<typeof newsFormSchema>;
