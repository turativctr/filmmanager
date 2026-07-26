import { z } from "zod";

import { fdxSceneSchema } from "@/lib/validation/fdx-import";

export const scriptDraftConfirmSchema = z.object({
  scenes: z.array(fdxSceneSchema).min(1),
  numeroDraft: z.string().optional(),
  dataDraft: z.string().optional(),
  arquivoNome: z.string().optional(),
});

export type ScriptDraftConfirmInput = z.infer<typeof scriptDraftConfirmSchema>;
