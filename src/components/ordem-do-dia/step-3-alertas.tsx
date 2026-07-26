"use client";

import { AlertTriangle, Info, ListChecks } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { formatPortugueseList, formatSceneList } from "@/lib/ordem-do-dia";
import { RESET_LABEL } from "@/lib/shots-shared";
import { cn } from "@/lib/utils";

import type { Passo3Data } from "./types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-sm font-semibold">{title}</h4>
      {children}
    </div>
  );
}

export function Step3Alertas({
  data,
  projectId,
  shootDayId,
}: {
  data: Passo3Data;
  projectId: string;
  shootDayId: string;
}) {
  const allEmpty =
    data.habilidades.length === 0 &&
    data.figurino.length === 0 &&
    data.quickChanges.length === 0 &&
    data.make.length === 0 &&
    data.objetosCriticos.length === 0 &&
    data.comidaCena.length === 0 &&
    data.objetosNormais.length === 0 &&
    data.notes.length === 0 &&
    data.continuidadeAlerts.length === 0 &&
    data.resumptionAlerts.length === 0 &&
    data.pendingGapAlerts.length === 0 &&
    data.observacoesPorCena.length === 0 &&
    data.posProducao.length === 0 &&
    data.trilha.length === 0 &&
    data.microfones.length === 0;

  if (allEmpty) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Nenhum alerta encontrado"
        description="Os breakdowns das cenas deste dia ainda não têm figurino, make, props ou habilidades preenchidos."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${projectId}/shootdays/${shootDayId}`}>Ir para as cenas do dia</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      {data.habilidades.length > 0 && (
        <Section title="Habilidades exigidas do elenco">
          <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
            {data.habilidades.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p className="text-xs">Confirmar com o elenco antes do dia de filmagem.</p>
          </div>
        </Section>
      )}

      {(data.figurino.length > 0 || data.quickChanges.length > 0) && (
        <Section title="Figurino do dia por personagem">
          {data.figurino.length > 0 && (
            <div className="space-y-1 text-sm">
              {data.figurino.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          )}
          {data.quickChanges.length > 0 && (
            <div className="space-y-1 rounded-md border border-destructive bg-destructive/10 p-2 text-sm text-destructive">
              {data.quickChanges.map((c) => (
                <p key={`${c.idCurto}-${c.fromScene}-${c.toScene}`} className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {c.idCurto}: troca de figurino entre cenas {c.fromScene}→{c.toScene} em apenas {c.gapMin} min
                  ({c.fromFigurino} → {c.toFigurino}). Figurino precisa preparar troca rápida.
                </p>
              ))}
            </div>
          )}
        </Section>
      )}

      {data.make.length > 0 && (
        <Section title="Make e efeitos especiais">
          <div className="space-y-1 text-sm">
            {data.make.map((m) => (
              <p
                key={`${m.idCurto}-${m.descricao}`}
                className={cn(m.especial && "font-medium text-destructive")}
              >
                {m.idCurto}: {m.descricao} ({m.sceneLabel})
                {m.especial && " — efeito especial, requer mais tempo de make"}
              </p>
            ))}
          </div>
        </Section>
      )}

      {(data.objetosCriticos.length > 0 || data.comidaCena.length > 0 || data.objetosNormais.length > 0) && (
        <Section title="Objetos e props críticos">
          {(data.objetosCriticos.length > 0 || data.comidaCena.length > 0) && (
            <div className="space-y-1">
              {data.objetosCriticos.map((o, i) => (
                <p
                  key={`${o.texto}-${i}`}
                  className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-sm text-amber-900"
                >
                  Cena {o.sceneNumero}: {o.texto}
                </p>
              ))}
              {data.comidaCena.map((c, i) => (
                <p
                  key={`${c.texto}-${i}`}
                  className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-sm text-amber-900"
                >
                  Comida de cena — Cena {c.sceneNumero}: {c.texto}
                </p>
              ))}
            </div>
          )}
          {data.objetosNormais.length > 0 && (
            <div className="space-y-0.5 text-sm text-muted-foreground">
              {data.objetosNormais.map((o, i) => (
                <p key={`${o.texto}-${i}`}>
                  Cena {o.sceneNumero}: {o.texto}
                </p>
              ))}
            </div>
          )}
        </Section>
      )}

      {data.notes.length > 0 && (
        <Section title="Notas consolidadas por departamento">
          <div className="space-y-1 text-sm">
            {data.notes.map((n, i) => (
              <p key={`${n.departamento}-${i}`}>
                <span className="font-semibold uppercase">{n.departamento}:</span>{" "}
                {formatSceneList(n.scenes)} — {n.texto}
              </p>
            ))}
          </div>
        </Section>
      )}

      {data.continuidadeAlerts.length > 0 && (
        <Section title="Atenção à continuidade">
          <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
            {data.continuidadeAlerts.map((a, i) => (
              <p key={`${a.sceneNumero}-${a.fromShotNumero}-${a.toShotNumero}-${i}`}>
                Cena {a.sceneNumero} · entre planos {a.fromShotNumero}→{a.toShotNumero}:{" "}
                {RESET_LABEL[a.tipoReset].toLowerCase()} — verificar continuidade
              </p>
            ))}
          </div>
        </Section>
      )}

      {(data.resumptionAlerts.length > 0 || data.pendingGapAlerts.length > 0) && (
        <Section title="Retomadas de cena">
          <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
            {data.resumptionAlerts.map((a) => (
              <div key={a.sceneId} className="space-y-0.5">
                <p>
                  Cena {a.sceneNumero} é filmada em {a.segments} momentos diferentes — verificar continuidade
                </p>
                {a.transitions.map((t, i) => (
                  <p key={`${a.sceneId}-${t.fromShotNumero}-${t.toShotNumero}-${i}`}>
                    Atenção: voltando à Cena {t.toSceneNumero} após intervalo — verificar continuidade
                  </p>
                ))}
              </div>
            ))}
            {data.pendingGapAlerts.map((g) => (
              <p key={g.sceneId}>
                C{g.sceneNumero}·P{g.filmedShotNumero} filmado —{" "}
                {formatPortugueseList(g.pendingShotNumeros.map((n) => `C${g.sceneNumero}·P${n}`))} ainda
                pendentes
              </p>
            ))}
          </div>
        </Section>
      )}

      {data.observacoesPorCena.length > 0 && (
        <Section title="Observações do dia">
          <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
            {data.observacoesPorCena.map((o, i) => (
              <p key={`${o.sceneNumero}-${i}`}>
                Cena {o.sceneNumero}: {o.texto}
              </p>
            ))}
          </div>
        </Section>
      )}

      {data.posProducao.length > 0 && (
        <Section title="Pós-produção">
          <div className="flex items-start gap-1.5 rounded-md border border-blue-200 bg-blue-50 p-2 text-sm text-blue-900">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>{data.posProducao.map((p) => `Cena ${p.sceneNumero}: ${p.texto}`).join(" · ")}</p>
          </div>
        </Section>
      )}

      {(data.trilha.length > 0 || data.microfones.length > 0) && (
        <Section title="Trilhas necessárias no set (playback)">
          {data.trilha.length > 0 && (
            <p className="text-sm">{data.trilha.map((t) => `Cena ${t.sceneNumero}: ${t.texto}`).join(" · ")}</p>
          )}
          {data.microfones.length > 0 && (
            <p className="text-sm text-muted-foreground">Microfones: {data.microfones.join(", ")}</p>
          )}
        </Section>
      )}
    </div>
  );
}
