import { z } from "zod";

export const continuityNoteSchema = z.object({
  texto: z.string().min(1),
  shootDayId: z.string().optional().nullable(),
});

export type ContinuityNoteInput = z.infer<typeof continuityNoteSchema>;
