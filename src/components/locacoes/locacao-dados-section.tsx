"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { showAddressDuplicateWarning } from "@/components/locacoes/address-duplicate-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type LocacaoDados = {
  id: string;
  nome: string;
  endereco: string | null;
  contatoNome: string | null;
  contatoTelefone: string | null;
  notas: string | null;
};

export function LocacaoDadosSection({ projectId, locacao }: { projectId: string; locacao: LocacaoDados }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Campos de hospital vivem na seção "Apoio e entorno", editados por outro formulário — omitidos
    // aqui de propósito. locacaoSchema os marca opcionais, então omissão = Prisma não toca a coluna
    // (mesma convenção usada em todo o app pra updates parciais).
    const form = new FormData(e.currentTarget);
    const payload = {
      nome: form.get("nome"),
      endereco: form.get("endereco") || null,
      contatoNome: form.get("contatoNome") || null,
      contatoTelefone: form.get("contatoTelefone") || null,
      notas: form.get("notas") || null,
    };

    const res = await fetch(`/api/projects/${projectId}/locacoes/${locacao.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Não foi possível salvar.");
      return;
    }

    const data = await res.json();
    router.refresh();
    showAddressDuplicateWarning(projectId, locacao.id, data.possibleDuplicates, () => router.refresh());
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dados</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" name="nome" defaultValue={locacao.nome} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endereco">Endereço</Label>
            <Textarea id="endereco" name="endereco" defaultValue={locacao.endereco ?? ""} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="contatoNome">Contato</Label>
              <Input id="contatoNome" name="contatoNome" defaultValue={locacao.contatoNome ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contatoTelefone">Telefone do contato</Label>
              <Input id="contatoTelefone" name="contatoTelefone" defaultValue={locacao.contatoTelefone ?? ""} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              name="notas"
              placeholder="Estacionamento, restrições de horário, autorização..."
              defaultValue={locacao.notas ?? ""}
              rows={3}
            />
          </div>
          {error && <p className="text-sm text-erro-fg">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
