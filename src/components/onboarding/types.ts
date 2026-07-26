import type { FdxScene } from "@/lib/fdx-parser";

export type ProjectFormState = {
  titulo: string;
  diretor: string;
  producao: string;
  dataInicio: string;
  dataFim: string;
  roteiristas: string;
  numeroDraft: string;
  dataDraft: string;
  contatoProducao: string;
};

export const EMPTY_PROJECT_FORM: ProjectFormState = {
  titulo: "",
  diretor: "",
  producao: "",
  dataInicio: "",
  dataFim: "",
  roteiristas: "",
  numeroDraft: "",
  dataDraft: "",
  contatoProducao: "",
};

export type PreviewScene = FdxScene & { selected: boolean };
