import { z } from "zod";

export const HORA_A_HORA_TIPOS = [
  "CHAMADA_EQUIPE",
  "CHAMADA_ELENCO",
  "SETUP",
  "ENSAIO",
  "RODANDO",
  "ALMOCO",
  "SAIDA",
  "DESPRODUCAO",
  "OUTRO",
] as const;

export const horaAHoraEventSchema = z.object({
  horaInicio: z.string().min(1),
  horaFim: z.string().min(1).nullable().optional(),
  descricao: z.string().min(1),
  tipo: z.enum(HORA_A_HORA_TIPOS),
});

export const horaAHoraEventUpdateSchema = z.object({
  horaInicio: z.string().min(1).optional(),
  horaFim: z.string().min(1).nullable().optional(),
  descricao: z.string().min(1).optional(),
  tipo: z.enum(HORA_A_HORA_TIPOS).optional(),
});

export const horaAHoraReorderSchema = z.object({
  eventIds: z.array(z.string()).min(1),
});
