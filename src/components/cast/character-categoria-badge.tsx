import type { CharacterCategoria } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { CHARACTER_CATEGORIA_BADGE_CLASS, CHARACTER_CATEGORIA_LABEL } from "@/lib/character-categoria";
import { cn } from "@/lib/utils";

export function CharacterCategoriaBadge({
  categoria,
  className,
}: {
  categoria: CharacterCategoria;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(CHARACTER_CATEGORIA_BADGE_CLASS[categoria], className)}>
      {CHARACTER_CATEGORIA_LABEL[categoria]}
    </Badge>
  );
}
