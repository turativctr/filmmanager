import { HelpCircle } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function TermTooltip({ content }: { content: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className="inline-flex shrink-0 items-center align-middle text-muted-foreground hover:text-foreground"
        aria-label="Mais informações"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </TooltipTrigger>
      <TooltipContent>{content}</TooltipContent>
    </Tooltip>
  );
}
