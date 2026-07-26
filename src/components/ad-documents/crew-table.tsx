"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";

import { CrewMemberFormDialog } from "@/components/ad-documents/crew-member-form-dialog";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CrewMemberRow = {
  id: string;
  nome: string;
  funcao: string;
  departamento: string | null;
  telefone: string | null;
  email: string | null;
};

export function CrewTable({ projectId, crew }: { projectId: string; crew: CrewMemberRow[] }) {
  const router = useRouter();

  async function handleDelete(id: string) {
    await fetch(`/api/projects/${projectId}/crew-members/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Função</TableHead>
          <TableHead>Departamento</TableHead>
          <TableHead>Telefone</TableHead>
          <TableHead>Email</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {crew.map((member) => (
          <TableRow key={member.id}>
            <TableCell className="font-medium">{member.nome}</TableCell>
            <TableCell>{member.funcao}</TableCell>
            <TableCell>{member.departamento ?? "—"}</TableCell>
            <TableCell>{member.telefone ?? "—"}</TableCell>
            <TableCell>{member.email ?? "—"}</TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <CrewMemberFormDialog
                  projectId={projectId}
                  crewMember={member}
                  trigger={
                    <Button variant="ghost" size="icon" title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  }
                />
                <ConfirmDeleteDialog
                  title={`Remover ${member.nome}?`}
                  description="Essa ação não pode ser desfeita."
                  onConfirm={() => handleDelete(member.id)}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
