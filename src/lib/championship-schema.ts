import { z } from "zod";

const yearEntrySchema = z.object({
  year: z.string().regex(/^\d{4}$/, "Year must be a 4-digit number."),
  races: z.string().min(1, "Races field cannot be empty."),
});

export const championshipFormSchema = z.object({
  championshipId: z
    .string()
    .min(1, "Championship ID is required.")
    .regex(
      /^[A-Za-z0-9-]+$/,
      "Championship ID must contain letters, numbers, and hyphens only."
    ),
  title: z.string().min(2, "Title must be at least 2 characters."),
  yearEntries: z.string().transform((raw, ctx) => {
    try {
      const parsed = JSON.parse(raw);
      const result = z.array(yearEntrySchema).safeParse(parsed);
      if (!result.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid year entries format." });
        return z.NEVER;
      }
      return result.data;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Could not parse year entries." });
      return z.NEVER;
    }
  }),
  content: z.string().min(10, "Description must be at least 10 characters."),
});

export type ChampionshipFormValues = z.infer<typeof championshipFormSchema>;
export type ChampionshipYearEntry = z.infer<typeof yearEntrySchema>;
