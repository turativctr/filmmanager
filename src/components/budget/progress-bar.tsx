import { cn } from "@/lib/utils";

export function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(percent, 100));
  const color =
    percent >= 100 ? "bg-red-500" : percent >= 80 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${clamped}%` }} />
    </div>
  );
}
