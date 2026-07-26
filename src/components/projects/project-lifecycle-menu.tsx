"use client";

import type { ProjectStatus } from "@prisma/client";
import { Archive, ArchiveRestore, CheckCircle2, MoreVertical, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProjectLifecycleMenu({
  projectId,
  status,
  arquivado,
}: {
  projectId: string;
  status: ProjectStatus;
  arquivado: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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

  return (
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
