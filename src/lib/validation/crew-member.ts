import { z } from "zod";

export const crewMemberSchema = z.object({
  nome: z.string().min(1),
  funcao: z.string().min(1),
  departamento: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
});

export type CrewMemberInput = z.infer<typeof crewMemberSchema>;
