"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CrewMemberDefaults = {
  id: string;
  nome: string;
  funcao: string;
  departamento: string | null;
  telefone: string | null;
  email: string | null;
};

export function CrewMemberFormDialog({
  projectId,
  crewMember,
  trigger,
}: {
  projectId: string;
  crewMember?: CrewMemberDefaults;
  trigger?: ReactNode;
}) {
  const router = useRouter();
  const isEdit = Boolean(crewMember);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      nome: form.get("nome"),
      funcao: form.get("funcao"),
      departamento: form.get("departamento") || undefined,
      telefone: form.get("telefone") || undefined,
      email: form.get("email") || undefined,
    };

    const url = isEdit
      ? `/api/projects/${projectId}/crew-members/${crewMember!.id}`
      : `/api/projects/${projectId}/crew-members`;

    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error?.formErrors?.[0] ?? data.error ?? "Não foi possível salvar.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo membro da equipe
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Editar ${crewMember!.nome}` : "Novo membro da equipe"}</DialogTitle>
          <DialogDescription>Preencha os dados de contato.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" name="nome" defaultValue={crewMember?.nome} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="funcao">Função</Label>
              <Input
                id="funcao"
                name="funcao"
                placeholder="ex.: Diretor de Fotografia"
                defaultValue={crewMember?.funcao}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="departamento">Departamento</Label>
            <Input id="departamento" name="departamento" defaultValue={crewMember?.departamento ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" name="telefone" defaultValue={crewMember?.telefone ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={crewMember?.email ?? ""} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : isEdit ? "Salvar alterações" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
