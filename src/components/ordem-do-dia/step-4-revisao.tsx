"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { CastRow, ExtraRow, LogisticsState, MeteoState } from "./types";

export function Step4Revisao({
  meteo,
  onChange,
  logistics,
  castRows,
  extraRows,
  numeroDia,
}: {
  meteo: MeteoState;
  onChange: (patch: Partial<MeteoState>) => void;
  logistics: LogisticsState;
  castRows: CastRow[];
  extraRows: ExtraRow[];
  numeroDia: number;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h4 className="mb-2 text-sm font-semibold">Meteorologia</h4>
        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="meteoNascer">Nascer do sol</Label>
            <Input
              id="meteoNascer"
              type="time"
              value={meteo.meteoNascer}
              onChange={(e) => onChange({ meteoNascer: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meteoPor">Pôr do sol</Label>
            <Input
              id="meteoPor"
              type="time"
              value={meteo.meteoPor}
              onChange={(e) => onChange({ meteoPor: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meteoMin">Mín (°C)</Label>
            <Input
              id="meteoMin"
              type="number"
              value={meteo.meteoMin}
              onChange={(e) => onChange({ meteoMin: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meteoMax">Máx (°C)</Label>
            <Input
              id="meteoMax"
              type="number"
              value={meteo.meteoMax}
              onChange={(e) => onChange({ meteoMax: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="meteoChuva">Chuva</Label>
          <Input
            id="meteoChuva"
            placeholder="0.25mm 20%"
            value={meteo.meteoChuva}
            onChange={(e) => onChange({ meteoChuva: e.target.value })}
          />
        </div>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="meteoDescricao">Descrição do tempo</Label>
          <Textarea
            id="meteoDescricao"
            rows={2}
            value={meteo.meteoDescricao}
            onChange={(e) => onChange({ meteoDescricao: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="observacoesGerais">Observações gerais</Label>
        <Textarea
          id="observacoesGerais"
          rows={4}
          value={meteo.observacoesGerais}
          onChange={(e) => onChange({ observacoesGerais: e.target.value })}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          A Ordem do Dia sempre imprime as regras fixas de conduta e segurança, além do texto acima.
        </p>
      </div>

      <div>
        <Label htmlFor="observacaoCronogramaElenco">Nota de rodapé — Cronograma de Elenco</Label>
        <Textarea
          id="observacaoCronogramaElenco"
          rows={2}
          value={meteo.observacaoCronogramaElenco}
          onChange={(e) => onChange({ observacaoCronogramaElenco: e.target.value })}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Aparece com asterisco no rodapé do bloco desta diária no Cronograma de Elenco.
        </p>
      </div>

      <div>
        <Label htmlFor="observacaoPlanoSimples">Observação — Plano Simplificado para as Diárias</Label>
        <Textarea
          id="observacaoPlanoSimples"
          rows={2}
          value={meteo.observacaoPlanoSimples}
          onChange={(e) => onChange({ observacaoPlanoSimples: e.target.value })}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Texto livre exibido no plano informal desta diária (ideal para WhatsApp).
        </p>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold">Preview resumido</h4>
        <Card>
          <CardContent className="space-y-1 p-4 text-sm">
            <p>
              <span className="font-medium">Diária {numeroDia}</span> — {logistics.locacaoNome || "locação não definida"}
            </p>
            <p className="text-muted-foreground">{logistics.locacaoEndereco || "endereço não informado"}</p>
            <p>
              Transporte: {logistics.transporteHorario || "—"} · {logistics.transporteEndereco || "—"}
            </p>
            <p>
              {castRows.length} ator(es) escalado(s), {extraRows.length} grupo(s) de figuração
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
