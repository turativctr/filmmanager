"use client";

import { ClipboardCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  compararLinha,
  faixaHoraria,
  fraseComparacao,
  fraseTotalDoDia,
  parseHoraDigitada,
  totalDoDia,
  type LinhaComparada,
} from "@/lib/realizado";
import { cn } from "@/lib/utils";

/** Uma linha da diária pra lançar: cena (ou parte) ou bloco de tempo. O previsto vem calculado do
 *  servidor — esta tela nunca escreve nele. */
export type LinhaRealizado = {
  /** Chave da linha na tela; pra cena é `${sceneId}:${scenePartId ?? ""}`. */
  chave: string;
  tipo: "CENA" | "BLOCO";
  sceneId?: string;
  scenePartId?: string | null;
  blocoId?: string;
  /** "18 · CAMPO", "19 · Voice off", "Transporte". */
  rotulo: string;
  previstoInicio: string | null;
  previstoFim: string | null;
  previstoMin: number | null;
  horaInicioReal: string | null;
  horaFimReal: string | null;
  naoRealizada: boolean;
};

type Draft = { inicio: string; fim: string; naoRealizada: boolean };

const draftInicial = (l: LinhaRealizado): Draft => ({
  inicio: l.horaInicioReal ?? "",
  fim: l.horaFimReal ?? "",
  naoRealizada: l.naoRealizada,
});

export function LancarRealizadoDialog({
  projectId,
  shootDayId,
  numeroDia,
  data,
  linhas,
}: {
  projectId: string;
  shootDayId: string;
  numeroDia: number;
  data: string;
  linhas: LinhaRealizado[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(linhas.map((l) => [l.chave, draftInicial(l)]))
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const assinatura = JSON.stringify(linhas);
  useEffect(() => {
    setDrafts(Object.fromEntries(linhas.map((l) => [l.chave, draftInicial(l)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura]);

  // Comparação ao vivo do que está digitado — o retorno é o que faz valer a pena lançar.
  const comparadas = useMemo<LinhaComparada[]>(
    () =>
      linhas.map((l) => {
        const d = drafts[l.chave] ?? draftInicial(l);
        const inicio = parseHoraDigitada(d.inicio);
        const fim = parseHoraDigitada(d.fim);
        return compararLinha({
          rotulo: l.rotulo,
          previstoMin: l.previstoMin,
          horaInicioReal: inicio === undefined ? l.horaInicioReal : inicio,
          horaFimReal: fim === undefined ? l.horaFimReal : fim,
          naoRealizada: d.naoRealizada,
        });
      }),
    [linhas, drafts]
  );
  const total = totalDoDia(comparadas);

  async function salvar() {
    const invalida = linhas.find((l) => {
      const d = drafts[l.chave];
      return d && (parseHoraDigitada(d.inicio) === undefined || parseHoraDigitada(d.fim) === undefined);
    });
    if (invalida) {
      setErro(`${invalida.rotulo}: hora em formato não reconhecido. Use 11:00, 1100 ou 11h00.`);
      return;
    }
    setSalvando(true);
    setErro(null);
    const res = await fetch(`/api/projects/${projectId}/shoot-days/${shootDayId}/realizado`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        linhas: linhas.map((l) => {
          const d = drafts[l.chave] ?? draftInicial(l);
          const horaInicioReal = (parseHoraDigitada(d.inicio) ?? null) as string | null;
          const horaFimReal = (parseHoraDigitada(d.fim) ?? null) as string | null;
          return l.tipo === "CENA"
            ? {
                tipo: "CENA",
                sceneId: l.sceneId,
                scenePartId: l.scenePartId ?? null,
                horaInicioReal,
                horaFimReal,
                naoRealizada: d.naoRealizada,
              }
            : { tipo: "BLOCO", blocoId: l.blocoId, horaInicioReal, horaFimReal };
        }),
      }),
    });
    setSalvando(false);
    if (!res.ok) {
      setErro("Não foi possível salvar o lançamento.");
      return;
    }
    setSalvo(true);
    router.refresh();
  }

  const campo = "w-20 rounded border bg-background px-1.5 py-0.5 text-sm tabular-nums";

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (!v) setSalvo(false);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <ClipboardCheck className="h-4 w-4" />
          Lançar realizado
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Diária {numeroDia} · {new Date(data).toLocaleDateString("pt-BR", { timeZone: "UTC" })} · lançar realizado
          </DialogTitle>
          <DialogDescription>
            O que de fato aconteceu, das suas anotações. Campo em branco fica em branco — nada é preenchido com o
            previsto. Lançar de novo corrige.
          </DialogDescription>
        </DialogHeader>

        {linhas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Esta diária não tem cenas nem blocos de tempo.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1 font-medium">Cena</th>
                <th className="py-1 font-medium">Previsto</th>
                <th className="py-1 font-medium">Realizado</th>
                <th className="py-1 font-medium">Desvio</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => {
                const d = drafts[l.chave] ?? draftInicial(l);
                const c = comparadas[i];
                const invalido = (t: string) => t.trim() !== "" && parseHoraDigitada(t) === undefined;
                return (
                  <tr key={l.chave} className="border-b last:border-b-0" data-linha-realizado={l.chave}>
                    <td className="py-1.5 pr-2">
                      <span className={cn(l.tipo === "BLOCO" && "text-muted-foreground")}>{l.rotulo}</span>
                    </td>
                    <td className="py-1.5 pr-2 tabular-nums text-muted-foreground">
                      {faixaHoraria(l.previstoInicio, l.previstoFim)}
                    </td>
                    <td className="py-1.5 pr-2">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <input
                          aria-label={`Início realizado de ${l.rotulo}`}
                          className={cn(campo, invalido(d.inicio) && "border-destructive")}
                          placeholder="—"
                          value={d.inicio}
                          disabled={d.naoRealizada}
                          onChange={(e) =>
                            setDrafts((p) => ({ ...p, [l.chave]: { ...d, inicio: e.target.value } }))
                          }
                        />
                        <input
                          aria-label={`Fim realizado de ${l.rotulo}`}
                          className={cn(campo, invalido(d.fim) && "border-destructive")}
                          placeholder="—"
                          value={d.fim}
                          disabled={d.naoRealizada}
                          onChange={(e) => setDrafts((p) => ({ ...p, [l.chave]: { ...d, fim: e.target.value } }))}
                        />
                        {l.tipo === "CENA" && (
                          <label className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Checkbox
                              aria-label={`${l.rotulo} não realizada`}
                              checked={d.naoRealizada}
                              // Marcar NÃO apaga o que já foi digitado — só desabilita os campos. Quem
                              // limpa de verdade é a gravação (horasDoLancamento), e desmarcar por
                              // engano não pode custar o horário que a AD acabou de copiar do caderno.
                              onCheckedChange={(v) =>
                                setDrafts((p) => ({ ...p, [l.chave]: { ...d, naoRealizada: Boolean(v) } }))
                              }
                            />
                            não realizada
                          </label>
                        )}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "py-1.5 tabular-nums",
                        c.desvioMin != null && c.desvioMin > 0 && "text-alerta-fg",
                        c.desvioMin != null && c.desvioMin < 0 && "text-sucesso-fg"
                      )}
                    >
                      {c.naoRealizada
                        ? "não realizada"
                        : c.desvioMin != null
                          ? fraseComparacao(c).split(" · ").at(-1)
                          : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <p className="text-sm font-medium" data-total-realizado>
          {fraseTotalDoDia(total)}
        </p>
        {salvo && <p className="text-sm text-sucesso-fg">Lançamento salvo.</p>}
        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <DialogFooter>
          <Button onClick={salvar} disabled={salvando || linhas.length === 0}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
