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

import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { AlmocoMarker } from "@/components/stripboard/almoco-marker";
import { BoneyardSection } from "@/components/stripboard/boneyard-section";
import { DaySidebar } from "@/components/stripboard/day-sidebar";
import { ShootDayColumn } from "@/components/stripboard/shoot-day-column";
import { StripCard } from "@/components/stripboard/strip-card";
import { getCharacterId } from "@/lib/character-id";
import { numeroComParte } from "@/lib/scene-parts-shared";
import { temExecucao } from "@/lib/scene-shoot-day-fields";
import { STATUS_LABEL } from "@/lib/scene-progress";
import {
  computeAutoFillPrepMin,
  computeAutoFillRodMin,
  DEFAULT_PREP_MIN,
  validateAlmocoTiming,
} from "@/lib/schedule";

import {
  buildDayEntries,
  computeChanges,
  dayEntryId,
  findContainer,
  getItems,
  isContainerId,
  splitDayEntries,
} from "./board-state";
import { almocoMarkerDayId, cenasDoDia, dayContainerId, isAlmocoMarkerId, isBlocoItemId } from "./types";
import type { BoardState, ContainerId, DayState, StripItem } from "./types";

/** Registro do que já aconteceu com a cena NESTA diária. Tirar a tira daqui apaga isso, então o
 *  quadro pergunta antes — reordenar dentro do mesmo dia nunca passa por aqui. */
function descreverExecucao(item: StripItem): string | null {
  const e = item.execucao;
  if (!e || !temExecucao(e)) return null;
  const horas = [e.horaInicioReal, e.horaFimReal].filter(Boolean).join(" às ");
  const partes = [STATUS_LABEL[e.status]];
  if (horas) partes.push(horas);
  return partes.join(" · ");
}

function setBoneyard(board: BoardState, boneyard: StripItem[]): BoardState {
  return { ...board, boneyard };
}

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
  locacoes,
}: {
  projectId: string;
  initialBoard: BoardState;
  characterMap: Record<string, { idCurto: string; numeroElenco: number | null; personagem: string }>;
  sistemaIdElenco: "ID_CURTO" | "NUMERACAO";
  projeto: { titulo: string; sigla: string | null };
  jornada: { limiteAlmocoMin: number; duracaoAlmocoMin: number };
  /** Locações do projeto, pro filtro do Boneyard. */
  locacoes: { id: string; nome: string }[];
}) {
  const [board, setBoard] = useState(initialBoard);
  const [activeItem, setActiveItem] = useState<StripItem | null>(null);
  const [activeMarkerDay, setActiveMarkerDay] = useState<DayState | null>(null);
  /** Movimento que apaga registro de execução, esperando confirmação da AD. */
  const [movimentoARevisar, setMovimentoARevisar] = useState<{
    aviso: string;
    aplicar: () => void;
  } | null>(null);
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
    // Bloco de tempo não tem cartão fantasma — o próprio item acompanha o arraste.
    setActiveItem(getItems(board, container).find((i) => i.itemId === id) ?? null);
    setActiveMarkerDay(null);
  }

  async function persistChanges(nextBoard: BoardState, containers: ContainerId[], previousBoard: BoardState) {
    const { changes, blocos } = computeChanges(nextBoard, containers);
    try {
      const res = await fetch(`/api/projects/${projectId}/stripboard/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes, blocos }),
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

  function withDay(b: BoardState, dayId: string, patch: Partial<DayState>): BoardState {
    return { ...b, days: b.days.map((d) => (d.id === dayId ? { ...d, ...patch } : d)) };
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveItem(null);
    setActiveMarkerDay(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    // Marcador de almoço e bloco de tempo nunca saem do próprio dia — soltar fora dele é no-op.
    const presoAoDia = isAlmocoMarkerId(activeId) || isBlocoItemId(activeId);

    const sourceContainer = isAlmocoMarkerId(activeId)
      ? dayContainerId(almocoMarkerDayId(activeId))
      : findContainer(board, activeId);
    const destContainer = isContainerId(overId)
      ? overId
      : isAlmocoMarkerId(overId)
        ? dayContainerId(almocoMarkerDayId(overId))
        : findContainer(board, overId);

    if (!sourceContainer || !destContainer) return;
    if (presoAoDia && destContainer !== sourceContainer) return;
    if (sourceContainer === destContainer && overId === activeId) return;

    let nextBoard: BoardState;
    const touched = new Set<ContainerId>([sourceContainer, destContainer]);

    if (sourceContainer === destContainer) {
      // Reordenação dentro do mesmo dia (ou do Boneyard) — cenas, blocos de tempo e o marcador de
      // almoço compartilham a mesma lista sortable, tratada como uma lista combinada de "entries" e
      // convertida de volta em (itens, almocoIndex) depois.
      if (sourceContainer === "boneyard") {
        const items = board.boneyard;
        const oldIndex = items.findIndex((i) => i.itemId === activeId);
        const newIndex = items.findIndex((i) => i.itemId === overId);
        if (oldIndex === -1 || newIndex === -1) return;
        nextBoard = setBoneyard(board, arrayMoveItems(items, oldIndex, newIndex));
      } else {
        const dayId = sourceContainer.split(":")[1];
        const day = board.days.find((d) => d.id === dayId);
        if (!day) return;
        const entries = buildDayEntries(day);
        const entryIds = entries.map((e) => dayEntryId(dayId, e));
        const oldIndex = entryIds.indexOf(activeId);
        const newIndex = isContainerId(overId) ? entries.length - 1 : entryIds.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1) return;
        nextBoard = withDay(board, dayId, splitDayEntries(arrayMoveItems(entries, oldIndex, newIndex)));
      }
    } else {
      // Cross-container: só tiras de cena migram entre Boneyard e dias, ou entre dois dias. A posição
      // do almoço de origem/destino se ajusta sozinha, porque a mudança é feita na lista combinada.
      const movingItem = getItems(board, sourceContainer).find((i) => i.itemId === activeId);
      if (!movingItem) return;

      const destDayId = destContainer.startsWith("day:") ? destContainer.split(":")[1] : null;
      const destDay = destDayId ? board.days.find((d) => d.id === destDayId) : undefined;

      // Duas partes da mesma cena não cabem na mesma diária (unique diária+cena): a AD escolhe outra.
      if (movingItem.scenePartId && destDay) {
        const outra = cenasDoDia(destDay).find((i) => i.sceneId === movingItem.sceneId);
        if (outra) {
          toast.error(
            `A cena ${movingItem.scene.numero} já está nesta diária (${outra.parte?.rotulo ?? "cena inteira"}). Cada diária recebe no máximo uma parte da mesma cena.`
          );
          return;
        }
      }

      nextBoard = board;
      if (sourceContainer === "boneyard") {
        nextBoard = setBoneyard(nextBoard, board.boneyard.filter((i) => i.itemId !== activeId));
      } else {
        const srcDayId = sourceContainer.split(":")[1];
        const srcDay = board.days.find((d) => d.id === srcDayId)!;
        const entries = buildDayEntries(srcDay).filter((e) => dayEntryId(srcDayId, e) !== activeId);
        nextBoard = withDay(nextBoard, srcDayId, splitDayEntries(entries));
      }

      if (!destDay) {
        const idx = board.boneyard.findIndex((i) => i.itemId === overId);
        const lista = nextBoard.boneyard;
        const insertAt = idx === -1 ? lista.length : idx;
        nextBoard = setBoneyard(nextBoard, [...lista.slice(0, insertAt), movingItem, ...lista.slice(insertAt)]);
      } else {
        const entries = buildDayEntries(destDay);
        const entryIds = entries.map((e) => dayEntryId(destDay.id, e));
        const idx = isContainerId(overId) ? -1 : entryIds.indexOf(overId);
        const insertAt = idx === -1 ? entries.length : idx;

        // Ao entrar num dia vindo do Boneyard, preenche Prep/Rod automaticamente — Rod pelo tempo estimado
        // da cena, Prep por comparação de set/locação com a cena anterior (0min se igual, já montado).
        const cenaAnterior = entries
          .slice(0, insertAt)
          .flatMap((e) => (e.type === "item" && e.item.tipo === "cena" ? [e.item.item] : []))
          .pop();
        const itemToInsert: StripItem =
          sourceContainer === "boneyard"
            ? {
                ...movingItem,
                prepMin: computeAutoFillPrepMin(cenaAnterior?.scene, movingItem.scene, DEFAULT_PREP_MIN),
                // Parte de cena dividida: o Rod da parte (planos dela, ou estimado pelos oitavos dela) — a
                // duração alvo é do total, não da parte. Cena inteira: a duração alvo manda; sem ela, o
                // tempo estimado por oitavos.
                rodMin: movingItem.parte
                  ? movingItem.parte.rodMin
                  : computeAutoFillRodMin(movingItem.scene.duracaoAlvoMin ?? movingItem.scene.tempoEstimadoMin),
              }
            : movingItem;

        entries.splice(insertAt, 0, { type: "item", item: { tipo: "cena", item: itemToInsert } });
        nextBoard = withDay(nextBoard, destDay.id, splitDayEntries(entries));
      }
    }

    const previousBoard = board;
    const aplicar = () => {
      setBoard(nextBoard);
      persistChanges(nextBoard, Array.from(touched), previousBoard);
    };

    // Mudar de diária (ou voltar pro Boneyard) descarta status e horas reais daquela diária — é
    // registro do que aconteceu, não planejamento. Confirma antes, nomeando o que se perde.
    const execucao = sourceContainer !== destContainer ? descreverExecucaoDoMovimento(board, sourceContainer, activeId) : null;
    if (execucao) {
      setMovimentoARevisar({ aviso: execucao, aplicar });
      return;
    }
    aplicar();
  }

  function descreverExecucaoDoMovimento(b: BoardState, container: ContainerId, itemId: string): string | null {
    const item = getItems(b, container).find((i) => i.itemId === itemId);
    if (!item) return null;
    const registro = descreverExecucao(item);
    if (!registro) return null;
    const dia = b.days.find((d) => `day:${d.id}` === container);
    return `A cena ${numeroComParte(item.scene.numero, item.parte)} está marcada como ${registro}${
      dia ? ` na diária ${dia.numeroDia}` : ""
    }. Tirar a cena daí apaga esse registro — ele é do que aconteceu naquela diária.`;
  }

  function handleUpdateTimes(itemId: string, prepMin: number | null, rodMin: number | null) {
    const container = findContainer(board, itemId);
    if (!container) return;

    const atualiza = (item: StripItem) => (item.itemId === itemId ? { ...item, prepMin, rodMin } : item);
    const previousBoard = board;
    const nextBoard =
      container === "boneyard"
        ? setBoneyard(board, board.boneyard.map(atualiza))
        : withDay(board, container.split(":")[1], {
            itens: board.days
              .find((d) => `day:${d.id}` === container)!
              .itens.map((i) => (i.tipo === "cena" ? { tipo: "cena" as const, item: atualiza(i.item) } : i)),
          });
    setBoard(nextBoard);
    persistChanges(nextBoard, [container], previousBoard);
  }

  if (!mounted) {
    return (
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        <DaySidebar projectId={projectId} days={board.days} />
        <div className="min-w-0 flex-1 space-y-4">
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
        {/* min-w-0 é o que impede rolagem horizontal nesta tela: item de flex tem min-width:auto por
            padrão, então esta coluna crescia até caber a linha mais larga lá dentro (a descrição de
            um plano) em vez de respeitar a largura da página — e nenhum truncate/quebra de linha
            dentro dela chegava a ser acionado. Rolagem aninhada aqui é pior que em qualquer outra
            tela: a operação principal é arrastar cena e plano, e barra própria perde a posição no
            meio do arraste. */}
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          <DaySidebar projectId={projectId} days={board.days} />
          <div className="min-w-0 flex-1 space-y-4">
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
              locacoes={locacoes}
              items={board.boneyard}
              characterMap={characterMap}
              sistemaIdElenco={sistemaIdElenco}
              onUpdateTimes={handleUpdateTimes}
            />
          </div>
        </div>

        <ConfirmDeleteDialog
          open={movimentoARevisar !== null}
          onOpenChange={(aberto) => {
            if (!aberto) setMovimentoARevisar(null);
          }}
          title="Mover apaga o registro de execução"
          description={movimentoARevisar?.aviso ?? ""}
          confirmLabel="Mover mesmo assim"
          onConfirm={() => {
            movimentoARevisar?.aplicar();
            setMovimentoARevisar(null);
          }}
        />

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
