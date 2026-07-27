"use client";

import type { TipoPontoApoio } from "@prisma/client";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIPO_PONTO_APOIO_LABEL, TIPO_PONTO_APOIO_ORDER } from "@/lib/locacao";

export type PontoApoioRow = {
  id: string;
  tipo: TipoPontoApoio;
  descricao: string;
  endereco: string | null;
};

export function LocacaoApoioSection({
  projectId,
  locacaoId,
  nome,
  hospitalNome,
  hospitalEndereco,
  hospitalTelefone,
  pontosApoio,
}: {
  projectId: string;
  locacaoId: string;
  nome: string;
  hospitalNome: string | null;
  hospitalEndereco: string | null;
  hospitalTelefone: string | null;
  pontosApoio: PontoApoioRow[];
}) {
  const router = useRouter();
  const [hospitalLoading, setHospitalLoading] = useState(false);
  const [novoTipo, setNovoTipo] = useState<TipoPontoApoio>("OUTRO");
  const [novoLoading, setNovoLoading] = useState(false);

  async function handleHospitalSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setHospitalLoading(true);

    const form = new FormData(e.currentTarget);
    await fetch(`/api/projects/${projectId}/locacoes/${locacaoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome,
        hospitalNome: form.get("hospitalNome") || null,
        hospitalEndereco: form.get("hospitalEndereco") || null,
        hospitalTelefone: form.get("hospitalTelefone") || null,
      }),
    });

    setHospitalLoading(false);
    router.refresh();
  }

  async function handleAddPonto(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNovoLoading(true);

    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/projects/${projectId}/locacoes/${locacaoId}/pontos-apoio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: novoTipo,
        descricao: form.get("descricao"),
        endereco: form.get("endereco") || null,
      }),
    });

    setNovoLoading(false);
    if (res.ok) {
      (e.target as HTMLFormElement).reset();
      setNovoTipo("OUTRO");
      router.refresh();
    }
  }

  async function handleDeletePonto(pontoApoioId: string) {
    await fetch(`/api/projects/${projectId}/locacoes/${locacaoId}/pontos-apoio/${pontoApoioId}`, {
      method: "DELETE",
    });
    router.refresh();
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= pontosApoio.length) return;
    const ids = pontosApoio.map((p) => p.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];

    await fetch(`/api/projects/${projectId}/locacoes/${locacaoId}/pontos-apoio/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pontoApoioIds: ids }),
    });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Apoio e entorno</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-erro-fg">Hospital</h4>
          <form onSubmit={handleHospitalSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="hospitalNome">Nome</Label>
                <Input id="hospitalNome" name="hospitalNome" defaultValue={hospitalNome ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hospitalTelefone">Telefone</Label>
                <Input id="hospitalTelefone" name="hospitalTelefone" defaultValue={hospitalTelefone ?? ""} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hospitalEndereco">Endereço</Label>
              <Input id="hospitalEndereco" name="hospitalEndereco" defaultValue={hospitalEndereco ?? ""} />
            </div>
            <Button type="submit" size="sm" variant="outline" disabled={hospitalLoading}>
              {hospitalLoading ? "Salvando..." : "Salvar hospital"}
            </Button>
          </form>
        </div>

        <div className="space-y-3 border-t pt-4">
          <h4 className="text-sm font-medium">Pontos de apoio</h4>

          {pontosApoio.length > 0 && (
            <div className="space-y-1.5">
              {pontosApoio.map((ponto, index) => (
                <div key={ponto.id} className="flex items-start gap-2 rounded-md border p-2.5 text-sm">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={index === 0}
                      onClick={() => handleMove(index, -1)}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={index === pontosApoio.length - 1}
                      onClick={() => handleMove(index, 1)}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <p className="font-medium">{TIPO_PONTO_APOIO_LABEL[ponto.tipo]}</p>
                    <p className="text-muted-foreground">{ponto.descricao}</p>
                    {ponto.endereco && <p className="text-xs text-muted-foreground">{ponto.endereco}</p>}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleDeletePonto(ponto.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAddPonto} className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={novoTipo} onValueChange={(v) => setNovoTipo(v as TipoPontoApoio)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_PONTO_APOIO_ORDER.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {TIPO_PONTO_APOIO_LABEL[tipo]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label htmlFor="descricao">Descrição</Label>
              <Input id="descricao" name="descricao" placeholder="Ex.: Estação Jaraguá — Linha 7 Rubi, 6 min a pé" required />
            </div>
            <div className="min-w-[160px] flex-1 space-y-1.5">
              <Label htmlFor="endereco">Endereço (opcional)</Label>
              <Input id="endereco" name="endereco" />
            </div>
            <Button type="submit" size="sm" disabled={novoLoading}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Adicionar
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
