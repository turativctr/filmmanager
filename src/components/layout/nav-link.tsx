import Link from "next/link";

import { GLASS_HOVER_BG } from "@/lib/glass";
import { MODULE_ACTIVE_ITEM_CLASS, type ModuleKey } from "@/lib/module-theme";
import { cn } from "@/lib/utils";

/** Link de navegação da sidebar — usado tanto pelos itens soltos do topo quanto pelos itens
 *  dentro de um `SidebarGroup`. Extraído de sidebar.tsx pra evitar import circular com
 *  sidebar-group.tsx (que também precisa dele). */
export function NavLink({
  href,
  label,
  active,
  module,
}: {
  href: string;
  label: string;
  active: boolean;
  module: ModuleKey;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md border-l-[3px] border-l-transparent px-3 py-2 text-sm font-medium transition-colors",
        active
          ? MODULE_ACTIVE_ITEM_CLASS[module]
          : cn("text-muted-foreground hover:text-foreground", GLASS_HOVER_BG)
      )}
    >
      {label}
    </Link>
  );
}
