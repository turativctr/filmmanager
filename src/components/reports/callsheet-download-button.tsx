"use client";

import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MissingTimesDialog } from "@/components/shared/missing-times-dialog";
import { Button } from "@/components/ui/button";

export function CallsheetDownloadButton({
  projectId,
  shootDayId,
  filename,
  scenesSemTempoCount,
}: {
  projectId: string;
  shootDayId: string;
  filename: string;
  scenesSemTempoCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showMissingTimesDialog, setShowMissingTimesDialog] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/reports/callsheet?day=${shootDayId}`);
      if (!res.ok) return;

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setLoading(false);
    }
  }

  function handleClick() {
    if (scenesSemTempoCount > 0) {
      setShowMissingTimesDialog(true);
      return;
    }
    handleDownload();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
        <Download className="mr-1.5 h-3.5 w-3.5" />
        {loading ? "Gerando..." : "Ordem do Dia (PDF)"}
      </Button>
      <MissingTimesDialog
        open={showMissingTimesDialog}
        onOpenChange={setShowMissingTimesDialog}
        count={scenesSemTempoCount}
        onPreencherAgora={() => router.push(`/projects/${projectId}/shootdays/${shootDayId}/ordem-do-dia?step=2`)}
        onContinuarAssimMesmo={handleDownload}
      />
    </>
  );
}
