"use client";

import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { TermTooltip } from "@/components/shared/term-tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { parsePaginas } from "@/lib/paginas";
import {
  formatOitavos,
  mensagemDivisaoNaoFecha,
  mensagemProblemaDivisao,
  validarDivisao,
} from "@/lib/scene-parts-shared";

import type { DivisaoDaCena } from "@/lib/scene-parts";

type Rascunho = { id?: string; rotulo: string; oitavosTexto: string };

/** Oitavos digitados no mesmo formato das páginas ("5/8", "1 2/8", "0"); null = inválido. */
function lerOitavos(texto: string): number | null {
  const paginas = parsePaginas(texto);
  return paginas === null ? null : Math.round(paginas * 8);
}

function paraRascunho(d: DivisaoDaCena): Rascunho[] {
  if (d.partes.length > 0) {
    return d.partes.map((p) => ({ id: p.id, rotulo: p.rotulo, oitavosTexto: formatOitavos(p.oitavos) }));
  }
  // Sugestão inicial: a cena inteira na primeira parte, a segunda vazia (ex.: voice off, 0 oitavos).
  return [
    { rotulo: "Imagem", oitavosTexto: formatOitavos(d.oitavosCena) },
    { rotulo: "Voice off", oitavosTexto: "0" },
  ];
}

/** Dividir a MESMA cena entre diárias (ex.: imagem numa, voice off em outra). Cena sem divisão não
 *  mostra nada além do botão — a parte é implícita. A soma dos oitavos das partes tem que fechar
 *  com a cena: a tela mostra a conta ao vivo e a API barra se não fechar. */
export function SceneDivisionPanel({
  projectId,
  sceneId,
  sceneNumero,
  divisao,
}: {
  projectId: string;
  sceneId: string;
  sceneNumero: string;
  divisao: DivisaoDaCena;
}) {
  const router = useRouter();
  const dividida = divisao.partes.length > 0;
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [rascunho, setRascunho] = useState<Rascunho[]>([]);

  useEffect(() => {
    if (!editando) setRascunho(paraRascunho(divisao));
  }, [divisao, editando]);

  const lidas = rascunho.map((r) => ({ rotulo: r.rotulo, oitavos: lerOitavos(r.oitavosTexto) }));
  const algumInvalido = lidas.some((l) => l.oitavos === null);
  const partesValidas = lidas.map((l) => ({ rotulo: l.rotulo, oitavos: l.oitavos ?? 0 }));
  const soma = partesValidas.reduce((s, p) => s + p.oitavos, 0);
  const problemas = algumInvalido ? [] : validarDivisao(divisao.oitavosCena, partesValidas);

  async function salvar() {
    setSalvando(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/scenes/${sceneId}/parts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partes: rascunho.map((r, i) => ({ id: r.id, rotulo: r.rotulo.trim(), oitavos: partesValidas[i].oitavos })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Erro ao salvar — tente novamente");
        return;
      }
      setEditando(false);
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  async function desfazer() {
    setSalvando(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/scenes/${sceneId}/parts`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Erro ao salvar — tente novamente");
        return;
      }
      setEditando(false);
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-base">
          Divisão entre diárias
          <TermTooltip content="Quando a MESMA cena é filmada em mais de uma diária — por exemplo, a imagem numa e o voice off em outra. Cada parte tem um rótulo e a sua fatia dos oitavos da cena; a soma tem que ser igual aos oitavos da cena, pra página nunca contar duas vezes." />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {divisao.naoFecha && (
          <p className="flex items-start gap-1.5 font-semibold text-alerta-fg">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {mensagemDivisaoNaoFecha(divisao.oitavosCena, divisao.partes)}
          </p>
        )}

        {!editando && !dividida && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-muted-foreground">
              Cena inteira ({formatOitavos(divisao.oitavosCena)}) — filmada numa diária só.
            </span>
            <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
              Dividir cena
            </Button>
          </div>
        )}

        {!editando && dividida && (
          <div className="space-y-2">
            <ul className="space-y-1">
              {divisao.partes.map((p) => (
                <li key={p.id} className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">
                    {sceneNumero} · {p.rotulo}
                  </span>
                  <span className="text-muted-foreground">{formatOitavos(p.oitavos)}</span>
                  <span className="text-muted-foreground">
                    {p.numeroDia != null ? `diária ${p.numeroDia}` : "sem diária (no Boneyard)"}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
                Editar divisão
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void desfazer()} disabled={salvando}>
                Desfazer divisão
              </Button>
            </div>
          </div>
        )}

        {editando && (
          <div className="space-y-2">
            {rascunho.map((r, i) => (
              <div key={r.id ?? `nova-${i}`} className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label={`Rótulo da parte ${i + 1}`}
                  className="h-8 w-44"
                  maxLength={30}
                  placeholder="Ex.: Voice off"
                  value={r.rotulo}
                  onChange={(e) =>
                    setRascunho((prev) => prev.map((x, j) => (j === i ? { ...x, rotulo: e.target.value } : x)))
                  }
                />
                <Input
                  aria-label={`Oitavos da parte ${i + 1}`}
                  className="h-8 w-20"
                  placeholder="3/8"
                  value={r.oitavosTexto}
                  onChange={(e) =>
                    setRascunho((prev) => prev.map((x, j) => (j === i ? { ...x, oitavosTexto: e.target.value } : x)))
                  }
                />
                {lidas[i].oitavos === null && <span className="text-xs text-erro-fg">use 3/8, 1 2/8 ou 0</span>}
                {rascunho.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Remover parte ${i + 1}`}
                    onClick={() => setRascunho((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRascunho((prev) => [...prev, { rotulo: "", oitavosTexto: "0" }])}
            >
              <Plus className="mr-1 h-4 w-4" />
              Adicionar parte
            </Button>

            <p className={problemas.some((p) => p.tipo === "SOMA_NAO_FECHA") ? "font-semibold text-erro-fg" : "text-muted-foreground"}>
              Soma das partes: {formatOitavos(soma)} de {formatOitavos(divisao.oitavosCena)}
            </p>
            {problemas.map((p, i) => (
              <p key={i} className="text-xs text-erro-fg">
                {mensagemProblemaDivisao(p, partesValidas)}
              </p>
            ))}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void salvar()} disabled={salvando || algumInvalido || problemas.length > 0}>
                Salvar divisão
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditando(false);
                  setRascunho(paraRascunho(divisao));
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
