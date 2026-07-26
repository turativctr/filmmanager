"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import { StripCard } from "@/components/stripboard/strip-card";
import { StripDropZone } from "@/components/stripboard/strip-drop-zone";
import { TermTooltip } from "@/components/shared/term-tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCharacterId } from "@/lib/character-id";

import type { StripItem } from "./types";

export function BoneyardSection({
  projectId,
  items,
  characterMap,
  sistemaIdElenco,
  onUpdateTimes,
}: {
  projectId: string;
  items: StripItem[];
  characterMap: Record<string, { idCurto: string; numeroElenco: number | null; personagem: string }>;
  sistemaIdElenco: "ID_CURTO" | "NUMERACAO";
  onUpdateTimes: (sceneId: string, prepMin: number | null, rodMin: number | null) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Card id="boneyard">
      <CardHeader
        className="cursor-pointer flex-row items-center justify-between space-y-0"
        onClick={() => setOpen((o) => !o)}
      >
        <CardTitle className="flex items-center gap-1.5 text-base">
          Boneyard ({items.length})
          <span onClick={(e) => e.stopPropagation()}>
            <TermTooltip content="Área do Stripboard onde ficam as cenas ainda não agendadas em nenhum dia de filmagem." />
          </span>
        </CardTitle>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </CardHeader>
      {open && (
        <CardContent>
          <StripDropZone
            id="boneyard"
            itemIds={items.map((i) => i.sceneId)}
            emptyLabel="Nenhuma cena não agendada."
          >
            {items.map((item) => (
              <StripCard
                key={item.sceneId}
                item={item}
                neutral
                characterLabels={item.scene.characterIds.map((id) => {
                  const c = characterMap[id];
                  return c ? getCharacterId(c, { sistemaIdElenco }) : id;
                })}
                onUpdateTimes={(prep, rod) => onUpdateTimes(item.sceneId, prep, rod)}
                projectId={projectId}
              />
            ))}
          </StripDropZone>
        </CardContent>
      )}
    </Card>
  );
}
