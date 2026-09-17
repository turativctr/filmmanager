"use client";

import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { StripCard } from "@/components/stripboard/strip-card";
import { StripDropZone } from "@/components/stripboard/strip-drop-zone";
import { TermTooltip } from "@/components/shared/term-tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getCharacterId } from "@/lib/character-id";
import { cn } from "@/lib/utils";

import { FILTRO_VAZIO, filtroAtivo, passaNoFiltro, SEM_LOCACAO, type BoneyardFiltro } from "./boneyard-filter";
import type { SceneSummary, StripItem } from "./types";

const CLASSE_LUZ_LABEL: Record<SceneSummary["classeLuz"], string> = {
  DIA: "Dia",
  NOITE: "Noite",
  TRANSICAO: "Transição",
  INDEFINIDO: "Indefinido",
};

function MultiSelect({
  rotulo,
  opcoes,
  selecionados,
  onChange,
}: {
  rotulo: string;
  opcoes: { valor: string; label: string }[];
  selecionados: string[];
  onChange: (valores: string[]) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 gap-1", selecionados.length > 0 && "border-scheduling-accent text-scheduling-fg")}
        >
          {rotulo}
          {selecionados.length > 0 && ` (${selecionados.length})`}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 w-64 space-y-1 overflow-y-auto p-2">
        {opcoes.length === 0 && <p className="px-1 text-xs text-muted-foreground">Nenhuma opção no projeto.</p>}
        {opcoes.map((o) => {
          const marcado = selecionados.includes(o.valor);
          return (
            <label key={o.valor} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent">
              <Checkbox
                checked={marcado}
                onCheckedChange={(v) =>
                  onChange(v ? [...selecionados, o.valor] : selecionados.filter((s) => s !== o.valor))
                }
              />
              <span className="min-w-0 truncate">{o.label}</span>
            </label>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

export function BoneyardSection({
  projectId,
  items,
  characterMap,
  sistemaIdElenco,
  locacoes,
  onUpdateTimes,
}: {
  projectId: string;
  items: StripItem[];
  characterMap: Record<string, { idCurto: string; numeroElenco: number | null; personagem: string }>;
  sistemaIdElenco: "ID_CURTO" | "NUMERACAO";
  locacoes: { id: string; nome: string }[];
  onUpdateTimes: (itemId: string, prepMin: number | null, rodMin: number | null) => void;
}) {
  const [open, setOpen] = useState(true);
  // Estado só da sessão da tela — o filtro é ferramenta de momento, não preferência salva.
  const [filtro, setFiltro] = useState<BoneyardFiltro>(FILTRO_VAZIO);
  const ativo = filtroAtivo(filtro);

  const idDoElenco = useCallback(
    (id: string) => {
      const c = characterMap[id];
      return c ? getCharacterId(c, { sistemaIdElenco }) : id;
    },
    [characterMap, sistemaIdElenco]
  );
  // O filtro só decide o que aparece: a lista do quadro (e o arraste) continua sendo `items` inteira.
  // Tira que entra numa diária sai de `items` e some daqui sozinha.
  const visiveis = useMemo(
    () => items.filter((item) => passaNoFiltro(item, filtro, idDoElenco)),
    [items, filtro, idDoElenco]
  );

  const opcoesLocacao = [
    ...locacoes.map((l) => ({ valor: l.id, label: l.nome })),
    { valor: SEM_LOCACAO, label: "Sem locação definida" },
  ];
  const opcoesLuz = (Object.keys(CLASSE_LUZ_LABEL) as SceneSummary["classeLuz"][]).map((c) => ({
    valor: c,
    label: CLASSE_LUZ_LABEL[c],
  }));
  const opcoesElenco = Object.entries(characterMap)
    .map(([id, c]) => ({ valor: id, label: `${getCharacterId(c, { sistemaIdElenco })} · ${c.personagem}` }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

  return (
    <Card id="boneyard">
      <CardHeader
        className="cursor-pointer flex-row items-center justify-between space-y-0"
        onClick={() => setOpen((o) => !o)}
      >
        <CardTitle className="flex items-center gap-1.5 text-base">
          Boneyard ({items.length})
          <span onClick={(e) => e.stopPropagation()}>
            <TermTooltip content="Área do Stripboard onde ficam as cenas ainda não agendadas em nenhum dia de filmagem — e, de cena dividida entre diárias, cada parte ainda sem diária." />
          </span>
        </CardTitle>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Buscar no Boneyard"
                  placeholder="Nº da cena, ID de elenco, parte ou locação"
                  className="h-8 w-56 pl-7 text-sm"
                  value={filtro.busca}
                  onChange={(e) => setFiltro((f) => ({ ...f, busca: e.target.value }))}
                />
              </div>
              <MultiSelect
                rotulo="Locação"
                opcoes={opcoesLocacao}
                selecionados={filtro.locacaoIds}
                onChange={(locacaoIds) => setFiltro((f) => ({ ...f, locacaoIds }))}
              />
              <MultiSelect
                rotulo="Dia/noite"
                opcoes={opcoesLuz}
                selecionados={filtro.classesLuz}
                onChange={(v) => setFiltro((f) => ({ ...f, classesLuz: v as SceneSummary["classeLuz"][] }))}
              />
              <MultiSelect
                rotulo="Elenco"
                opcoes={opcoesElenco}
                selecionados={filtro.characterIds}
                onChange={(characterIds) => setFiltro((f) => ({ ...f, characterIds }))}
              />
              {ativo && (
                <>
                  <span className="text-sm text-muted-foreground">
                    {visiveis.length} de {items.length} {items.length === 1 ? "cena" : "cenas"}
                  </span>
                  <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => setFiltro(FILTRO_VAZIO)}>
                    <X className="h-3.5 w-3.5" />
                    Limpar filtro
                  </Button>
                </>
              )}
            </div>
          )}
          <StripDropZone
            id="boneyard"
            itemIds={visiveis.map((i) => i.itemId)}
            emptyLabel={ativo && items.length > 0 ? "Nenhuma cena com esse filtro." : "Nenhuma cena não agendada."}
          >
            {visiveis.map((item) => (
              <StripCard
                key={item.itemId}
                item={item}
                neutral
                characterLabels={item.scene.characterIds.map(idDoElenco)}
                onUpdateTimes={(prep, rod) => onUpdateTimes(item.itemId, prep, rod)}
                projectId={projectId}
              />
            ))}
          </StripDropZone>
        </CardContent>
      )}
    </Card>
  );
}
