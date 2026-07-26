import type { ShotStatus, ShotTipoReset } from "@prisma/client";

export type PlanoShot = {
  id: string;
  sceneId: string;
  ordem: number;
  numero: string;
  descricao: string;
  tamanho: string | null;
  lente: string | null;
  angulo: string | null;
  movimento: string | null;
  takesPrevistos: number;
  duracaoTakeMin: number;
  tempoSetupMin: number;
  tempoTotalMin: number;
  tempoResetMin: number | null;
  tipoReset: ShotTipoReset;
  status: ShotStatus;
  scene: { id: string; numero: string };
};

/** Uma linha de ShotSchedule (planos.reordenados-globalmente-no-dia), já com `shot` populado —
 *  mesmo formato retornado por GET/POST/PATCH/reorder em .../shoot-days/[id]/shot-schedule. */
export type PlanoScheduleEntry = {
  id: string;
  shotId: string;
  shootDayId: string;
  projectId: string;
  ordem: number;
  bloco: "MANHA" | "TARDE" | null;
  tempoResetMin: number | null;
  tipoReset: ShotTipoReset;
  shot: PlanoShot;
};
