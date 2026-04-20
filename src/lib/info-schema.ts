import { z } from "zod";

export const infoFormSchema = z.object({
  filePath: z
    .string()
    .trim()
    .regex(
      /^(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*[a-z0-9]+(?:-[a-z0-9]+)*\.md$/,
      "File path must use lowercase slash-separated segments and end with .md (for example: handbook/index.md)."
    ),
  content: z.string().min(10, "Content must be at least 10 characters."),
});

export type InfoFormValues = z.infer<typeof infoFormSchema>;
