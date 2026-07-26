import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <Icon className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        </div>
        {actions && <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div>}
      </CardContent>
    </Card>
  );
}
