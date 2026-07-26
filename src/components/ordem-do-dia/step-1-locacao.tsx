"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { LogisticsState } from "./types";

export function Step1Locacao({
  logistics,
  onChange,
}: {
  logistics: LogisticsState;
  onChange: (patch: Partial<LogisticsState>) => void;
}) {
  function copyLocacaoParaBase() {
    onChange({ baseInfo: `Na locação (${logistics.locacaoEndereco || logistics.locacaoNome})` });
  }

  return (
    <div className="space-y-4">
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
    </div>
  );
}
