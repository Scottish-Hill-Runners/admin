import { z } from "zod";

export const newsFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format."),
  slugSuffix: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]*$/, "Suffix must contain lowercase letters, numbers, and hyphens only."),
  excerpt: z.string().min(10, "Excerpt must be at least 10 characters."),
  content: z.string().min(20, "Body must be at least 20 characters."),
});

export type NewsFormValues = z.infer<typeof newsFormSchema>;
