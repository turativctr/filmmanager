"use client";

import Image from "next/image";
import { Settings, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { TermTooltip } from "@/components/shared/term-tooltip";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { computeSiglaFromTitulo } from "@/lib/filename";

type ProjectDefaults = {
  id: string;
  titulo: string;
  diretor: string | null;
  producao: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  equipeTecnica: number | null;
  logoUrl: string | null;
  sistemaIdElenco: "ID_CURTO" | "NUMERACAO";
  sigla: string | null;
  continuismoResponsavel: string;
  continuismoUsarLogo: boolean;
  continuismoLinhasPorFolha: number;
  limiteAlmocoMin: number;
  duracaoAlmocoMin: number;
  preparacaoInicialMin: number;
};

export function EditProjectDialog({ project }: { project: ProjectDefaults }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState(project.logoUrl);
  const [logoBusy, setLogoBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [continuismoUsarLogo, setContinuismoUsarLogo] = useState(project.continuismoUsarLogo);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      titulo: form.get("titulo"),
      diretor: form.get("diretor") || undefined,
      producao: form.get("producao") || undefined,
      dataInicio: form.get("dataInicio") || undefined,
      dataFim: form.get("dataFim") || undefined,
      equipeTecnica: form.get("equipeTecnica") || undefined,
      sistemaIdElenco: form.get("sistemaIdElenco") || undefined,
      sigla: form.get("sigla") || null,
      continuismoResponsavel: form.get("continuismoResponsavel") || undefined,
      continuismoUsarLogo,
      continuismoLinhasPorFolha: form.get("continuismoLinhasPorFolha") || undefined,
      limiteAlmocoMin: form.get("limiteAlmocoMin") || undefined,
      duracaoAlmocoMin: form.get("duracaoAlmocoMin") || undefined,
      preparacaoInicialMin: form.get("preparacaoInicialMin") || undefined,
    };

    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Não foi possível salvar o projeto.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoBusy(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/projects/${project.id}/logo`, { method: "POST", body: formData });
    setLogoBusy(false);
    if (res.ok) {
      const data = await res.json();
      setLogoUrl(data.logoUrl);
      router.refresh();
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleRemoveLogo() {
    setLogoBusy(true);
    await fetch(`/api/projects/${project.id}/logo`, { method: "DELETE" });
    setLogoBusy(false);
    setLogoUrl(null);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Editar projeto">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar projeto</DialogTitle>
          <DialogDescription>Dados básicos e configurações do projeto.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Logo da produtora</Label>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <Image src={logoUrl} alt="Logo" width={48} height={48} className="rounded border object-contain" unoptimized />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded border text-[10px] text-muted-foreground">
                  Sem logo
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleLogoChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={logoBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {logoUrl ? "Trocar" : "Enviar"}
              </Button>
              {logoUrl && (
                <Button type="button" variant="ghost" size="sm" disabled={logoBusy} onClick={handleRemoveLogo}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Remover
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              PNG, JPG ou WEBP, até 2MB. Sem logo, o header da Call Sheet mostra só o nome da produtora.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="titulo">Título</Label>
            <Input id="titulo" name="titulo" defaultValue={project.titulo} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sigla" className="inline-flex items-center gap-1.5">
              Sigla do projeto
              <TermTooltip content="Usada no nome dos arquivos gerados. Gerada automaticamente a partir do título, mas você pode personalizar." />
            </Label>
            <Input
              id="sigla"
              name="sigla"
              maxLength={10}
              placeholder={computeSiglaFromTitulo(project.titulo)}
              defaultValue={project.sigla ?? ""}
              onChange={(e) => {
                e.target.value = e.target.value.replace(/\s/g, "");
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="diretor">Diretor</Label>
              <Input id="diretor" name="diretor" defaultValue={project.diretor ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="producao">Produção</Label>
              <Input id="producao" name="producao" defaultValue={project.producao ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dataInicio">Início das filmagens</Label>
              <Input
                id="dataInicio"
                name="dataInicio"
                type="date"
                defaultValue={project.dataInicio?.slice(0, 10) ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dataFim">Fim das filmagens</Label>
              <Input
                id="dataFim"
                name="dataFim"
                type="date"
                defaultValue={project.dataFim?.slice(0, 10) ?? ""}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="equipeTecnica">Equipe técnica (headcount fixo)</Label>
            <Input
              id="equipeTecnica"
              name="equipeTecnica"
              type="number"
              min={0}
              defaultValue={project.equipeTecnica ?? ""}
            />
            <p className="text-xs text-muted-foreground">
              Usado na contagem de refeições do DOOD.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sistemaIdElenco">Sistema de identificação do elenco</Label>
            <Select name="sistemaIdElenco" defaultValue={project.sistemaIdElenco}>
              <SelectTrigger id="sistemaIdElenco">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ID_CURTO">ID Curto (ex.: PRO, CHEF)</SelectItem>
                <SelectItem value="NUMERACAO">Numeração (ex.: 1, 2, 3 — ordem definida em Elenco)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Define como o elenco é identificado nos documentos gerados (Call Sheet, Escaleta, etc.).
            </p>
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Jornada</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="limiteAlmocoMin" className="inline-flex items-center gap-1.5">
                  Limite para o almoço
                  <TermTooltip content="Tempo máximo entre a chamada geral e o início do intervalo. Praxe do mercado: 5 a 6 horas." />
                </Label>
                <Input
                  id="limiteAlmocoMin"
                  name="limiteAlmocoMin"
                  type="number"
                  min={1}
                  defaultValue={project.limiteAlmocoMin}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="duracaoAlmocoMin" className="inline-flex items-center gap-1.5">
                  Duração do intervalo
                  <TermTooltip content="Tempo total que o almoço ocupa no cronograma. A praxe conta 1 hora a partir do momento em que o último da equipe se serve — se a fila costuma demorar, considere somar esse tempo aqui." />
                </Label>
                <Input
                  id="duracaoAlmocoMin"
                  name="duracaoAlmocoMin"
                  type="number"
                  min={1}
                  defaultValue={project.duracaoAlmocoMin}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preparacaoInicialMin" className="inline-flex items-center gap-1.5">
                  Preparação inicial
                  <TermTooltip content="Tempo entre a chamada geral e o início da primeira cena." />
                </Label>
                <Input
                  id="preparacaoInicialMin"
                  name="preparacaoInicialMin"
                  type="number"
                  min={0}
                  defaultValue={project.preparacaoInicialMin}
                />
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Boletim de Continuísmo</h4>
            <div className="space-y-1.5">
              <Label htmlFor="continuismoResponsavel">Responsável</Label>
              <Input
                id="continuismoResponsavel"
                name="continuismoResponsavel"
                defaultValue={project.continuismoResponsavel}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={continuismoUsarLogo} onCheckedChange={(v) => setContinuismoUsarLogo(Boolean(v))} />
              Usar logo do projeto no cabeçalho
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="continuismoLinhasPorFolha">Linhas por folha</Label>
              <Input
                id="continuismoLinhasPorFolha"
                name="continuismoLinhasPorFolha"
                type="number"
                min={6}
                max={30}
                defaultValue={project.continuismoLinhasPorFolha}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
