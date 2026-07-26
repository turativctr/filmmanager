import { CreateBudgetCard } from "@/components/budget/create-budget-card";
import { TopsheetTab } from "@/components/budget/topsheet-tab";
import { getBudgetData } from "@/lib/budget-data";
import { prisma } from "@/lib/prisma";

export default async function BudgetTopsheetPage({ params }: { params: { id: string } }) {
  const [data, project] = await Promise.all([
    getBudgetData(params.id),
    prisma.project.findUniqueOrThrow({
      where: { id: params.id },
      select: { titulo: true, sigla: true },
    }),
  ]);
  if (!data) return <CreateBudgetCard projectId={params.id} />;
  return (
    <TopsheetTab
      projectId={params.id}
      budget={data}
      projeto={{ titulo: project.titulo, sigla: project.sigla }}
    />
  );
}
