"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { TermTooltip } from "@/components/shared/term-tooltip";
import { Card, CardContent } from "@/components/ui/card";
import type { BlocoDeTempo } from "@/lib/day-timeline";
import {
  avaliarJornada,
  formatHoraDoDia,
  jornadaDoTeto,
  JORNADA_MAX_MIN,
  JORNADA_MIN_MIN,
  mensagemJornada,
  montarJornada,
  RESERVA_MAX_MIN,
  type TetoDiaria,
} from "@/lib/jornada-diaria";
import { formatTempoEstimado } from "@/lib/paginas";
import {
  DEFAULT_PREP_MIN,
  formatHHh,
  MIN_ROD_MIN,
  resolveEffectivePrepMin,
  resolveEffectiveRodMin,
  timeToMinutes,
  type JornadaConfig,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";

/** Uma linha agendada da diária (cena inteira ou parte). prep/Rod CRUS, como estão gravados em
 *  SceneShootDay — null = nunca definido, e aí vale o mesmo fallback do resto do app. */
export type CenaSimplificada = {
  sceneId: string;
  scenePartId: string | null;
  ordem: number;
  bloco: "MANHA" | "TARDE";
  /** Rótulo de exibição: "19 · Voice off" para parte. */
  numero: string;
  local: string;
  prepMin: number | null;
  rodMin: number | null;
  /** Fallback do Rod desta linha (da parte, se for parte) — o mesmo de resolveEffectiveRodMin na OD. */
  tempoEstimadoMin: number | null;
};

type Draft = { prep: string; rod: string };

const chave = (c: { sceneId: string; scenePartId: string | null }) => `${c.sceneId}:${c.scenePartId ?? ""}`;
const paraTexto = (n: number | null) => (n == null ? "" : String(n));

/** "" = limpar (volta ao fallback); número inteiro ≥ `minimo`; qualquer outra coisa = inválido. */
function lerMinutos(texto: string, minimo = 0): number | null | undefined {
  if (texto.trim() === "") return null;
  const n = Number(texto);
  return Number.isInteger(n) && n >= minimo ? n : undefined;
}

/** Rod abaixo do mínimo é recusado AQUI, na hora de digitar: a regra do app (resolveEffectiveRodMin)
 *  arredonda pra MIN_ROD_MIN e trata 0 como "não definido" — numa tela que soma minutos, digitar 3 e a
 *  conta usar 5 pareceria defeito. A regra não muda; só fica visível. */
const lerRod = (texto: string) => lerMinutos(texto, MIN_ROD_MIN);

type ModoTeto = "SEM" | "JORNADA" | "FIM";

export function JornadaSimplificada({
  projectId,
  shootDayId,
  chamadaGeral,
  desprodInicio,
  config,
  teto: tetoInicial,
  reservaMin: reservaInicial,
  cenas,
  blocos,
  cortaveisMin,
}: {
  projectId: string;
  shootDayId: string;
  chamadaGeral: string | null;
  desprodInicio: string | null;
  config: JornadaConfig;
  teto: TetoDiaria;
  /** Margem que a AD guarda pro dia. Só aparece aqui; nenhum documento a conhece. */
  reservaMin: number | null;
  cenas: CenaSimplificada[];
  blocos: BlocoDeTempo[];
  cortaveisMin: number;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [blocoDrafts, setBlocoDrafts] = useState<Record<string, string>>({});
  const [teto, setTeto] = useState<TetoDiaria>(tetoInicial);
  const [modoTeto, setModoTeto] = useState<ModoTeto>(
    tetoInicial.jornadaMin != null ? "JORNADA" : tetoInicial.horaFimAlvo != null ? "FIM" : "SEM"
  );
  const [reserva, setReserva] = useState<number | null>(reservaInicial);
  const [erro, setErro] = useState<string | null>(null);
  // Uma gravação por vez: a rota de reordenação usa `ordem` negativa temporária, e duas transações
  // simultâneas na mesma diária brigariam por ela.
  const fila = useRef<Promise<unknown>>(Promise.resolve());

  // O servidor é a verdade: quando os dados voltam (router.refresh depois de gravar), os rascunhos
  // voltam a ser os valores gravados.
  const assinatura = JSON.stringify([cenas, blocos]);
  useEffect(() => {
    setDrafts(Object.fromEntries(cenas.map((c) => [chave(c), { prep: paraTexto(c.prepMin), rod: paraTexto(c.rodMin) }])));
    setBlocoDrafts(Object.fromEntries(blocos.map((b) => [b.id, String(b.duracaoMin)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura]);
  useEffect(() => setTeto(tetoInicial), [tetoInicial.jornadaMin, tetoInicial.horaFimAlvo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setReserva(reservaInicial), [reservaInicial]);

  // Recalcula a cada tecla — "mudou um número, tudo abaixo recalcula na hora". Número inválido no
  // rascunho usa o valor gravado até ser corrigido.
  const cenasEfetivas = useMemo(
    () =>
      cenas.map((c) => {
        const d = drafts[chave(c)];
        const prep = d ? lerMinutos(d.prep) : undefined;
        const rod = d ? lerRod(d.rod) : undefined;
        return {
          ...c,
          prepMin: resolveEffectivePrepMin(prep === undefined ? c.prepMin : prep),
          rodMin: resolveEffectiveRodMin(rod === undefined ? c.rodMin : rod, c.tempoEstimadoMin),
          original: c,
        };
      }),
    [cenas, drafts]
  );
  const blocosEfetivos = useMemo(
    () =>
      blocos.map((b) => {
        const n = Number(blocoDrafts[b.id]);
        return { ...b, duracaoMin: Number.isInteger(n) && n >= 1 ? n : b.duracaoMin };
      }),
    [blocos, blocoDrafts]
  );

  const montada = montarJornada({ chamadaGeral, config, cenas: cenasEfetivas, blocos: blocosEfetivos });
  const avaliacao = avaliarJornada(teto, chamadaGeral, montada, reserva);
  const fimComReserva = montada.fimMin !== null && reserva ? montada.fimMin + reserva : null;
  const aviso = mensagemJornada(avaliacao, { cortaveisMin });
  const jornadaMin = jornadaDoTeto(teto, chamadaGeral);

  function enfileirar(tarefa: () => Promise<boolean>) {
    fila.current = fila.current.then(async () => {
      const ok = await tarefa();
      if (ok) router.refresh();
    });
  }

  function gravarCena(c: CenaSimplificada) {
    const d = drafts[chave(c)];
    if (!d) return;
    const prep = lerMinutos(d.prep);
    const rod = lerRod(d.rod);
    if (rod === undefined && Number.isInteger(Number(d.rod)) && Number(d.rod) < MIN_ROD_MIN) {
      setErro(`Cena ${c.numero}: Rod mínimo ${MIN_ROD_MIN}min.`);
      setDrafts((prev) => ({ ...prev, [chave(c)]: { prep: paraTexto(c.prepMin), rod: paraTexto(c.rodMin) } }));
      return;
    }
    if (prep === undefined || rod === undefined) {
      setErro(`Cena ${c.numero}: use minutos inteiros, ou deixe em branco.`);
      setDrafts((prev) => ({ ...prev, [chave(c)]: { prep: paraTexto(c.prepMin), rod: paraTexto(c.rodMin) } }));
      return;
    }
    if (prep === c.prepMin && rod === c.rodMin) return;
    setErro(null);
    // O MESMO caminho de digitar prep/Rod na tira do Stripboard: a rota de reordenação com esta linha
    // só, na posição e no lado do almoço em que ela já está. Ela atualiza a linha no lugar — status e
    // horas reais ficam como estão — e recalcula o almoço da diária.
    enfileirar(async () => {
      const res = await fetch(`/api/projects/${projectId}/stripboard/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changes: [
            {
              sceneId: c.sceneId,
              scenePartId: c.scenePartId,
              shootDayId,
              bloco: c.bloco,
              ordem: c.ordem,
              prepMin: prep,
              rodMin: rod,
            },
          ],
        }),
      });
      if (!res.ok) {
        setErro(`Não foi possível gravar a cena ${c.numero}.`);
        setDrafts((prev) => ({ ...prev, [chave(c)]: { prep: paraTexto(c.prepMin), rod: paraTexto(c.rodMin) } }));
      }
      return res.ok;
    });
  }

  function gravarBloco(b: BlocoDeTempo) {
    const n = Number(blocoDrafts[b.id]);
    if (!Number.isInteger(n) || n < 1 || n > 24 * 60) {
      setErro(`${b.rotulo}: duração em minutos inteiros, de 1 a 1440.`);
      setBlocoDrafts((prev) => ({ ...prev, [b.id]: String(b.duracaoMin) }));
      return;
    }
    if (n === b.duracaoMin) return;
    setErro(null);
    enfileirar(async () => {
      const res = await fetch(`/api/projects/${projectId}/shoot-days/${shootDayId}/blocos/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duracaoMin: n }),
      });
      if (!res.ok) {
        setErro(`Não foi possível gravar ${b.rotulo}.`);
        setBlocoDrafts((prev) => ({ ...prev, [b.id]: String(b.duracaoMin) }));
      }
      return res.ok;
    });
  }

  function gravarTeto(novo: TetoDiaria) {
    const anterior = teto;
    setTeto(novo);
    setErro(null);
    enfileirar(async () => {
      const res = await fetch(`/api/projects/${projectId}/shoot-days/${shootDayId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(novo),
      });
      if (!res.ok) {
        setErro("Não foi possível gravar o teto da diária.");
        setTeto(anterior);
      }
      return res.ok;
    });
  }

  function gravarReserva(novo: number | null) {
    const anterior = reserva;
    setReserva(novo);
    setErro(null);
    enfileirar(async () => {
      const res = await fetch(`/api/projects/${projectId}/shoot-days/${shootDayId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservaMin: novo }),
      });
      if (!res.ok) {
        setErro("Não foi possível gravar a reserva.");
        setReserva(anterior);
      }
      return res.ok;
    });
  }

  function trocarModoTeto(modo: ModoTeto) {
    setModoTeto(modo);
    // Trocar o tipo não inventa número: "Sem teto" limpa; os outros só gravam quando a AD digitar.
    if (modo === "SEM" && (teto.jornadaMin != null || teto.horaFimAlvo != null)) {
      gravarTeto({ jornadaMin: null, horaFimAlvo: null });
    }
  }

  const campo =
    "w-14 rounded border bg-background px-1 py-0.5 text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-scheduling-accent";
  const hora = (inicio: number | null) => (inicio === null ? "—" : formatHoraDoDia(inicio));
  const desprodNaOd = desprodInicio && montada.fimMin !== null && timeToMinutes(desprodInicio) !== montada.fimMin % 1440;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="flex items-center gap-1 text-sm font-semibold">
            Orçamento de tempo
            <TermTooltip content="Defina o teto da diária e distribua prep e rodagem por cena. Os números são os mesmos do Stripboard e da Ordem do Dia: mudar aqui muda lá. O teto só avisa — nada é redistribuído sozinho." />
          </p>
          <div className="flex items-center gap-1 text-sm" role="radiogroup" aria-label="Teto da diária">
            {(
              [
                ["SEM", "Sem teto"],
                ["JORNADA", "Jornada"],
                ["FIM", "Hora de fim"],
              ] as const
            ).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={modoTeto === valor}
                onClick={() => trocarModoTeto(valor)}
                className={cn(
                  "rounded-md border px-2 py-0.5",
                  modoTeto === valor
                    ? "border-scheduling-accent bg-scheduling-bg text-scheduling-fg"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>
          {modoTeto === "JORNADA" && (
            <JornadaInput
              valorMin={teto.jornadaMin}
              onCommit={(min) => gravarTeto({ jornadaMin: min, horaFimAlvo: null })}
            />
          )}
          {modoTeto === "FIM" && (
            <label className="flex items-center gap-1 text-sm">
              <span className="text-muted-foreground">Acaba às</span>
              <input
                type="time"
                aria-label="Hora de fim da diária"
                className="rounded border bg-background px-1 py-0.5"
                defaultValue={teto.horaFimAlvo ?? ""}
                key={teto.horaFimAlvo ?? "vazio"}
                onBlur={(e) => {
                  const v = e.target.value;
                  if (v && v !== teto.horaFimAlvo) gravarTeto({ jornadaMin: null, horaFimAlvo: v });
                }}
              />
            </label>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <label className="flex items-center gap-1">
            <span className="text-muted-foreground">Reserva do dia</span>
            <ReservaInput valorMin={reserva} onCommit={gravarReserva} />
          </label>
          {fimComReserva !== null && (
            <span className="rounded-md bg-scheduling-bg px-2 py-0.5 text-scheduling-fg" data-com-reserva>
              Com reserva {formatHoraDoDia(fimComReserva)}
              <span className="ml-1 text-xs text-muted-foreground">só você vê — não sai em documento</span>
            </span>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          {[
            jornadaMin != null ? `Jornada: ${formatTempoEstimado(jornadaMin)}` : null,
            chamadaGeral ? `Chamada ${formatHHh(chamadaGeral)}` : "Sem chamada geral — só durações, sem horário",
            avaliacao.estado === "AVALIADA" && avaliacao.limiteMin !== null ? `Limite ${formatHoraDoDia(avaliacao.limiteMin)}` : null,
            montada.fimMin !== null ? `Fim previsto ${formatHoraDoDia(montada.fimMin)}` : null,
            montada.linhas.length > 0 ? `Total ${formatTempoEstimado(montada.totalMin)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {montada.linhas.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Nenhuma cena nesta diária ainda. Agende cenas no Stripboard.</p>
        ) : (
          <ol className="divide-y rounded-md border text-sm">
            {montada.linhas.map((linha, i) => {
              if (linha.kind === "cena") {
                const c = linha.cena.original;
                const d = drafts[chave(c)] ?? { prep: "", rod: "" };
                return (
                  <li key={`cena-${chave(c)}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5" data-linha="cena" data-tira={chave(c)}>
                    <span className="w-20 shrink-0 tabular-nums text-muted-foreground">{hora(linha.inicio)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">Cena {c.numero}</span>
                      {c.local && <span className="text-muted-foreground"> · {c.local}</span>}
                    </span>
                    <label className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">prep</span>
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        aria-label={`Prep da cena ${c.numero}`}
                        className={campo}
                        value={d.prep}
                        placeholder={String(DEFAULT_PREP_MIN)}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [chave(c)]: { ...d, prep: e.target.value } }))}
                        onBlur={() => gravarCena(c)}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">rod</span>
                      <input
                        type="number"
                        min={MIN_ROD_MIN}
                        inputMode="numeric"
                        aria-label={`Rod da cena ${c.numero}`}
                        aria-invalid={d.rod !== "" && lerRod(d.rod) === undefined}
                        title={`Rod mínimo ${MIN_ROD_MIN}min`}
                        className={cn(campo, d.rod !== "" && lerRod(d.rod) === undefined && "border-destructive")}
                        value={d.rod}
                        // Sem Rod gravado, a conta usa o estimado (ou o mínimo) — mostrado em cinza,
                        // igual ao que a OD usaria.
                        placeholder={String(linha.cena.rodMin)}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [chave(c)]: { ...d, rod: e.target.value } }))}
                        onBlur={() => gravarCena(c)}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      />
                    </label>
                    <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">
                      {formatTempoEstimado(linha.duracaoMin)}
                    </span>
                  </li>
                );
              }
              if (linha.kind === "bloco") {
                // O bloco GRAVADO, não o da linha: a linha já vem com a duração do rascunho aplicada
                // (pra recalcular ao vivo), e comparar o rascunho com ele mesmo nunca gravaria nada.
                const b = blocos.find((x) => x.id === linha.bloco.id) ?? linha.bloco;
                return (
                  <li key={`bloco-${b.id}`} className="flex items-center gap-3 bg-alerta-bg/40 px-3 py-1.5" data-linha="bloco">
                    <span className="w-20 shrink-0 tabular-nums text-muted-foreground">{hora(linha.inicio)}</span>
                    <span className="min-w-0 flex-1 truncate">{b.rotulo}</span>
                    <label className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        aria-label={`Duração de ${b.rotulo}`}
                        className={campo}
                        value={blocoDrafts[b.id] ?? String(b.duracaoMin)}
                        onChange={(e) => setBlocoDrafts((prev) => ({ ...prev, [b.id]: e.target.value }))}
                        onBlur={() => gravarBloco(b)}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      />
                      <span className="text-xs text-muted-foreground">min</span>
                    </label>
                    <span className="w-14" />
                  </li>
                );
              }
              const rotulo =
                linha.kind === "chamada" ? "Chamada geral" : linha.kind === "almoco" ? "Almoço" : "Desprodução";
              return (
                <li
                  key={`${linha.kind}-${i}`}
                  className="flex items-center gap-3 bg-muted/40 px-3 py-1.5 text-muted-foreground"
                  data-linha={linha.kind}
                >
                  <span className="w-20 shrink-0 tabular-nums">{hora(linha.inicio)}</span>
                  <span className="min-w-0 flex-1">
                    {rotulo}
                    {linha.kind === "desprod" && desprodNaOd && (
                      <span className="text-xs"> · na OD está {formatHHh(desprodInicio!)}</span>
                    )}
                  </span>
                  {linha.duracaoMin > 0 && (
                    <span className="w-14 text-right text-xs tabular-nums">{formatTempoEstimado(linha.duracaoMin)}</span>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {aviso && (
          <div
            role="status"
            data-aviso-jornada={aviso.tom}
            className={cn(
              "space-y-0.5 rounded-md border px-3 py-2 text-sm",
              aviso.tom === "estourou" && "border-alerta-accent/60 bg-alerta-bg font-medium text-alerta-fg",
              aviso.tom === "coube" && "text-emerald-700",
              aviso.tom === "info" && "text-muted-foreground"
            )}
          >
            {aviso.linhas.map((l, i) => (
              <p key={i} className="flex items-start gap-1.5">
                {i === 0 &&
                  (aviso.tom === "estourou" ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : aviso.tom === "coube" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  ))}
                <span className={i > 0 ? "pl-[22px]" : undefined}>{l}</span>
              </p>
            ))}
          </div>
        )}

        {erro && <p className="text-sm text-destructive">{erro}</p>}
      </CardContent>
    </Card>
  );
}

/** Jornada em horas e minutos ("12h", "10h30"). Grava ao sair do campo. */
function JornadaInput({ valorMin, onCommit }: { valorMin: number | null; onCommit: (min: number) => void }) {
  const [h, setH] = useState(valorMin != null ? String(Math.floor(valorMin / 60)) : "");
  const [m, setM] = useState(valorMin != null ? String(valorMin % 60) : "");
  useEffect(() => {
    setH(valorMin != null ? String(Math.floor(valorMin / 60)) : "");
    setM(valorMin != null ? String(valorMin % 60) : "");
  }, [valorMin]);

  function commit() {
    const horas = Number(h || 0);
    const mins = Number(m || 0);
    if (!Number.isInteger(horas) || !Number.isInteger(mins) || mins < 0 || mins > 59) return;
    const total = horas * 60 + mins;
    if (total < JORNADA_MIN_MIN || total > JORNADA_MAX_MIN || total === valorMin) return;
    onCommit(total);
  }

  const campo = "w-12 rounded border bg-background px-1 py-0.5 text-right tabular-nums";
  return (
    <span
      className="flex items-center gap-1 text-sm"
      onBlur={(e) => {
        // Só grava quando o foco sai do par h/min, não ao pular de um pro outro.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commit();
      }}
    >
      <input type="number" min={1} max={24} aria-label="Horas de jornada" className={campo} value={h} onChange={(e) => setH(e.target.value)} onKeyDown={(e) => e.key === "Enter" && commit()} />
      <span className="text-muted-foreground">h</span>
      <input type="number" min={0} max={59} step={5} aria-label="Minutos de jornada" className={campo} value={m} onChange={(e) => setM(e.target.value)} onKeyDown={(e) => e.key === "Enter" && commit()} />
      <span className="text-muted-foreground">min</span>
    </span>
  );
}

/** Reserva do dia em horas e minutos. Campo vazio = sem reserva (grava null). */
function ReservaInput({ valorMin, onCommit }: { valorMin: number | null; onCommit: (min: number | null) => void }) {
  const [texto, setTexto] = useState(valorMin != null ? String(valorMin) : "");
  useEffect(() => setTexto(valorMin != null ? String(valorMin) : ""), [valorMin]);

  function commit() {
    const limpo = texto.trim();
    if (limpo === "") {
      if (valorMin != null) onCommit(null);
      return;
    }
    const n = Number(limpo);
    if (!Number.isInteger(n) || n < 1 || n > RESERVA_MAX_MIN) {
      setTexto(valorMin != null ? String(valorMin) : "");
      return;
    }
    if (n !== valorMin) onCommit(n);
  }

  return (
    <>
      <input
        type="number"
        min={0}
        max={RESERVA_MAX_MIN}
        aria-label="Reserva do dia em minutos"
        className="w-16 rounded border bg-background px-1 py-0.5 text-right tabular-nums"
        value={texto}
        placeholder="0"
        onChange={(e) => setTexto(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      <span className="text-muted-foreground">min</span>
    </>
  );
}
