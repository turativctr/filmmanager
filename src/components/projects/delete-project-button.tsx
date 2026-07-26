"use client";

import { useRouter } from "next/navigation";

import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";

export function DeleteProjectButton({
  projectId,
  projectTitulo,
  redirectTo,
}: {
  projectId: string;
  projectTitulo: string;
  /** Se informado, navega pra cá após excluir (usado na página do projeto). Sem isso, só atualiza a lista. */
  redirectTo?: string;
}) {
  const router = useRouter();

  async function handleConfirm() {
    await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.refresh();
    }
  }

  return (
    <ConfirmDeleteDialog
      title={`Excluir "${projectTitulo}"?`}
      description="Isso apaga o projeto inteiro — cenas, elenco, cronograma, orçamento e todos os documentos gerados. Não pode ser desfeito."
      onConfirm={handleConfirm}
    />
  );
}
