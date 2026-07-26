"use client";

import { ChevronDown, Info } from "lucide-react";
import { useEffect, useState } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const STORAGE_PREFIX = "film-manager:banner-open:";

/** Banner informativo colapsável — aberto na primeira visita a cada página (chave ausente no
 *  localStorage), lembra o estado colapsado/aberto localmente depois disso. */
export function InfoBanner({
  storageKey,
  title,
  description,
}: {
  storageKey: string;
  title: string;
  description: string;
}) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_PREFIX + storageKey);
    if (stored === "0") setOpen(false);
  }, [storageKey]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    window.localStorage.setItem(STORAGE_PREFIX + storageKey, next ? "1" : "0");
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={handleOpenChange}
      className="rounded-md border border-blue-200 bg-blue-50"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-blue-900">
        <Info className="h-4 w-4 shrink-0" />
        <span className="flex-1">{title}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-3 pl-10 text-sm text-blue-900/90">
        {description}
      </CollapsibleContent>
    </Collapsible>
  );
}
