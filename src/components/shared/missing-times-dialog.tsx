"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

export function MissingTimesDialog({
  open,
  onOpenChange,
  count,
  onPreencherAgora,
  onContinuarAssimMesmo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onPreencherAgora: () => void;
  onContinuarAssimMesmo: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tempo não definido</AlertDialogTitle>
          <AlertDialogDescription>
            {count} {count === 1 ? "cena está" : "cenas estão"} sem tempo de rodagem (Rod) definido. Os
            horários podem estar incorretos. Deseja preencher agora ou continuar mesmo assim?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onContinuarAssimMesmo}>Continuar assim mesmo</AlertDialogCancel>
          <AlertDialogAction className={buttonVariants({ variant: "default" })} onClick={onPreencherAgora}>
            Preencher agora
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
