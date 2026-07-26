import { AccountGroupSection } from "./account-group-section";
import type { BudgetData } from "./types";

export function DetailTab({ projectId, budget }: { projectId: string; budget: BudgetData }) {
  return (
    <div className="space-y-4">
      {budget.accountGroups.map((group) => (
        <AccountGroupSection
          key={group.id}
          projectId={projectId}
          group={group}
          globals={budget.globals}
          moedaBase={budget.moedaBase}
        />
      ))}
    </div>
  );
}
