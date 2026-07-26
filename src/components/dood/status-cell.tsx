import { cn } from "@/lib/utils";
import { DOOD_STATUS_LABEL, type DoodStatus } from "@/lib/dood";

const STATUS_CLASS: Record<DoodStatus, string> = {
  SW: "bg-blue-100 text-blue-800",
  WF: "bg-blue-100 text-blue-800",
  SW_WF: "bg-blue-100 text-blue-800",
  W: "bg-green-100 text-green-800",
  H: "bg-amber-100 text-amber-800",
  "—": "text-muted-foreground",
};

export function StatusCell({ status }: { status: DoodStatus }) {
  return (
    <td className={cn("border p-1.5 text-center text-xs font-semibold", STATUS_CLASS[status])}>
      {DOOD_STATUS_LABEL[status]}
    </td>
  );
}
