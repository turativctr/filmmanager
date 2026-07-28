"use client";

import { LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

import { ThemeSelector } from "@/components/theme/theme-selector";
import { Button } from "@/components/ui/button";
import { GLASS_BORDER_COLOR } from "@/lib/glass";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const { data: session } = useSession();
  if (!session?.user) return null;

  return (
    <div className={cn("flex items-center justify-between gap-2 border-t p-3", GLASS_BORDER_COLOR)}>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{session.user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
      </div>
      <div className="flex shrink-0 items-center">
        <ThemeSelector />
        <Button
          variant="ghost"
          size="icon"
          title="Sair"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
