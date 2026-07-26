"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { gerarNomeArquivo } from "@/lib/filename";

export function ExportDoodButton({
  projectId,
  projeto,
}: {
  projectId: string;
  projeto: { titulo: string; sigla: string | null };
}) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/dood/export`);
      if (!res.ok) return;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = gerarNomeArquivo({ projeto, tipo: "DOOD", ext: "xlsx" });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" onClick={handleExport} disabled={loading}>
      <Download className="mr-2 h-4 w-4" />
      {loading ? "Exportando..." : "Exportar DOOD"}
    </Button>
  );
}
