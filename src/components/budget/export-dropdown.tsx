"use client";

import { ChevronDown, Download } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { gerarNomeArquivo } from "@/lib/filename";

async function downloadFile(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) return false;
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
  return true;
}

export function ExportDropdown({
  projectId,
  scenarioCount,
  projeto,
  versao,
}: {
  projectId: string;
  scenarioCount: number;
  projeto: { titulo: string; sigla: string | null };
  versao: string;
}) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  async function handle(key: string, url: string, filename: string) {
    setLoadingKey(key);
    await downloadFile(url, filename);
    setLoadingKey(null);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={loadingKey !== null}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {loadingKey ? "Gerando..." : "Exportar"}
          <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() =>
            handle(
              "topsheet",
              `/api/projects/${projectId}/budget/topsheet-pdf`,
              gerarNomeArquivo({ projeto, tipo: "Topsheet", variante: `v${versao}`, ext: "pdf" })
            )
          }
        >
          Topsheet PDF
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            handle(
              "detailed",
              `/api/projects/${projectId}/budget/export/detailed`,
              gerarNomeArquivo({ projeto, tipo: "OrcamentoDetalhado", variante: `v${versao}`, ext: "pdf" })
            )
          }
        >
          Orçamento Detalhado PDF
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={scenarioCount < 2}
          onClick={() =>
            handle(
              "comparison",
              `/api/projects/${projectId}/budget/export/comparison`,
              gerarNomeArquivo({ projeto, tipo: "ComparacaoCenarios", ext: "pdf" })
            )
          }
        >
          Comparação de Cenários PDF
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            handle(
              "dood",
              `/api/projects/${projectId}/dood/export`,
              gerarNomeArquivo({ projeto, tipo: "DOOD", ext: "xlsx" })
            )
          }
        >
          DOOD XLSX
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            handle(
              "one-line",
              `/api/projects/${projectId}/reports/one-line-schedule`,
              gerarNomeArquivo({ projeto, tipo: "OneLineSchedule", ext: "xlsx" })
            )
          }
        >
          Cronograma Resumido XLSX
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
