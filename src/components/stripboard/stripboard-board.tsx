"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { BoneyardSection } from "@/components/stripboard/boneyard-section";
import { DaySidebar } from "@/components/stripboard/day-sidebar";
import { ShootDayColumn } from "@/components/stripboard/shoot-day-column";
import { StripCard } from "@/components/stripboard/strip-card";
import { getCharacterId } from "@/lib/character-id";
import { computeAutoFillPrepMin, computeAutoFillRodMin, DEFAULT_PREP_MIN } from "@/lib/schedule";

import {
  computeChanges,
  findContainer,
  getItems,
  isContainerId,
  setItems,
} from "./board-state";
import { dayContainerId } from "./types";
import type { BoardState, ContainerId, StripItem } from "./types";

function arrayMoveItems<T>(items: T[], from: number, to: number): T[] {
  const copy = items.slice();
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}

export function StripboardBoard({
  projectId,
  initialBoard,
  characterMap,
  sistemaIdElenco,
  projeto,
}: {
  projectId: string;
  initialBoard: BoardState;
  characterMap: Record<string, { idCurto: string; numeroElenco: number | null; personagem: string }>;
  sistemaIdElenco: "ID_CURTO" | "NUMERACAO";
  projeto: { titulo: string; sigla: string | null };
}) {
  const [board, setBoard] = useState(initialBoard);
  const [activeItem, setActiveItem] = useState<StripItem | null>(null);
  const initialBoardRef = useRef(initialBoard);

  // dnd-kit gera ids de acessibilidade (aria-describedby) sequenciais que divergem
  // entre a renderização no servidor e a hidratação no cliente, quebrando os
  // event handlers das tiras. Renderizar o board só depois do mount evita o
  // mismatch por completo (não há HTML de servidor pra comparar).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (initialBoard !== initialBoardRef.current) {
      setBoard(initialBoard);
      initialBoardRef.current = initialBoard;
    }
  }, [initialBoard]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  function handleDragStart(event: DragStartEvent) {
    const sceneId = String(event.active.id);
    const container = findContainer(board, sceneId);
    if (!container) return;
    const item = getItems(board, container).find((i) => i.sceneId === sceneId);
    setActiveItem(item ?? null);
  }

  async function persistChanges(nextBoard: BoardState, containers: ContainerId[], previousBoard: BoardState) {
    const changes = computeChanges(nextBoard, containers);
    try {
      const res = await fetch(`/api/projects/${projectId}/stripboard/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });
      if (!res.ok) {
        console.error("Falha ao salvar mudanças do Stripboard:", res.status, await res.text().catch(() => ""));
        toast.error("Erro ao salvar — tente novamente");
        setBoard(previousBoard);
      }
    } catch (err) {
      console.error("Erro de rede ao salvar mudanças do Stripboard:", err);
      toast.error("Erro ao salvar — tente novamente");
      setBoard(previousBoard);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveItem(null);
    if (!over) return;

    const activeSceneId = String(active.id);
    const overId = String(over.id);

    const sourceContainer = findContainer(board, activeSceneId);
    const destContainer = isContainerId(overId) ? overId : findContainer(board, overId);
    if (!sourceContainer || !destContainer) return;
    if (sourceContainer === destContainer && overId === activeSceneId) return;

    let nextBoard: BoardState;
    const touched = new Set<ContainerId>([sourceContainer, destContainer]);

    if (sourceContainer === destContainer) {
      const items = getItems(board, sourceContainer);
      const oldIndex = items.findIndex((i) => i.sceneId === activeSceneId);
      const newIndex = isContainerId(overId) ? items.length - 1 : items.findIndex((i) => i.sceneId === overId);
      if (oldIndex === -1 || newIndex === -1) return;
      nextBoard = setItems(board, sourceContainer, arrayMoveItems(items, oldIndex, newIndex));
    } else {
      const sourceItems = getItems(board, sourceContainer);
      const destItems = getItems(board, destContainer);
      const movingItem = sourceItems.find((i) => i.sceneId === activeSceneId);
      if (!movingItem) return;

      const newSourceItems = sourceItems.filter((i) => i.sceneId !== activeSceneId);
      const rawIndex = isContainerId(overId) ? destItems.length : destItems.findIndex((i) => i.sceneId === overId);
      const insertIndex = rawIndex === -1 ? destItems.length : rawIndex;

      // Ao entrar num dia vindo do Boneyard, preenche Prep/Rod automaticamente — Rod pelo tempo estimado
      // da cena, Prep por comparação de set/locação com a cena anterior do bloco (0min se igual, já montado).
      const itemToInsert: StripItem =
        sourceContainer === "boneyard" && destContainer.startsWith("day:")
          ? {
              ...movingItem,
              prepMin: computeAutoFillPrepMin(destItems[insertIndex - 1]?.scene, movingItem.scene, DEFAULT_PREP_MIN),
              rodMin: computeAutoFillRodMin(movingItem.scene.tempoEstimadoMin),
            }
          : movingItem;

      const newDestItems = [
        ...destItems.slice(0, insertIndex),
        itemToInsert,
        ...destItems.slice(insertIndex),
      ];

      nextBoard = setItems(board, sourceContainer, newSourceItems);
      nextBoard = setItems(nextBoard, destContainer, newDestItems);
    }

    // Um dia sempre recalcula os dois blocos juntos, pra manter a sequência de `ordem` consistente.
    for (const container of Array.from(touched)) {
      if (container === "boneyard") continue;
      const dayId = container.split(":")[1];
      touched.add(dayContainerId(dayId, "MANHA"));
      touched.add(dayContainerId(dayId, "TARDE"));
    }

    const previousBoard = board;
    setBoard(nextBoard);
    persistChanges(nextBoard, Array.from(touched), previousBoard);
  }

  function handleUpdateTimes(sceneId: string, prepMin: number | null, rodMin: number | null) {
    const container = findContainer(board, sceneId);
    if (!container) return;

    const items = getItems(board, container).map((item) =>
      item.sceneId === sceneId ? { ...item, prepMin, rodMin } : item
    );
    const previousBoard = board;
    const nextBoard = setItems(board, container, items);
    setBoard(nextBoard);
    persistChanges(nextBoard, [container], previousBoard);
  }

  if (!mounted) {
    return (
      <div className="flex gap-6">
        <DaySidebar projectId={projectId} days={board.days} />
        <div className="flex-1 space-y-4">
          <p className="text-sm text-muted-foreground">Carregando stripboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <DndContext
        id="stripboard"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6">
          <DaySidebar projectId={projectId} days={board.days} />
          <div className="flex-1 space-y-4">
            {board.days.map((day) => (
              <ShootDayColumn
                key={day.id}
                projectId={projectId}
                day={day}
                characterMap={characterMap}
                sistemaIdElenco={sistemaIdElenco}
                projeto={projeto}
                onUpdateTimes={handleUpdateTimes}
              />
            ))}
            <BoneyardSection
              projectId={projectId}
              items={board.boneyard}
              characterMap={characterMap}
              sistemaIdElenco={sistemaIdElenco}
              onUpdateTimes={handleUpdateTimes}
            />
          </div>
        </div>

        <DragOverlay>
          {activeItem && (
            <StripCard
              item={activeItem}
              characterLabels={activeItem.scene.characterIds.map((id) => {
                const c = characterMap[id];
                return c ? getCharacterId(c, { sistemaIdElenco }) : id;
              })}
            />
          )}
        </DragOverlay>
      </DndContext>
    </>
  );
}
