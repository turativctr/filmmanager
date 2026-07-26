"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ShootDayOption = { id: string; numeroDia: number };

type ContinuityNote = {
  id: string;
  texto: string;
  shootDayId: string | null;
  shootDay: { numeroDia: number } | null;
};

export function ContinuityNotesPanel({
  projectId,
  sceneId,
  shootDays,
  initialNotes,
}: {
  projectId: string;
  sceneId: string;
  shootDays: ShootDayOption[];
  initialNotes: ContinuityNote[];
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [texto, setTexto] = useState("");
  const [shootDayId, setShootDayId] = useState<string>("none");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!texto.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/scenes/${sceneId}/continuity-notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: texto.trim(), shootDayId: shootDayId === "none" ? undefined : shootDayId }),
    });
    setSaving(false);
    if (res.ok) {
      const created = await res.json();
      setNotes((prev) => [created, ...prev]);
      setTexto("");
      setShootDayId("none");
      router.refresh();
    }
  }

  async function handleDelete(noteId: string) {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    await fetch(`/api/projects/${projectId}/scenes/${sceneId}/continuity-notes/${noteId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notas de continuidade</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma nota registrada ainda.</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="flex items-start justify-between gap-2 rounded-md border p-2">
                <div>
                  <p className="text-sm">{note.texto}</p>
                  {note.shootDay && (
                    <p className="text-xs text-muted-foreground">Diária {note.shootDay.numeroDia}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(note.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  title="Remover nota"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2 border-t pt-3">
          <Textarea
            placeholder="Nova nota de continuidade..."
            rows={2}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="flex gap-2">
            <Select value={shootDayId} onValueChange={setShootDayId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Diária (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem diária associada</SelectItem>
                {shootDays.map((day) => (
                  <SelectItem key={day.id} value={day.id}>
                    Diária {day.numeroDia}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" onClick={handleAdd} disabled={saving}>
              Adicionar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
