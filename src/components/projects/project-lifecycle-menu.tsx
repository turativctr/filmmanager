"use client";

import type { ProjectStatus } from "@prisma/client";
import { Archive, ArchiveRestore, CheckCircle2, MoreVertical, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProjectLifecycleMenu({
  projectId,
  status,
  arquivado,
  // "Excluir projeto" só entra no menu quando essas duas props vêm preenchidas — usado no
  // cabeçalho da página do projeto (que perdeu a lixeira solta), NÃO no card da lista de
  // projetos (que mantém seu próprio ícone de excluir separado, fora do escopo deste ajuste).
  projectTitulo,
  deleteRedirectTo,
}: {
  projectId: string;
  status: ProjectStatus;
  arquivado: boolean;
  projectTitulo?: string;
  deleteRedirectTo?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const showDeleteItem = !!projectTitulo;

  async function patch(payload: Record<string, unknown>) {
    setLoading(true);
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    router.refresh();
  }

  async function handleDelete() {
    await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    if (deleteRedirectTo) {
      router.push(deleteRedirectTo);
    } else {
      router.refresh();
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" disabled={loading} title="Ações do projeto">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status === "ATIVO" ? (
            <DropdownMenuItem onClick={() => patch({ status: "CONCLUIDO" })}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Marcar como concluído
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => patch({ status: "ATIVO" })}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reabrir projeto
            </DropdownMenuItem>
          )}
          {arquivado ? (
            <DropdownMenuItem onClick={() => patch({ arquivado: false })}>
              <ArchiveRestore className="mr-2 h-4 w-4" />
              Desarquivar projeto
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => patch({ arquivado: true })}>
              <Archive className="mr-2 h-4 w-4" />
              Arquivar projeto
            </DropdownMenuItem>
          )}
          {showDeleteItem && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-erro-fg focus:bg-erro-bg focus:text-erro-fg"
                onSelect={(e) => {
                  e.preventDefault();
                  setShowDeleteConfirm(true);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir projeto
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {showDeleteItem && (
        <ConfirmDeleteDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          title={`Excluir "${projectTitulo}"?`}
          description="Isso apaga o projeto inteiro — cenas, elenco, cronograma, orçamento e todos os documentos gerados. Não pode ser desfeito."
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}
