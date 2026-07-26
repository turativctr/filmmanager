"use client";

import {
  closestCenter,
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CharacterCategoriaBadge } from "@/components/cast/character-categoria-badge";
import { CharacterFormDialog } from "@/components/cast/character-form-dialog";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { naturalCompare } from "@/lib/natural-sort";

import type { CharacterCategoria } from "@prisma/client";

type SceneOption = { id: string; numero: string };

type CharacterRow = {
  id: string;
  idCurto: string;
  numeroElenco: number | null;
  categoria: CharacterCategoria;
  personagem: string;
  ator: string | null;
  idadePersonagem: number | null;
  scenes: { sceneId: string; scene: { numero: string } }[];
};

function SortableRow({
  character,
  projectId,
  scenes,
  posicao,
  onDelete,
}: {
  character: CharacterRow;
  projectId: string;
  scenes: SceneOption[];
  posicao: number;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: character.id,
  });
  const sceneNumbers = character.scenes.map((s) => s.scene.numero).sort(naturalCompare);

  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
    >
      <TableCell className="w-8">
        <button type="button" {...attributes} {...listeners} className="cursor-grab touch-none text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{posicao}</TableCell>
      <TableCell className="font-mono text-xs">{character.idCurto}</TableCell>
      <TableCell>
        <CharacterCategoriaBadge categoria={character.categoria} />
      </TableCell>
      <TableCell className="font-medium">{character.personagem}</TableCell>
      <TableCell>{character.ator ?? "—"}</TableCell>
      <TableCell>{character.idadePersonagem ?? "—"}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {sceneNumbers.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            sceneNumbers.map((numero) => (
              <Badge key={numero} variant="secondary">
                {numero}
              </Badge>
            ))
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <CharacterFormDialog
            projectId={projectId}
            scenes={scenes}
            character={character}
            trigger={
              <Button variant="ghost" size="icon" title="Editar personagem">
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />
          <ConfirmDeleteDialog
            title={`Excluir ${character.personagem}?`}
            description="Essa ação remove o personagem e seus vínculos com cenas. Não pode ser desfeita."
            onConfirm={() => onDelete(character.id)}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

export function CastTable({
  projectId,
  characters,
  scenes,
}: {
  projectId: string;
  characters: CharacterRow[];
  scenes: SceneOption[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(characters);
  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor));

  async function handleDelete(characterId: string) {
    await fetch(`/api/projects/${projectId}/characters/${characterId}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rows.findIndex((r) => r.id === active.id);
    const newIndex = rows.findIndex((r) => r.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(rows, oldIndex, newIndex);
    setRows(reordered);

    await fetch(`/api/projects/${projectId}/characters/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterIds: reordered.map((r) => r.id) }),
    });
    router.refresh();
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead />
            <TableHead>Nº</TableHead>
            <TableHead>ID curto</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Personagem</TableHead>
            <TableHead>Ator</TableHead>
            <TableHead>Idade</TableHead>
            <TableHead>Cenas</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            {rows.map((character, i) => (
              <SortableRow
                key={character.id}
                character={character}
                projectId={projectId}
                scenes={scenes}
                posicao={i + 1}
                onDelete={handleDelete}
              />
            ))}
          </SortableContext>
        </TableBody>
      </Table>
      <p className="px-4 py-2 text-xs text-muted-foreground">
        Arraste pelo ícone para reordenar — a posição aqui define a numeração usada quando o projeto está
        configurado para identificar o elenco por número (Editar projeto).
      </p>
    </DndContext>
  );
}
