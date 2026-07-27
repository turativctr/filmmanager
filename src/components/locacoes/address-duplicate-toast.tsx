import { toast } from "sonner";

/** Aviso não-bloqueante ao salvar um endereço que coincide com o de outra locação do projeto —
 *  nunca unifica sozinho (duas locações podem legitimamente dividir endereço: prédio grande,
 *  andares diferentes). Só o caso comum (uma coincidência) oferece o atalho de unificar direto no
 *  toast; com mais de uma, só avisa (o AD unifica manualmente pela lista). */
export function showAddressDuplicateWarning(
  projectId: string,
  locacaoId: string,
  duplicates: { id: string; nome: string }[],
  onMerged: () => void
) {
  if (duplicates.length === 0) return;

  if (duplicates.length > 1) {
    toast.warning(
      `${duplicates.length} outras locações têm o mesmo endereço (${duplicates.map((d) => d.nome).join(", ")}). Confira na lista se vale unificar.`
    );
    return;
  }

  const [duplicate] = duplicates;

  toast.warning(`${duplicate.nome} tem o mesmo endereço. Unificar as duas?`, {
    duration: 10000,
    action: {
      label: "Unificar",
      onClick: async () => {
        const res = await fetch(`/api/projects/${projectId}/locacoes/merge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ survivorId: locacaoId, absorbedIds: [duplicate.id] }),
        });
        if (res.ok) {
          toast.success("Locações unificadas.");
          onMerged();
        } else {
          toast.error("Não foi possível unificar.");
        }
      },
    },
    cancel: { label: "Manter separadas", onClick: () => {} },
  });
}
