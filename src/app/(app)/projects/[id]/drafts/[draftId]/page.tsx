import { AlertTriangle } from "lucide-react";
import { notFound } from "next/navigation";

import { DownloadButton } from "@/components/reports/download-button";
import { Card, CardContent } from "@/components/ui/card";
import { getScriptDraftDetail, type DraftDiffRow } from "@/lib/draft-report-data";
import { gerarNomeArquivo } from "@/lib/filename";
import { naturalCompare } from "@/lib/natural-sort";
import { formatPaginas } from "@/lib/paginas";
import { diffSinopse } from "@/lib/script-diff";
import { cn } from "@/lib/utils";

const PERIODO_LABEL: Record<string, string> = {
  DIA: "Dia",
  NOITE: "Noite",
  ENTARDECER: "Entardecer",
  AMANHECER: "Amanhecer",
  CONTINUO: "Contínuo",
  DEPOIS: "Depois",
};

const TIPO_LABEL: Record<DraftDiffRow["tipo"], string> = {
  ADICIONADA: "Nova",
  REMOVIDA: "Omitida",
  MODIFICADA: "Modificada",
};

const TIPO_CLASSES: Record<DraftDiffRow["tipo"], string> = {
  ADICIONADA: "bg-emerald-100 text-emerald-800 border-emerald-300",
  REMOVIDA: "bg-red-100 text-red-800 border-red-300",
  MODIFICADA: "bg-amber-100 text-amber-800 border-amber-300",
};

function FieldChange({ campo, antes, depois }: { campo: string; antes: unknown; depois: unknown }) {
  if (campo === "sinopse") {
    const parts = diffSinopse(typeof antes === "string" ? antes : "", typeof depois === "string" ? depois : "");
    return (
      <p className="text-sm">
        <span className="font-semibold">Sinopse: </span>
        {parts.map((p, i) =>
          p.tipo === "removido" ? (
            <span key={i} className="text-destructive line-through">
              {p.texto}
            </span>
          ) : p.tipo === "adicionado" ? (
            <span key={i} className="font-semibold text-emerald-700">
              {p.texto}
            </span>
          ) : (
            <span key={i}>{p.texto}</span>
          )
        )}
      </p>
    );
  }

  const format = (v: unknown) => (Array.isArray(v) ? v.join(", ") : v == null || v === "" ? "—" : String(v));
  return (
    <p className="text-sm">
      <span className="font-semibold">{campo}: </span>
      <span className="text-destructive line-through">{format(antes)}</span>{" "}
      <span className="text-muted-foreground">→</span>{" "}
      <span className="font-semibold text-emerald-700">{format(depois)}</span>
    </p>
  );
}

export default async function DraftDetailPage({ params }: { params: { id: string; draftId: string } }) {
  const detail = await getScriptDraftDetail(params.id, params.draftId);
  if (!detail) notFound();

  const { draft, diffs, impacts } = detail;
  const sorted = [...diffs].sort((a, b) => naturalCompare(a.numero, b.numero));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            Draft {draft.numero} — {draft.corRevisao}
          </h2>
          <p className="text-sm text-muted-foreground">
            {[draft.numeroDraft, draft.dataDraft].filter(Boolean).join(" · ") ||
              new Date(draft.importedAt).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <DownloadButton
          url={`/api/projects/${params.id}/drafts/${draft.id}/pdf`}
          filename={gerarNomeArquivo({
            projeto: detail.project,
            tipo: "PaginasAlteradas",
            variante: `Draft${draft.numero}${draft.corRevisao}`,
            ext: "pdf",
          })}
          label="Páginas Alteradas (PDF)"
        />
      </div>

      {impacts.length > 0 && (
        <Card className="border-destructive">
          <CardContent className="space-y-1.5 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4" /> Impactos no agendamento
            </p>
            {impacts.map((impact, i) => (
              <p key={i} className="text-sm text-destructive">
                Diária {impact.numeroDia}: {impact.motivo}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Versão original — sem alterações registradas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((diff) => (
            <Card key={diff.numero}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">Cena {diff.numero}</h3>
                  <span
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-xs font-semibold",
                      TIPO_CLASSES[diff.tipo]
                    )}
                  >
                    {TIPO_LABEL[diff.tipo]}
                  </span>
                </div>

                {diff.tipo === "REMOVIDA" && (
                  <p className="text-sm text-muted-foreground">Cena removida do roteiro nesta revisão.</p>
                )}

                {diff.tipo === "ADICIONADA" && diff.scene && (
                  <div className="space-y-1 text-sm">
                    <p className="text-muted-foreground">
                      {diff.scene.tipo ?? "—"} ·{" "}
                      {diff.scene.periodo ? PERIODO_LABEL[diff.scene.periodo] ?? diff.scene.periodo : "—"} ·{" "}
                      {diff.scene.locacao || diff.scene.set || "—"} · {formatPaginas(diff.scene.paginas)}
                    </p>
                    <p>{diff.scene.sinopse || "Sem sinopse."}</p>
                    <p className="text-muted-foreground">
                      <span className="font-semibold">Elenco: </span>
                      {diff.scene.cast.length > 0 ? diff.scene.cast.map((c) => c.idCurto).join(", ") : "—"}
                    </p>
                  </div>
                )}

                {diff.tipo === "MODIFICADA" && diff.camposAlterados && (
                  <div className="space-y-1">
                    {Object.entries(diff.camposAlterados).map(([campo, change]) => (
                      <FieldChange key={campo} campo={campo} antes={change.antes} depois={change.depois} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
