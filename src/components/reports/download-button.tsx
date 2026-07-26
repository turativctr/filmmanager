"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function DownloadButton({
  url,
  filename,
  label,
  variant = "outline",
}: {
  url: string;
  filename: string;
  label: string;
  variant?: "outline" | "ghost" | "secondary" | "default";
}) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(url);
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

  return (
    <Button variant={variant} size="sm" onClick={handleDownload} disabled={loading}>
      <Download className="mr-1.5 h-3.5 w-3.5" />
      {loading ? "Gerando..." : label}
    </Button>
  );
}
