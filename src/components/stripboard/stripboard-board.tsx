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

import { AlmocoMarker } from "@/components/stripboard/almoco-marker";
import { BoneyardSection } from "@/components/stripboard/boneyard-section";
import { DaySidebar } from "@/components/stripboard/day-sidebar";
import { ShootDayColumn } from "@/components/stripboard/shoot-day-column";
import { StripCard } from "@/components/stripboard/strip-card";
import { getCharacterId } from "@/lib/character-id";
import {
  computeAutoFillPrepMin,
  computeAutoFillRodMin,
  DEFAULT_PREP_MIN,
  validateAlmocoTiming,
} from "@/lib/schedule";

import {
  buildDayEntries,
  computeChanges,
  findContainer,
  getItems,
  isContainerId,
  setItems,
  splitDayEntries,
} from "./board-state";
import { almocoMarkerDayId, almocoMarkerId, dayContainerId, isAlmocoMarkerId } from "./types";
import type { BoardState, ContainerId, DayState, StripItem } from "./types";

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
  jornada,
}: {
  projectId: string;
  initialBoard: BoardState;
  characterMap: Record<string, { idCurto: string; numeroElenco: number | null; personagem: string }>;
  sistemaIdElenco: "ID_CURTO" | "NUMERACAO";
  projeto: { titulo: string; sigla: string | null };
  jornada: { limiteAlmocoMin: number; duracaoAlmocoMin: number };
}) {
  const [board, setBoard] = useState(initialBoard);
  const [activeItem, setActiveItem] = useState<StripItem | null>(null);
  const [activeMarkerDay, setActiveMarkerDay] = useState<DayState | null>(null);
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
    const id = String(event.active.id);

    if (isAlmocoMarkerId(id)) {
      const dayId = almocoMarkerDayId(id);
      setActiveMarkerDay(board.days.find((d) => d.id === dayId) ?? null);
      setActiveItem(null);
      return;
    }

    const container = findContainer(board, id);
    if (!container) return;
    setActiveItem(getItems(board, container).find((i) => i.sceneId === id) ?? null);
    setActiveMarkerDay(null);
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
    setActiveMarkerDay(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const draggingMarker = isAlmocoMarkerId(activeId);

    const sourceContainer = draggingMarker
      ? dayContainerId(almocoMarkerDayId(activeId))
      : findContainer(board, activeId);
    // O marcador nunca sai do próprio dia (não é um item de boneyard/outro dia) — soltar fora dele é um no-op.
    const destContainer = draggingMarker
      ? sourceContainer
      : isContainerId(overId)
        ? overId
        : findContainer(board, overId);

    if (!sourceContainer || !destContainer) return;
    if (sourceContainer === destContainer && overId === activeId) return;

    let nextBoard: BoardState;
    const touched = new Set<ContainerId>([sourceContainer, destContainer]);

    if (sourceContainer === destContainer) {
      // Reordenação dentro do mesmo dia (ou do Boneyard) — cenas e o marcador de almoço compartilham a
      // mesma lista sortable, então tratamos os dois casos (arrastar uma cena OU o próprio marcador)
      // pela mesma lista combinada de "entries", convertida de volta em (scenes, almocoIndex) depois.
      if (sourceContainer === "boneyard") {
        const items = board.boneyard;
        const oldIndex = items.findIndex((i) => i.sceneId === activeId);
        const newIndex = items.findIndex((i) => i.sceneId === overId);
        if (oldIndex === -1 || newIndex === -1) return;
        nextBoard = setItems(board, "boneyard", arrayMoveItems(items, oldIndex, newIndex));
      } else {
        const dayId = sourceContainer.split(":")[1];
        const day = board.days.find((d) => d.id === dayId);
        if (!day) return;
        const markerId = almocoMarkerId(dayId);
        const entries = buildDayEntries(day);
        const entryIds = entries.map((e) => (e.type === "scene" ? e.item.sceneId : markerId));
        const oldIndex = entryIds.indexOf(activeId);
        const newIndex = isContainerId(overId) ? entries.length - 1 : entryIds.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1) return;
        const { scenes, almocoIndex } = splitDayEntries(arrayMoveItems(entries, oldIndex, newIndex));
        nextBoard = { ...board, days: board.days.map((d) => (d.id === dayId ? { ...d, scenes, almocoIndex } : d)) };
      }
    } else {
      // Cross-container: o marcador nunca participa (bloqueado acima) — só cenas migram entre Boneyard
      // e dias, ou entre dois dias diferentes. almocoIndex do dia de origem/destino é ajustado conforme
      // a cena saiu/entrou antes ou depois do marcador, pra manter o mesmo boundary físico de itens.
      const sourceItems = getItems(board, sourceContainer);
      const destItems = getItems(board, destContainer);
      const movingItem = sourceItems.find((i) => i.sceneId === activeId);
      if (!movingItem) return;

      const newSourceItems = sourceItems.filter((i) => i.sceneId !== activeId);

      const destDayId = destContainer.startsWith("day:") ? destContainer.split(":")[1] : null;
      const destDay = destDayId ? board.days.find((d) => d.id === destDayId) : undefined;
      let insertIndex: number;
      if (destDay && overId === almocoMarkerId(destDayId!)) {
        insertIndex = destDay.almocoIndex;
      } else if (isContainerId(overId)) {
        insertIndex = destItems.length;
      } else {
        const idx = destItems.findIndex((i) => i.sceneId === overId);
        insertIndex = idx === -1 ? destItems.length : idx;
      }

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

      if (sourceContainer.startsWith("day:")) {
        const srcDayId = sourceContainer.split(":")[1];
        const srcOldIndex = sourceItems.findIndex((i) => i.sceneId === activeId);
        nextBoard = {
          ...nextBoard,
          days: nextBoard.days.map((d) =>
            d.id === srcDayId && srcOldIndex < d.almocoIndex ? { ...d, almocoIndex: d.almocoIndex - 1 } : d
          ),
        };
      }

      nextBoard = setItems(nextBoard, destContainer, newDestItems);

      if (destDayId) {
        nextBoard = {
          ...nextBoard,
          days: nextBoard.days.map((d) =>
            d.id === destDayId && insertIndex < d.almocoIndex ? { ...d, almocoIndex: d.almocoIndex + 1 } : d
          ),
        };
      }
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
                jornada={jornada}
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
          {activeMarkerDay && (
            <AlmocoMarker
              dayId={activeMarkerDay.id}
              almocoInicio={activeMarkerDay.almocoInicio}
              duracaoAlmocoMin={jornada.duracaoAlmocoMin}
              validation={validateAlmocoTiming(
                activeMarkerDay.chamadaGeral,
                activeMarkerDay.almocoInicio,
                jornada.limiteAlmocoMin
              )}
              draggable={false}
            />
          )}
        </DragOverlay>
      </DndContext>
    </>
  );
}
