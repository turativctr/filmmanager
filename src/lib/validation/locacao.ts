import { z } from "zod";

import { normalizeLocacaoNome } from "@/lib/locacao";

export const locacaoSchema = z.object({
  nome: z.string().min(1).transform(normalizeLocacaoNome),
  endereco: z.string().optional().nullable(),
  contatoNome: z.string().optional().nullable(),
  contatoTelefone: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
  hospitalNome: z.string().optional().nullable(),
  hospitalEndereco: z.string().optional().nullable(),
  hospitalTelefone: z.string().optional().nullable(),
});

export type LocacaoInput = z.infer<typeof locacaoSchema>;

export const pontoApoioSchema = z.object({
  tipo: z.enum([
    "METRO_TREM",
    "ONIBUS",
    "ESTACIONAMENTO",
    "MERCADO",
    "FARMACIA",
    "RESTAURANTE",
    "POSTO_COMBUSTIVEL",
    "OUTRO",
  ]),
  descricao: z.string().min(1),
  endereco: z.string().optional().nullable(),
});

export type PontoApoioInput = z.infer<typeof pontoApoioSchema>;

export const pontosApoioReorderSchema = z.object({
  pontoApoioIds: z.array(z.string()).min(1),
});

export const mergeLocacoesSchema = z.object({
  survivorId: z.string(),
  absorbedIds: z.array(z.string()).min(1),
});

export const moveScenesSchema = z.object({
  sceneIds: z.array(z.string()).min(1),
  targetLocacaoId: z.string(),
});
