"use client";

import { Card, CardContent } from "@/components/ui/card";

import type { PreviewScene, ProjectFormState } from "./types";

export function Step3Confirmacao({
  form,
  scenes,
}: {
  form: ProjectFormState;
  scenes: PreviewScene[] | null;
}) {
  const selected = scenes?.filter((s) => s.selected) ?? [];
  const personagens = new Set(selected.flatMap((s) => s.personagens));

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Confirmação final</h4>
      <Card>
        <CardContent className="space-y-1.5 p-4 text-sm">
          <p className="text-base font-semibold">{form.titulo || "(sem título)"}</p>
          <p className="text-muted-foreground">
            {[form.diretor, form.producao].filter(Boolean).join(" · ") || "Diretor/produção não informados"}
          </p>
          {(form.dataInicio || form.dataFim) && (
            <p className="text-muted-foreground">
              Filmagens: {form.dataInicio || "—"} até {form.dataFim || "—"}
            </p>
          )}
          {form.roteiristas && <p>Roteiro: {form.roteiristas}</p>}
          {(form.numeroDraft || form.dataDraft) && (
            <p className="text-muted-foreground">
              {[form.numeroDraft, form.dataDraft].filter(Boolean).join(" — ")}
            </p>
          )}
          {form.contatoProducao && <p className="text-muted-foreground">Contato: {form.contatoProducao}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 text-sm">
          {selected.length > 0 ? (
            <p>
              <span className="font-semibold">{selected.length}</span> cena(s) e{" "}
              <span className="font-semibold">{personagens.size}</span> personagem(ns) serão criados —
              todos ficam no Boneyard do Stripboard, prontos para agendar em diárias.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Nenhuma cena será criada. Você pode importar um roteiro ou cadastrar cenas manualmente
              depois de criar o projeto.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
