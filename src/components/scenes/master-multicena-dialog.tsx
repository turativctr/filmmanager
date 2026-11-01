"use client";

import { Layers } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

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
import { compareLocacaoNome } from "@/lib/locacao";

export type CenaCobrivel = { id: string; numero: string; set: string | null; locacao: string | null };

const SEM_LOCACAO = "Sem locação definida";

/** Cria um master de várias cenas (cena de produção M1, M2… com um plano master dentro) ou, com
 *  `master`, troca as cenas que um master existente cobre. As cenas vêm agrupadas por locação, com
 *  "marcar todas" por grupo — o caso típico é "todas as cenas na casa". */
export function MasterMulticenaDialog({
  projectId,
  cenas,
  master,
  trigger,
}: {
  projectId: string;
  /** Cenas ativas do roteiro, já em ordem natural de número. */
  cenas: CenaCobrivel[];
  /** Modo edição: o master e as cenas que ele cobre hoje. */
  master?: { id: string; numero: string; cobreIds: string[] };
  trigger?: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set(master?.cobreIds ?? []));
  const [salvando, setSalvando] = useState(false);

  const grupos = new Map<string, CenaCobrivel[]>();
  for (const cena of cenas) {
    const chave = cena.locacao ?? SEM_LOCACAO;
    grupos.set(chave, [...(grupos.get(chave) ?? []), cena]);
  }
  const gruposOrdenados = [...grupos.entries()].sort(([a], [b]) =>
    a === SEM_LOCACAO ? 1 : b === SEM_LOCACAO ? -1 : compareLocacaoNome(a, b)
  );

  function alternar(ids: string[], marcar: boolean) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (marcar) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function handleOpenChange(value: boolean) {
    setOpen(value);
    if (value) {
      setNome("");
      setSelecionadas(new Set(master?.cobreIds ?? []));
    }
  }

  async function salvar() {
    setSalvando(true);
    try {
      const res = master
        ? await fetch(`/api/projects/${projectId}/scenes/${master.id}/cobertura`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cenaIds: [...selecionadas] }),
          })
        : await fetch(`/api/projects/${projectId}/scenes/master`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome, cenaIds: [...selecionadas] }),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Erro ao salvar — tente novamente");
        return;
      }
      setOpen(false);
      if (master) {
        router.refresh();
      } else {
        toast.success(`Master ${data.numero} criado`);
        // Direto pro breakdown: é lá que se ajusta elenco, locação e o plano master.
        router.push(`/projects/${projectId}/scenes/${data.id}/breakdown`);
      }
    } catch (err) {
      console.error("Erro de rede ao salvar master:", err);
      toast.error("Erro ao salvar — tente novamente");
    } finally {
      setSalvando(false);
    }
  }

  const podeSalvar = selecionadas.size > 0 && (master || nome.trim() !== "");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Layers className="mr-2 h-4 w-4" />
            Master de várias cenas
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{master ? `Cenas cobertas pelo ${master.numero}` : "Novo master de várias cenas"}</DialogTitle>
          <DialogDescription>
            {master
              ? "Escolha as cenas do roteiro que este master cobre. Elenco e locação do master não mudam."
              : "Vira uma cena de produção (M1, M2…) com um plano master dentro, com elenco, locação e diária próprios. Elenco e figuração começam com tudo o que as cenas escolhidas têm; a locação, se for a mesma em todas. As cenas cobertas não mudam."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!master && (
            <div className="space-y-1.5">
              <Label htmlFor="master-nome">Nome</Label>
              <Input
                id="master-nome"
                placeholder="ex.: Master Casa"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
          )}

          {cenas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma cena do roteiro cadastrada ainda.</p>
          ) : (
            <div className="space-y-3">
              {gruposOrdenados.map(([locacao, doGrupo]) => {
                const ids = doGrupo.map((c) => c.id);
                const todas = ids.every((id) => selecionadas.has(id));
                const algumas = !todas && ids.some((id) => selecionadas.has(id));
                return (
                  <div key={locacao} className="rounded-md border p-3">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={todas ? true : algumas ? "indeterminate" : false}
                        onCheckedChange={(checked) => alternar(ids, checked === true)}
                      />
                      {locacao}
                      <span className="font-normal text-muted-foreground">
                        · {doGrupo.length} {doGrupo.length === 1 ? "cena" : "cenas"}
                      </span>
                    </label>
                    <div className="mt-2 grid grid-cols-1 gap-1 pl-6 sm:grid-cols-2">
                      {doGrupo.map((cena) => (
                        <label key={cena.id} className="flex min-w-0 items-center gap-2 text-sm">
                          <Checkbox
                            checked={selecionadas.has(cena.id)}
                            onCheckedChange={(checked) => alternar([cena.id], checked === true)}
                          />
                          <span className="shrink-0 font-medium">{cena.numero}</span>
                          <span className="truncate text-muted-foreground" title={cena.set ?? undefined}>
                            {cena.set ?? "—"}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={!podeSalvar || salvando}>
            {salvando ? "Salvando..." : master ? "Salvar" : `Criar master (${selecionadas.size} cenas)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
