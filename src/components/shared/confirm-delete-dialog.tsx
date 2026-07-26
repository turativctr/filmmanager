"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function ConfirmDeleteDialog({
  title,
  description,
  onConfirm,
  open,
  onOpenChange,
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<void> | void;
  /** Modo controlado — quando informado, não renderiza o trigger padrão (ícone de lixeira); quem
   *  chama controla a abertura por fora (ex.: um item de DropdownMenuItem). Necessário porque
   *  aninhar um AlertDialogTrigger dentro de um DropdownMenuItem quebra o fechamento do menu. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const isControlled = open !== undefined;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {!isControlled && (
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={async (e) => {
              e.preventDefault();
              setLoading(true);
              await onConfirm();
              setLoading(false);
            }}
          >
            {loading ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
