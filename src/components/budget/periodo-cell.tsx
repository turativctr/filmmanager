"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import type { GlobalData } from "./types";

export function PeriodoCell({
  periodo,
  globalRef,
  globals,
  onChangeGlobalRef,
  onChangePeriodo,
}: {
  periodo: number;
  globalRef: string | null;
  globals: GlobalData[];
  onChangeGlobalRef: (globalRef: string | null) => void;
  onChangePeriodo: (periodo: number) => void;
}) {
  const resolved = globalRef ? globals.find((g) => g.chave === globalRef) : undefined;

  return (
    <div className="flex items-center gap-1.5">
      <select
        className="rounded border bg-background px-1 py-1 text-xs"
        value={globalRef ?? "__manual__"}
        onChange={(e) => onChangeGlobalRef(e.target.value === "__manual__" ? null : e.target.value)}
      >
        <option value="__manual__">Manual</option>
        {globals.map((g) => (
          <option key={g.id} value={g.chave}>
            {g.chave}
          </option>
        ))}
      </select>
      {globalRef ? (
        <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-100">
          G: {globalRef} = {resolved ? resolved.valor : periodo}
        </Badge>
      ) : (
        <Input
          type="number"
          step="any"
          className="h-7 w-16 px-1.5 text-xs"
          defaultValue={periodo}
          onBlur={(e) => onChangePeriodo(Number(e.target.value) || 0)}
        />
      )}
    </div>
  );
}
