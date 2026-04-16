import { z } from "zod";

export const calendarSchema = z.object({
  csvText: z
    .string()
    .transform((value) => value.replace(/\r\n?/g, "\n"))
    .refine((value) => value.trim().length > 0, {
      message: "Calendar CSV cannot be empty.",
    }),
});

export type CalendarValues = z.infer<typeof calendarSchema>;
