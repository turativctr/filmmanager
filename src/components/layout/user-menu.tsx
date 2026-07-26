"use client";

import { LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function UserMenu() {
  const { data: session } = useSession();
  if (!session?.user) return null;

  return (
    <div className="flex items-center justify-between gap-2 border-t p-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{session.user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        title="Sair"
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
