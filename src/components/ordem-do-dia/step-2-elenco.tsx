"use client";

import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CREW_CALL_DEPARTMENTS } from "@/lib/report-constants";
import { formatHHh } from "@/lib/schedule";

import type { CastRow, ExtraRow } from "./types";

function TimeCell({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  return (
    <Input
      type="time"
      className="h-8 w-28"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** "Com a equipe" x automático pra chegada ou saída do elenco todo; destaca o modo que já vale pra todas
 *  as linhas (nenhum, se a AD editou alguma à mão). */
function ModoElenco({
  titulo,
  rotuloAuto,
  rotuloEquipe,
  horarioEquipe,
  ativo,
  onAplicar,
}: {
  titulo: string;
  rotuloAuto: string;
  rotuloEquipe: string;
  horarioEquipe: string | null;
  ativo: "equipe" | "auto" | null;
  onAplicar: (modo: "equipe" | "auto") => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{titulo}:</span>
      <Button
        type="button"
        size="sm"
        variant={ativo === "auto" ? "secondary" : "ghost"}
        className="h-7 px-2 text-xs"
        onClick={() => onAplicar("auto")}
      >
        {rotuloAuto}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={ativo === "equipe" ? "secondary" : "ghost"}
        className="h-7 px-2 text-xs"
        disabled={!horarioEquipe}
        title={horarioEquipe ? undefined : "Defina esse horário na diária"}
        onClick={() => onAplicar("equipe")}
      >
        {rotuloEquipe}
        {horarioEquipe ? ` (${formatHHh(horarioEquipe)})` : ""}
      </Button>
    </div>
  );
}

function modoAtivo(valores: (string | null)[], equipe: string | null, autos: (string | null)[]) {
  if (valores.length === 0) return null;
  if (equipe && valores.every((v) => v === equipe)) return "equipe";
  if (valores.every((v, i) => v === autos[i])) return "auto";
  return null;
}

export function Step2Elenco({
  castRows,
  onCastChange,
  onRecalcularTodos,
  chamadaGeral,
  desprodInicio,
  onChegadaElenco,
  onSaidaElenco,
  extraRows,
  onExtraChange,
  chamadaEquipe,
  chamadaEquipeSugerida,
  onChamadaEquipeChange,
}: {
  castRows: CastRow[];
  onCastChange: (id: string, patch: Partial<Pick<CastRow, "chamada" | "camarim" | "set" | "saida">>) => void;
  onRecalcularTodos: () => void;
  chamadaGeral: string | null;
  desprodInicio: string | null;
  onChegadaElenco: (modo: "equipe" | "auto") => void;
  onSaidaElenco: (modo: "equipe" | "auto") => void;
  extraRows: ExtraRow[];
  onExtraChange: (id: string, patch: Partial<Pick<ExtraRow, "chamada" | "saida">>) => void;
  chamadaEquipe: Record<string, string>;
  chamadaEquipeSugerida: Record<string, string>;
  onChamadaEquipeChange: (departamento: string, valor: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold">Elenco presente</h4>
          <Button type="button" variant="outline" size="sm" onClick={onRecalcularTodos}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Recalcular todos
          </Button>
        </div>
        {castRows.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1">
            <ModoElenco
              titulo="Chegada"
              rotuloAuto="Pelo horário de set"
              rotuloEquipe="Com a equipe"
              horarioEquipe={chamadaGeral}
              ativo={modoAtivo(
                castRows.map((r) => r.chamada),
                chamadaGeral,
                castRows.map((r) => r.autoChamada)
              )}
              onAplicar={onChegadaElenco}
            />
            <ModoElenco
              titulo="Saída"
              rotuloAuto="Ao fim das cenas"
              rotuloEquipe="Com a desprodução"
              horarioEquipe={desprodInicio}
              ativo={modoAtivo(
                castRows.map((r) => r.saida),
                desprodInicio,
                castRows.map((r) => r.autoSaida)
              )}
              onAplicar={onSaidaElenco}
            />
          </div>
        )}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Personagem</TableHead>
                <TableHead>Ator</TableHead>
                <TableHead>Cenas</TableHead>
                <TableHead>Chegada</TableHead>
                <TableHead>Camarim</TableHead>
                <TableHead>Set</TableHead>
                <TableHead>Saída</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {castRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.idCurto}</TableCell>
                  <TableCell>{row.personagem}</TableCell>
                  <TableCell className="text-muted-foreground">{row.ator ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.cenas.join(", ")}</TableCell>
                  <TableCell>
                    <TimeCell value={row.chamada} onChange={(v) => onCastChange(row.id, { chamada: v })} />
                  </TableCell>
                  <TableCell>
                    <TimeCell value={row.camarim} onChange={(v) => onCastChange(row.id, { camarim: v })} />
                  </TableCell>
                  <TableCell>
                    <TimeCell value={row.set} onChange={(v) => onCastChange(row.id, { set: v })} />
                  </TableCell>
                  <TableCell>
                    <TimeCell value={row.saida} onChange={(v) => onCastChange(row.id, { saida: v })} />
                  </TableCell>
                </TableRow>
              ))}
              {castRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-4 text-center text-sm text-muted-foreground">
                    Nenhum personagem escalado nas cenas do dia.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold">Figuração presente</h4>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Personagem</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Chamada</TableHead>
                <TableHead>Saída</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extraRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.personagem}</TableCell>
                  <TableCell>{row.quantidade}</TableCell>
                  <TableCell>
                    <TimeCell value={row.chamada} onChange={(v) => onExtraChange(row.id, { chamada: v })} />
                  </TableCell>
                  <TableCell>
                    <TimeCell value={row.saida} onChange={(v) => onExtraChange(row.id, { saida: v })} />
                  </TableCell>
                </TableRow>
              ))}
              {extraRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-4 text-center text-sm text-muted-foreground">
                    Nenhuma figuração vinculada às cenas do dia.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h4 className="mb-1 text-sm font-semibold">Chamada equipe</h4>
        <p className="mb-2 text-xs text-muted-foreground">Desmarque quem não vai ao set nessa diária — fica fora da OD.</p>
        <div className="grid grid-cols-3 gap-x-4 gap-y-2">
          {CREW_CALL_DEPARTMENTS.map((dept) => {
            const vai = Boolean(chamadaEquipe[dept]);
            const id = `chamada-equipe-${dept}`;
            return (
              <div key={dept} className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id={id}
                    checked={vai}
                    // Marcar já traz um horário (a sugestão do departamento ou a chamada geral):
                    // departamento marcado sem horário não existe — salvaria como desmarcado.
                    onCheckedChange={(c) =>
                      onChamadaEquipeChange(dept, c === true ? chamadaEquipeSugerida[dept] || "08:00" : "")
                    }
                  />
                  <Label htmlFor={id} className={vai ? "text-xs" : "text-xs text-muted-foreground"}>
                    {dept}
                  </Label>
                </div>
                {vai ? (
                  <Input
                    type="time"
                    className="h-8"
                    value={chamadaEquipe[dept]}
                    // O input de hora devolve "" enquanto o horário está incompleto — isso
                    // desmarcaria o departamento no meio da digitação. Pra tirar, desmarca.
                    onChange={(e) => e.target.value && onChamadaEquipeChange(dept, e.target.value)}
                  />
                ) : (
                  <p className="flex h-8 items-center text-sm text-muted-foreground">Não vai</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
