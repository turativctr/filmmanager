import type { FieldChange } from "@/lib/script-diff";

export type ScheduledSceneInfo = { numero: string; shootDayId: string; numeroDia: number };

// Formato mínimo que este módulo precisa de um diff — deliberadamente mais enxuto que
// SceneDiffResult (que carrega a cena inteira em "ADICIONADA"), pra quem já tem só os dados
// persistidos de um SceneDiff (sem precisar reconstruir um FdxScene fake) também poder chamar.
export type DiffLike =
  | { tipo: "ADICIONADA"; numero: string }
  | { tipo: "REMOVIDA"; numero: string }
  | { tipo: "MODIFICADA"; numero: string; camposAlterados: Record<string, FieldChange> };

export type SchedulingImpact = {
  sceneNumero: string;
  shootDayId: string;
  numeroDia: number;
  motivo: string;
};

/** Cruza os diffs de uma nova versão do roteiro com o que já está agendado, para avisar o que
 *  precisa de atenção na diária em vez de a produção descobrir só no dia da filmagem. */
export function computeSchedulingImpacts(
  diffs: DiffLike[],
  scheduledScenes: ScheduledSceneInfo[]
): SchedulingImpact[] {
  const scheduledByNumero = new Map<string, ScheduledSceneInfo[]>();
  for (const s of scheduledScenes) {
    const list = scheduledByNumero.get(s.numero) ?? [];
    list.push(s);
    scheduledByNumero.set(s.numero, list);
  }

  const impacts: SchedulingImpact[] = [];

  for (const diff of diffs) {
    const scheduled = scheduledByNumero.get(diff.numero);
    if (!scheduled || scheduled.length === 0) continue;

    for (const sched of scheduled) {
      const base = { sceneNumero: diff.numero, shootDayId: sched.shootDayId, numeroDia: sched.numeroDia };

      if (diff.tipo === "REMOVIDA") {
        impacts.push({
          ...base,
          motivo: `Cena ${diff.numero} foi removida do roteiro (OMITIDA) mas está agendada nesta diária.`,
        });
        continue;
      }

      if (diff.tipo !== "MODIFICADA") continue;

      if (diff.camposAlterados.paginas) {
        const { antes, depois } = diff.camposAlterados.paginas;
        impacts.push({
          ...base,
          motivo: `Cena ${diff.numero} mudou de ${antes} para ${depois} páginas — pode impactar o tempo estimado da diária.`,
        });
      }
      if (diff.camposAlterados.personagens) {
        impacts.push({
          ...base,
          motivo: `Cena ${diff.numero} teve o elenco alterado — confirme quem deve ser chamado nesta diária.`,
        });
      }
      if (diff.camposAlterados.set || diff.camposAlterados.tipo || diff.camposAlterados.periodo) {
        impacts.push({
          ...base,
          motivo: `Cena ${diff.numero} mudou de locação/ambiente — revise a logística desta diária.`,
        });
      }
    }
  }

  return impacts;
}
