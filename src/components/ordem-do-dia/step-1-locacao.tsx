"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TIPO_PONTO_APOIO_LABEL, TIPO_PONTO_APOIO_ORDER } from "@/lib/locacao";

import type { LocacaoInfo, LogisticsState } from "./types";

export function Step1Locacao({
  logistics,
  onChange,
  locacaoInfo,
}: {
  logistics: LogisticsState;
  onChange: (patch: Partial<LogisticsState>) => void;
  locacaoInfo: LocacaoInfo;
}) {
  const pontosApoio = locacaoInfo.locacao?.pontosApoio ?? [];
  const pontosPorTipo = TIPO_PONTO_APOIO_ORDER.map((tipo) => ({
    tipo,
    pontos: pontosApoio.filter((p) => p.tipo === tipo),
  })).filter((g) => g.pontos.length > 0);

  function copyLocacaoParaBase() {
    onChange({ baseInfo: `Na locação (${logistics.locacaoEndereco || logistics.locacaoNome})` });
  }

  return (
    <div className="space-y-4">
      {locacaoInfo.mixedCount != null && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Este dia tem cenas em {locacaoInfo.mixedCount} locações — prevê mudança de locação. Preencha os campos
            abaixo manualmente.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="locacaoNome">Locação — nome</Label>
          <Input
            id="locacaoNome"
            value={logistics.locacaoNome}
            onChange={(e) => onChange({ locacaoNome: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="transporteHorario">Transporte — horário</Label>
          <Input
            id="transporteHorario"
            type="time"
            value={logistics.transporteHorario}
            onChange={(e) => onChange({ transporteHorario: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Sugestão: chamada geral - 30min.</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="locacaoEndereco">Locação — endereço</Label>
        <Textarea
          id="locacaoEndereco"
          rows={2}
          value={logistics.locacaoEndereco}
          onChange={(e) => onChange({ locacaoEndereco: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="transporteEndereco">Transporte — ponto de encontro/endereço</Label>
        <Textarea
          id="transporteEndereco"
          rows={2}
          value={logistics.transporteEndereco}
          onChange={(e) => onChange({ transporteEndereco: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="baseInfo">Base / Alimentação / Camarim</Label>
          <Button type="button" variant="ghost" size="sm" onClick={copyLocacaoParaBase}>
            Copiar endereço da locação para base
          </Button>
        </div>
        <Textarea
          id="baseInfo"
          rows={2}
          value={logistics.baseInfo}
          onChange={(e) => onChange({ baseInfo: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="estacionamento">Estacionamento</Label>
        <Textarea
          id="estacionamento"
          rows={2}
          value={logistics.estacionamento}
          onChange={(e) => onChange({ estacionamento: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">Sugestão: ruas próximas à locação.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="hospitalNome">Hospital — nome</Label>
          <Input
            id="hospitalNome"
            value={logistics.hospitalNome}
            onChange={(e) => onChange({ hospitalNome: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hospitalEndereco">Hospital — endereço</Label>
          <Input
            id="hospitalEndereco"
            value={logistics.hospitalEndereco}
            onChange={(e) => onChange({ hospitalEndereco: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hospitalTelefone">Hospital — telefone</Label>
          <Input
            id="hospitalTelefone"
            value={logistics.hospitalTelefone}
            onChange={(e) => onChange({ hospitalTelefone: e.target.value })}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Não há API gratuita confiável para sugerir hospital mais próximo — preencha manualmente.
      </p>

      {pontosPorTipo.length > 0 && (
        <div className="space-y-2 rounded-md border p-3">
          <Label>Apoio e entorno</Label>
          <div className="space-y-2">
            {pontosPorTipo.map(({ tipo, pontos }) => (
              <div key={tipo} className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">{TIPO_PONTO_APOIO_LABEL[tipo]}</p>
                <ul className="space-y-0.5">
                  {pontos.map((ponto) => (
                    <li key={ponto.id} className="text-sm">
                      {ponto.descricao}
                      {ponto.endereco && <span className="text-muted-foreground"> — {ponto.endereco}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
