import { cn } from "@/lib/utils";

import type { CalendarEventType } from "./types";

export const EVENT_TYPE_LABEL: Record<CalendarEventType, string> = {
  ENSAIO: "Ensaio",
  VIAGEM: "Viagem",
  FIGURINO: "Prova de figurino",
  FERIADO: "Feriado",
  FOLGA: "Folga",
  OUTRO: "Outro",
};

const EVENT_TYPE_CLASS: Record<CalendarEventType, string> = {
  ENSAIO: "bg-violet-100 text-violet-800",
  VIAGEM: "bg-violet-100 text-violet-800",
  FIGURINO: "bg-violet-100 text-violet-800",
  OUTRO: "bg-violet-100 text-violet-800",
  FERIADO: "bg-amber-100 text-amber-800",
  FOLGA: "bg-gray-200 text-gray-700",
};

export function CalendarBadge({
  variant,
  children,
}: {
  variant: "shootday" | CalendarEventType;
  children: React.ReactNode;
}) {
  const className = variant === "shootday" ? "bg-blue-100 text-blue-800" : EVENT_TYPE_CLASS[variant];

  return (
    <span
      className={cn(
        "block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight",
        className
      )}
    >
      {children}
    </span>
  );
}
