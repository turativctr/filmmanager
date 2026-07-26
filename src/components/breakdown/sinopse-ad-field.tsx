"use client";

import { toast } from "sonner";

import { TermTooltip } from "@/components/shared/term-tooltip";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { resolveSinopseAD } from "@/lib/scene-sinopse";

export function SinopseADField({
  projectId,
  sceneId,
  sinopseAD,
  sinopse,
}: {
  projectId: string;
  sceneId: string;
  sinopseAD: string | null;
  sinopse: string | null;
}) {
  const placeholder = resolveSinopseAD({ sinopseAD, sinopse });

  async function handleBlur(e: React.FocusEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    if (value === (sinopseAD ?? "")) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/scenes/${sceneId}/sinopse-ad`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sinopseAD: value === "" ? null : value }),
      });
      if (!res.ok) {
        toast.error("Erro ao salvar — tente novamente");
      }
    } catch {
      toast.error("Erro ao salvar — tente novamente");
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="sinopseAD" className="inline-flex items-center gap-1.5">
        Sinopse AD (Escaleta)
        <TermTooltip content="Frase operacional curta usada na Escaleta do AD e no Hora a Hora. Se deixada em branco, a sinopse do roteiro é usada, truncada em 80 caracteres." />
      </Label>
      <Textarea
        id="sinopseAD"
        defaultValue={sinopseAD ?? ""}
        placeholder={placeholder}
        onBlur={handleBlur}
      />
    </div>
  );
}
