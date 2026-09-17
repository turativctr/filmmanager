import { z } from "zod";

// A soma dos oitavos contra a cena não é checada aqui (depende do banco) — ver validarDivisao em
// src/lib/scene-parts-shared.ts, chamada pela rota.
export const sceneDivisionSchema = z.object({
  partes: z
    .array(
      z.object({
        // Presente = parte já existente (mantém diária e planos atribuídos); ausente = parte nova.
        id: z.string().min(1).optional(),
        // Até 30: o rótulo vai junto do número da cena nas colunas da OD e dos PDFs ("19 · Voice off").
        rotulo: z.string().trim().min(1).max(30),
        oitavos: z.number().int().min(0),
      })
    )
    .min(2),
});

export type SceneDivisionInput = z.infer<typeof sceneDivisionSchema>;
